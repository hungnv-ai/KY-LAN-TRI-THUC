-- ════════════════════════════════════════════════════════════════════════
-- Hàm nội bộ (tiền tố _) + chính sách RLS + tạo hồ sơ khi đăng nhập lần đầu
-- ════════════════════════════════════════════════════════════════════════

-- ── Cấu hình ──────────────────────────────────────────────────────────────
create or replace function public._cfg(p_section text)
returns jsonb language sql stable set search_path = public as $$
  select coalesce((select value from game_settings where key = p_section), '{}'::jsonb);
$$;

create or replace function public._cfgn(p_section text, p_key text, p_default numeric default 0)
returns numeric language sql stable set search_path = public as $$
  select coalesce((public._cfg(p_section) ->> p_key)::numeric, p_default);
$$;

-- ── Thời gian theo giờ Việt Nam ───────────────────────────────────────────
create or replace function public._now_vn()
returns timestamp language sql stable as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh');
$$;

create or replace function public._today()
returns date language sql stable as $$
  select public._now_vn()::date;
$$;

create or replace function public._is_golden()
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1
    from jsonb_array_elements(public._cfg('GOLDEN_HOURS') -> 'RANGES') r
    where extract(hour from public._now_vn()) >= (r ->> 0)::int
      and extract(hour from public._now_vn()) < (r ->> 1)::int
  );
$$;

-- Đầu tuần (thứ Hai) và đầu tháng theo giờ VN, trả về timestamptz để so với created_at.
create or replace function public._period_start(p_period text)
returns timestamptz language sql stable as $$
  select case p_period
    when 'week' then (date_trunc('week', public._now_vn())) at time zone 'Asia/Ho_Chi_Minh'
    when 'month' then (date_trunc('month', public._now_vn())) at time zone 'Asia/Ho_Chi_Minh'
    else '-infinity'::timestamptz
  end;
$$;

-- ── Quyền ─────────────────────────────────────────────────────────────────
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('teacher', 'bgh', 'admin'), false);
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('bgh', 'admin'), false);
$$;

create or replace function public._email_allowed(p_email text)
returns boolean language sql stable set search_path = public as $$
  select
    jsonb_array_length(coalesce(public._cfg('ALLOWED_EMAIL_DOMAINS'), '[]')) = 0
    or exists (
      select 1 from jsonb_array_elements_text(public._cfg('ALLOWED_EMAIL_DOMAINS')) d
      where lower(p_email) like '%@' || lower(d)
    );
$$;

-- Người chơi hợp lệ: đã đăng nhập, có hồ sơ, email đúng tên miền trường.
create or replace function public._require_player()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select email into v_email from profiles where id = v_uid;
  if not found then
    raise exception 'no_profile' using errcode = '28000';
  end if;
  if not public._email_allowed(v_email) then
    raise exception 'email_domain_not_allowed' using errcode = '28000';
  end if;
  -- Đang bảo trì: chỉ nhân viên (giáo viên, BGH, quản trị) dùng được game.
  if coalesce((public._cfg('MAINTENANCE') ->> 'on')::boolean, false) and not public.is_staff() then
    raise exception 'maintenance' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

create or replace function public._require_staff()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._require_player();
begin
  if not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return v_uid;
end;
$$;

create or replace function public._require_manager()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._require_player();
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  return v_uid;
end;
$$;

-- ── Bộ đếm trong ngày ─────────────────────────────────────────────────────
create or replace function public._daily(p_uid uuid)
returns public.daily_counters language plpgsql security definer set search_path = public as $$
declare v_row daily_counters;
begin
  insert into daily_counters (user_id, day) values (p_uid, public._today())
  on conflict (user_id, day) do nothing;
  select * into v_row from daily_counters where user_id = p_uid and day = public._today() for update;
  return v_row;
end;
$$;

-- ── Hạng ──────────────────────────────────────────────────────────────────
create or replace function public._rank_of(p_xp int)
returns public.ranks language sql stable set search_path = public as $$
  select * from ranks where xp <= p_xp order by xp desc limit 1;
$$;

-- Trao đồ thưởng hạng còn thiếu; trả về danh sách món mới.
create or replace function public._grant_rank_items(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_xp int;
  v_owned text[];
  v_new jsonb := '[]';
  v_item record;
begin
  select xp, owned into v_xp, v_owned from player_state where user_id = p_uid;
  for v_item in
    select i.id, i.name from items i join ranks r on r.id = i.rank_id
    where r.xp <= v_xp and not (i.id = any (v_owned))
  loop
    update player_state set owned = array_append(owned, v_item.id) where user_id = p_uid;
    v_new := v_new || jsonb_build_object('id', v_item.id, 'name', v_item.name);
  end loop;
  return v_new;
end;
$$;

-- Cộng thưởng (XP nhân Giờ Vàng), ghi nhật ký, kiểm tra lên hạng.
create or replace function public._apply_reward(p_uid uuid, p_xp int, p_coins int, p_kind text, p_meta jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_golden boolean := public._is_golden();
  v_xp int := p_xp;
  v_before ranks;
  v_after ranks;
  v_old_xp int;
  v_items jsonb;
  v_rank_up jsonb := null;
begin
  if v_golden and p_xp > 0 then
    v_xp := (p_xp * public._cfgn('GOLDEN_HOURS', 'XP_MULTIPLIER', 2))::int;
  end if;
  select xp into v_old_xp from player_state where user_id = p_uid for update;
  v_before := public._rank_of(v_old_xp);
  update player_state
    set xp = xp + v_xp, coins = coins + p_coins, updated_at = now()
    where user_id = p_uid;
  if v_xp <> 0 or p_coins <> 0 then
    insert into reward_log (user_id, kind, xp, coins, meta) values (p_uid, p_kind, v_xp, p_coins, p_meta);
  end if;
  v_after := public._rank_of(v_old_xp + v_xp);
  if v_after.xp > v_before.xp then
    v_items := public._grant_rank_items(p_uid);
    v_rank_up := jsonb_build_object('from', to_jsonb(v_before), 'to', to_jsonb(v_after), 'items', v_items);
  end if;
  return jsonb_build_object('xp', v_xp, 'coins', p_coins, 'golden', v_golden and p_xp > 0, 'rankUp', v_rank_up);
end;
$$;

create or replace function public._no_reward()
returns jsonb language sql immutable as $$
  select jsonb_build_object('xp', 0, 'coins', 0, 'golden', false, 'rankUp', null);
$$;

-- ── Nhiệm vụ hằng ngày ────────────────────────────────────────────────────
-- Chọn PER_DAY nhiệm vụ cố định theo ngày (giống nhau cho mọi người).
create or replace function public._missions_today()
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(m order by ord), '[]')
  from (
    select m, ord
    from jsonb_array_elements(public._cfg('MISSIONS') -> 'CATALOG') with ordinality as t(m, ord)
    order by md5(public._today()::text || (m ->> 'id'))
    limit public._cfgn('MISSIONS', 'PER_DAY', 3)::int
  ) s;
$$;

create or replace function public._counter_value(p_d public.daily_counters, p_counter text)
returns numeric language sql immutable as $$
  select case p_counter
    when 'checkedIn' then case when p_d.checked_in then 1 else 0 end
    when 'quizRounds' then p_d.quiz_finished
    when 'stationCount' then coalesce(array_length(p_d.stations, 1), 0)
    when 'coinPickups' then p_d.coin_pickups
    when 'distance' then floor(p_d.distance)
    when 'runQuestions' then p_d.run_questions
    when 'gifts' then p_d.gifts
    when 'thanksSent' then p_d.thanks_sent
    else 0
  end;
$$;

create or replace function public._missions_status(p_d public.daily_counters)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m ->> 'id',
      'label', m ->> 'label',
      'target', (m ->> 'target')::numeric,
      'progress', least(public._counter_value(p_d, m ->> 'counter'), (m ->> 'target')::numeric),
      'done', public._counter_value(p_d, m ->> 'counter') >= (m ->> 'target')::numeric
    )), '[]')
  from jsonb_array_elements(public._missions_today()) m;
$$;

-- ── Trạng thái gửi về trình duyệt (cùng cấu trúc với chế độ ngoại tuyến) ──
create or replace function public._state_json(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s player_state;
  d daily_counters;
  p profiles;
begin
  select * into s from player_state where user_id = p_uid;
  d := public._daily(p_uid);
  select * into p from profiles where id = p_uid;
  return jsonb_build_object(
    'xp', s.xp,
    'coins', s.coins,
    'owned', to_jsonb(s.owned),
    'equipped', s.equipped,
    'streak', jsonb_build_object('count', s.streak_count, 'lastDay', s.streak_last),
    'pets', jsonb_build_object(
      'owned', to_jsonb(s.pets),
      'active', s.active_pet,
      'egg', s.egg_progress,
      'eggNeed', public._cfgn('PETS', 'EGG_DAYS', 3)
    ),
    'milestones', to_jsonb(s.milestones),
    'character', public._effective_character(s.character_chosen, s.character_id),
    'daily', jsonb_build_object(
      'day', d.day,
      'checkedIn', d.checked_in,
      'rewardedRounds', d.quiz_rounds,
      'quizRounds', d.quiz_finished,
      'runQuestions', d.run_questions,
      'stations', to_jsonb(d.stations),
      'allStationsBonus', d.all_stations,
      'coinPickups', d.coin_pickups,
      'gifts', d.gifts,
      'distance', d.distance,
      'thanksSent', d.thanks_sent,
      'heartsSent', d.hearts_sent,
      'chestClaimed', d.chest_claimed,
      'missions', public._missions_status(d)
    ),
    'stats', jsonb_build_object(
      'answered', s.total_answered,
      'correct', s.total_correct,
      'rounds', s.quiz_rounds,
      'distance', s.distance,
      'heartsReceived', s.hearts_received,
      'thanksReceived', s.thanks_received
    ),
    'profile', jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'fullName', p.full_name,
      'displayName', p.display_name,
      'unit', p.unit,
      'role', p.role,
      'house', p.house
    ),
    'event', public._active_event(),
    'serverTime', now()
  );
end;
$$;

-- ── Tạo hồ sơ khi tài khoản mới đăng nhập lần đầu ─────────────────────────
-- Xếp Nhà cân bằng (Nhà ít thành viên nhất).
create or replace function public._balanced_house()
returns text language sql stable set search_path = public as $$
  select h from unnest(array['nhanAi', 'banLinh', 'triThuc', 'trachNhiem', 'khaiPhong']) h
  order by (select count(*) from profiles where house = h), random()
  limit 1;
$$;

create or replace function public._ensure_profile(p_uid uuid, p_email text, p_full_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, display_name, house)
  values (p_uid, p_email, p_full_name, null, public._balanced_house())
  on conflict (id) do nothing;

  insert into player_state (user_id, owned, equipped)
  values (
    p_uid,
    coalesce((select array_agg(id order by id) from items where starter), '{}'),
    coalesce(public._cfg('DEFAULT_EQUIPPED'), '{}')
  )
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public._on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._ensure_profile(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public._on_auth_user_created();

-- ── Chính sách đọc (RLS) ──────────────────────────────────────────────────
drop policy if exists "đọc cấu hình" on public.game_settings;
create policy "đọc cấu hình" on public.game_settings for select using (true);

drop policy if exists "đọc hạng" on public.ranks;
create policy "đọc hạng" on public.ranks for select using (true);

drop policy if exists "đọc trang phục" on public.items;
create policy "đọc trang phục" on public.items for select using (true);

-- Câu hỏi chứa đáp án → chỉ giáo viên/BGH/admin được đọc trực tiếp.
drop policy if exists "nhân sự đọc câu hỏi" on public.questions;
create policy "nhân sự đọc câu hỏi" on public.questions for select to authenticated using (public.is_staff());

drop policy if exists "đọc hồ sơ của mình" on public.profiles;
create policy "đọc hồ sơ của mình" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "đọc tiến trình của mình" on public.player_state;
create policy "đọc tiến trình của mình" on public.player_state for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "đọc bộ đếm của mình" on public.daily_counters;
create policy "đọc bộ đếm của mình" on public.daily_counters for select to authenticated using (user_id = auth.uid());

drop policy if exists "đọc nhật ký của mình" on public.reward_log;
create policy "đọc nhật ký của mình" on public.reward_log for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "đọc lời cảm ơn liên quan" on public.kudos;
create policy "đọc lời cảm ơn liên quan" on public.kudos for select to authenticated
  using (to_user = auth.uid() or from_user = auth.uid() or public.is_staff());

drop policy if exists "đọc phiếu quà của mình" on public.vouchers;
create policy "đọc phiếu quà của mình" on public.vouchers for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "đọc cúp" on public.house_cups;
create policy "đọc cúp" on public.house_cups for select using (true);
