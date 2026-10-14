-- ════════════════════════════════════════════════════════════════════════
-- Xã hội: hồ sơ công khai, thả tim / lời cảm ơn (Nhân Ái), bảng xếp hạng,
-- điểm 5 Nhà & Cúp Kỳ Lân hằng tháng, phiếu quà của tôi.
-- ════════════════════════════════════════════════════════════════════════

-- Thông tin rút gọn cho bảng tên trên đầu Kỳ lân (nhiều người một lúc).
create or replace function public.public_profiles(p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_player();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'displayName', coalesce(p.display_name, p.full_name),
      'unit', p.unit,
      'house', p.house,
      'role', p.role,
      'xp', s.xp,
      'equipped', s.equipped,
      'streak', case when s.streak_last >= public._today() - 1 then s.streak_count else 0 end
    ))
    from profiles p join player_state s on s.user_id = p.id
    where p.id = any (p_ids[1:60])
  ), '[]');
end;
$$;

-- Thẻ hồ sơ chi tiết khi chạm vào Kỳ lân của người khác.
create or replace function public.public_profile(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  v jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'displayName', coalesce(p.display_name, p.full_name),
    'unit', p.unit,
    'house', p.house,
    'role', p.role,
    'xp', s.xp,
    'equipped', s.equipped,
    'owned', to_jsonb(s.owned),
    'streak', case when s.streak_last >= public._today() - 1 then s.streak_count else 0 end,
    'distance', floor(s.distance),
    'quizRounds', s.quiz_rounds,
    'accuracy', case when s.total_answered > 0 then round(100.0 * s.total_correct / s.total_answered) else 0 end,
    'heartsReceived', s.hearts_received,
    'thanksReceived', s.thanks_received,
    'stationsToday', coalesce((select array_length(stations, 1) from daily_counters where user_id = p.id and day = public._today()), 0),
    'heartedToday', exists (select 1 from kudos where from_user = v_uid and to_user = p.id and kind = 'heart' and day = public._today()),
    'thankedToday', exists (select 1 from kudos where from_user = v_uid and to_user = p.id and kind = 'thanks' and day = public._today()),
    'recentThanks', coalesce((
      select jsonb_agg(jsonb_build_object('from', coalesce(fp.display_name, fp.full_name), 'message', k.message) order by k.created_at desc)
      from (select * from kudos where to_user = p.id and kind = 'thanks' and message is not null order by created_at desc limit 3) k
      join profiles fp on fp.id = k.from_user
    ), '[]')
  ) into v
  from profiles p join player_state s on s.user_id = p.id
  where p.id = p_id;
  if v is null then raise exception 'profile_not_found'; end if;
  return v;
end;
$$;

-- Thả tim (miễn phí, giới hạn/ngày) hoặc gửi lời cảm ơn (cả hai nhận Xu).
create or replace function public.send_kudos(p_to uuid, p_kind text, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
  v_msg text := nullif(btrim(left(coalesce(p_message, ''), public._cfgn('KUDOS', 'MESSAGE_MAX', 120)::int)), '');
  v_inserted int;
  v_sender jsonb := null;
begin
  if p_to = v_uid then raise exception 'cannot_kudos_self'; end if;
  if not exists (select 1 from profiles where id = p_to) then raise exception 'profile_not_found'; end if;

  if p_kind = 'heart' then
    if d.hearts_sent >= public._cfgn('KUDOS', 'HEARTS_PER_DAY', 20) then
      return jsonb_build_object('ok', false, 'reason', 'limit', 'state', public._state_json(v_uid));
    end if;
    insert into kudos (from_user, to_user, kind, day) values (v_uid, p_to, 'heart', d.day) on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return jsonb_build_object('ok', false, 'reason', 'already', 'state', public._state_json(v_uid));
    end if;
    update daily_counters set hearts_sent = hearts_sent + 1 where user_id = v_uid and day = d.day;
    update player_state set hearts_received = hearts_received + 1 where user_id = p_to;
  elsif p_kind = 'thanks' then
    if d.thanks_sent >= public._cfgn('KUDOS', 'THANKS_PER_DAY', 3) then
      return jsonb_build_object('ok', false, 'reason', 'limit', 'state', public._state_json(v_uid));
    end if;
    insert into kudos (from_user, to_user, kind, message, day) values (v_uid, p_to, 'thanks', v_msg, d.day) on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return jsonb_build_object('ok', false, 'reason', 'already', 'state', public._state_json(v_uid));
    end if;
    update daily_counters set thanks_sent = thanks_sent + 1 where user_id = v_uid and day = d.day;
    update player_state set thanks_received = thanks_received + 1 where user_id = p_to;
    v_sender := public._apply_reward(v_uid, 0, public._cfgn('KUDOS', 'THANKS_COINS_SENDER', 5)::int, 'thanks_sent', jsonb_build_object('to', p_to));
    perform public._apply_reward(p_to, 0, public._cfgn('KUDOS', 'THANKS_COINS_RECEIVER', 5)::int, 'thanks_received', jsonb_build_object('from', v_uid));
  else
    raise exception 'invalid_kind';
  end if;
  return jsonb_build_object('ok', true, 'reward', v_sender, 'state', public._state_json(v_uid));
end;
$$;

-- Lời cảm ơn mình nhận được gần đây.
create or replace function public.my_kudos(p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._require_player();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'from', coalesce(p.display_name, p.full_name), 'fromId', k.from_user,
      'kind', k.kind, 'message', k.message, 'at', k.created_at
    ) order by k.created_at desc, k.id desc)
    from (select * from kudos where to_user = v_uid order by created_at desc, id desc limit least(p_limit, 50)) k
    join profiles p on p.id = k.from_user
  ), '[]');
end;
$$;

-- Bảng xếp hạng: 'week' | 'month' theo XP kiếm được trong kỳ; 'all' theo tổng XP.
-- p_unit: lọc theo bộ phận/lớp (null = toàn trường).
create or replace function public.leaderboard(p_scope text default 'week', p_unit text default null, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  v_since timestamptz := public._period_start(p_scope);
  v_rows jsonb;
  v_me jsonb;
begin
  with scores as (
    select p.id, coalesce(p.display_name, p.full_name) as name, p.unit, p.house, s.xp as total_xp, s.equipped,
      case when p_scope = 'all' then s.xp
           else coalesce((select sum(l.xp) from reward_log l where l.user_id = p.id and l.created_at >= v_since), 0)
      end as score
    from profiles p join player_state s on s.user_id = p.id
    where (p_unit is null or p.unit = p_unit)
  ), ranked as (
    select *, rank() over (order by score desc, total_xp desc) as pos from scores
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object(
      'pos', pos, 'id', id, 'name', name, 'unit', unit, 'house', house, 'score', score, 'xp', total_xp, 'me', id = v_uid
    ) order by pos, name) from (select * from ranked where score > 0 or p_scope = 'all' order by pos limit least(p_limit, 100)) t), '[]'),
    (select jsonb_build_object('pos', pos, 'score', score, 'xp', total_xp) from ranked where id = v_uid)
  into v_rows, v_me;
  return jsonb_build_object('scope', p_scope, 'unit', p_unit, 'rows', v_rows, 'me', v_me);
end;
$$;

-- Điểm Nhà trong một tháng = tổng XP thành viên kiếm được trong tháng đó.
create or replace function public._house_points(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('house', h, 'points', pts, 'members', mem) order by pts desc, h), '[]')
  from (
    select h,
      coalesce((select sum(l.xp) from reward_log l join profiles p on p.id = l.user_id
                where p.house = h and l.created_at >= p_from and l.created_at < p_to), 0) as pts,
      (select count(*) from profiles p where p.house = h) as mem
    from unnest(array['nhanAi', 'banLinh', 'triThuc', 'trachNhiem', 'khaiPhong']) h
  ) t;
$$;

-- Bảng điểm 5 Nhà tháng này + Cúp tháng trước (tự chốt cúp tháng trước nếu chưa có).
create or replace function public.house_standings()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_this_month timestamptz := public._period_start('month');
  v_prev_month date := (date_trunc('month', public._now_vn()) - interval '1 month')::date;
  v_prev_start timestamptz := v_prev_month::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_prev jsonb;
  v_me text;
begin
  perform public._require_player();
  select house into v_me from profiles where id = auth.uid();
  if not exists (select 1 from house_cups where month = v_prev_month)
     and exists (select 1 from reward_log where created_at >= v_prev_start and created_at < v_this_month) then
    v_prev := public._house_points(v_prev_start, v_this_month);
    insert into house_cups (month, house, points, standings)
    values (v_prev_month, v_prev -> 0 ->> 'house', (v_prev -> 0 ->> 'points')::int, v_prev)
    on conflict (month) do nothing;
  end if;
  return jsonb_build_object(
    'myHouse', v_me,
    'month', date_trunc('month', public._now_vn())::date,
    'standings', public._house_points(v_this_month, 'infinity'),
    'cups', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'house', house, 'points', points) order by month desc)
                      from (select * from house_cups order by month desc limit 6) c), '[]')
  );
end;
$$;

create or replace function public.my_vouchers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._require_player();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'reason', reason, 'status', status, 'note', note, 'at', created_at) order by created_at desc)
    from vouchers where user_id = v_uid
  ), '[]');
end;
$$;
