-- ════════════════════════════════════════════════════════════════════════
-- KỲ LÂN TRI THỨC — FILE CÀI ĐẶT MÁY CHỦ (Supabase)
-- Cách dùng: Supabase → SQL Editor → New query → dán toàn bộ file này → Run.
-- Chạy lại bất cứ lúc nào để cập nhật (không mất dữ liệu người chơi).
-- Sinh tự động bởi scripts/gen-seed.mjs — đừng sửa tay; sửa trong supabase/sql/ và src/.
-- ════════════════════════════════════════════════════════════════════════

-- >>> 01_schema.sql
-- ════════════════════════════════════════════════════════════════════════
-- Kỳ Lân Tri Thức — Cấu trúc bảng (chạy lại nhiều lần được, không mất dữ liệu)
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Cấu hình game (sinh từ src/config.js bằng scripts/gen-seed.mjs).
create table if not exists public.game_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ranks (
  id text primary key,
  sort int not null,
  name text not null,
  icon text not null,
  xp int not null,
  color text not null,
  reward text,
  tiers boolean not null default false
);

create table if not exists public.items (
  id text primary key,
  slot text not null,
  name text not null,
  price int not null default 0,
  rank_id text references public.ranks (id),
  rarity text not null default 'common',
  model text,
  starter boolean not null default false
);

create table if not exists public.questions (
  id bigint generated always as identity primary key,
  topic text not null check (topic in ('values', 'va', 'general')),
  value text check (value in ('nhanAi', 'banLinh', 'triThuc', 'trachNhiem', 'khaiPhong')),
  q text not null check (length(q) between 5 and 400),
  -- options[1] LUÔN là đáp án đúng; máy chủ tự xáo khi phát câu hỏi.
  options text[] not null check (array_length(options, 1) between 2 and 6),
  explain text,
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  created_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists questions_q_unique on public.questions (md5(q));
create index if not exists questions_status_idx on public.questions (status);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  display_name text,
  unit text,
  role text not null default 'player' check (role in ('player', 'teacher', 'bgh', 'admin')),
  house text check (house in ('nhanAi', 'banLinh', 'triThuc', 'trachNhiem', 'khaiPhong')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index if not exists profiles_unit_idx on public.profiles (unit);
create index if not exists profiles_house_idx on public.profiles (house);

create table if not exists public.player_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  xp int not null default 0 check (xp >= 0),
  coins int not null default 50 check (coins >= 0),
  owned text[] not null default '{}',
  equipped jsonb not null default '{}',
  streak_count int not null default 0,
  streak_last date,
  total_answered int not null default 0,
  total_correct int not null default 0,
  quiz_rounds int not null default 0,
  distance numeric not null default 0,
  hearts_received int not null default 0,
  thanks_received int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists player_state_xp_idx on public.player_state (xp desc);
-- Thú cưng (thêm sau → dùng add column để bảng cũ cũng có cột mới).
alter table public.player_state add column if not exists pets text[] not null default '{}';
alter table public.player_state add column if not exists active_pet text;
alter table public.player_state add column if not exists egg_progress int not null default 0;

create table if not exists public.daily_counters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  checked_in boolean not null default false,
  quiz_rounds int not null default 0,      -- số lượt quiz CÓ THƯỞNG đã bắt đầu
  quiz_finished int not null default 0,    -- số lượt quiz đã hoàn thành (cho nhiệm vụ)
  run_questions int not null default 0,
  stations text[] not null default '{}',
  all_stations boolean not null default false,
  coin_pickups int not null default 0,
  gifts int not null default 0,
  distance numeric not null default 0,
  distance_at_run_q numeric not null default 0,
  thanks_sent int not null default 0,
  hearts_sent int not null default 0,
  chest_claimed boolean not null default false,
  last_coin_at timestamptz,
  last_gift_at timestamptz,
  last_distance_at timestamptz,
  primary key (user_id, day)
);

create table if not exists public.quiz_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  rewarded boolean not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  correct int,
  total int
);

-- Mỗi câu hỏi phát ra là một "vé"; đáp án đúng chỉ nằm ở máy chủ.
create table if not exists public.question_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id bigint references public.questions (id) on delete set null,
  correct_index int not null,
  kind text not null check (kind in ('round', 'run', 'station')),
  station text,
  round_id uuid references public.quiz_rounds (id) on delete cascade,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  chosen int,
  correct boolean
);
create index if not exists tickets_user_idx on public.question_tickets (user_id, created_at desc);
create index if not exists tickets_round_idx on public.question_tickets (round_id);

-- Nhật ký thưởng: dùng cho bảng xếp hạng tuần/tháng, điểm Nhà, thống kê.
create table if not exists public.reward_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  xp int not null default 0,
  coins int not null default 0,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists reward_log_time_idx on public.reward_log (created_at);
create index if not exists reward_log_user_time_idx on public.reward_log (user_id, created_at);

create table if not exists public.kudos (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('heart', 'thanks')),
  message text,
  day date not null,
  created_at timestamptz not null default now()
);
create index if not exists kudos_to_idx on public.kudos (to_user, created_at desc);
create unique index if not exists kudos_once_per_day on public.kudos (from_user, to_user, kind, day);

create table if not exists public.vouchers (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'redeemed', 'rejected')),
  note text,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists vouchers_user_idx on public.vouchers (user_id);
create index if not exists vouchers_status_idx on public.vouchers (status);

-- Cửa hàng đổi Xu lấy quà hiện vật (sổ tay, bình nước, áo VA…). Admin sửa giá / số lượng.
create table if not exists public.gift_catalog (
  id text primary key,
  name text not null,
  icon text not null default '🎁',
  description text,
  cost int not null check (cost > 0),
  stock int check (stock is null or stock >= 0), -- null = không giới hạn
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Phiếu quà đổi từ cửa hàng: nhớ món, số Xu đã trừ (để hoàn lại khi BGH không duyệt).
alter table public.vouchers add column if not exists source text not null default 'grant';
alter table public.vouchers add column if not exists gift_id text references public.gift_catalog (id) on delete set null;
alter table public.vouchers add column if not exists coins_spent int not null default 0;
alter table public.vouchers add column if not exists refunded boolean not null default false;

-- Cúp Kỳ Lân hằng tháng (GĐ3): lưu Nhà thắng của mỗi tháng đã kết thúc.
create table if not exists public.house_cups (
  month date primary key,
  house text not null,
  points int not null,
  standings jsonb not null,
  created_at timestamptz not null default now()
);

-- ── Bảo mật hàng (RLS): người chơi KHÔNG ghi trực tiếp; mọi thay đổi qua hàm RPC. ──
alter table public.game_settings enable row level security;
alter table public.ranks enable row level security;
alter table public.items enable row level security;
alter table public.questions enable row level security;
alter table public.profiles enable row level security;
alter table public.player_state enable row level security;
alter table public.daily_counters enable row level security;
alter table public.quiz_rounds enable row level security;
alter table public.question_tickets enable row level security;
alter table public.reward_log enable row level security;
alter table public.kudos enable row level security;
alter table public.vouchers enable row level security;
alter table public.house_cups enable row level security;
alter table public.gift_catalog enable row level security;


-- >>> 02_helpers.sql
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


-- >>> 03_player_rpc.sql
-- ════════════════════════════════════════════════════════════════════════
-- Hàm người chơi gọi (RPC). Mọi luật thưởng & giới hạn nằm ở đây — máy chủ quyết định.
-- Mỗi hàm thay đổi dữ liệu trả về { ..., state } để trình duyệt cập nhật ngay.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.get_my_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  -- Hồ sơ có thể chưa tồn tại nếu tài khoản được tạo trước khi chạy setup.sql.
  if auth.uid() is not null and not exists (select 1 from profiles where id = auth.uid()) then
    perform public._ensure_profile(
      auth.uid(),
      (select email from auth.users where id = auth.uid()),
      (select coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name') from auth.users where id = auth.uid())
    );
  end if;
  v_uid := public._require_player();
  update profiles set last_seen_at = now() where id = v_uid;
  return public._state_json(v_uid);
end;
$$;

create or replace function public.update_profile(p_display_name text, p_unit text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  v_name text := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  v_unit text := btrim(regexp_replace(coalesce(p_unit, ''), '\s+', ' ', 'g'));
begin
  if length(v_name) < 2 or length(v_name) > 24 then raise exception 'invalid_display_name'; end if;
  if length(v_unit) < 1 or length(v_unit) > 24 then raise exception 'invalid_unit'; end if;
  update profiles set display_name = v_name, unit = v_unit where id = v_uid;
  return jsonb_build_object('state', public._state_json(v_uid));
end;
$$;

-- ── Điểm danh ─────────────────────────────────────────────────────────────
create or replace function public.claim_checkin()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
  s player_state;
  v_streak int;
  v_bonus int;
  r jsonb;
begin
  if d.checked_in then
    return jsonb_build_object('result', null, 'state', public._state_json(v_uid));
  end if;
  select * into s from player_state where user_id = v_uid for update;
  v_streak := case
    when s.streak_last = public._today() - 1 then s.streak_count + 1
    when s.streak_last = public._today() then s.streak_count
    else 1
  end;
  update player_state set streak_count = v_streak, streak_last = public._today() where user_id = v_uid;
  update daily_counters set checked_in = true where user_id = v_uid and day = d.day;
  v_bonus := least(v_streak, public._cfgn('CHECK_IN', 'STREAK_BONUS_MAX_DAYS', 7)::int)
    * public._cfgn('CHECK_IN', 'STREAK_BONUS_COINS_PER_DAY', 2)::int;
  r := public._apply_reward(
    v_uid,
    public._cfgn('CHECK_IN', 'XP', 20)::int,
    public._cfgn('CHECK_IN', 'COINS', 15)::int + v_bonus,
    'checkin',
    jsonb_build_object('streak', v_streak)
  );
  r := r || jsonb_build_object('streak', v_streak, 'egg', public._egg_tick(v_uid));
  return jsonb_build_object('result', r, 'state', public._state_json(v_uid));
end;
$$;

-- ── Phát câu hỏi (vé) ─────────────────────────────────────────────────────
create or replace function public._pick_question(p_uid uuid, p_station text, p_exclude bigint[] default '{}')
returns public.questions language plpgsql security definer set search_path = public as $$
declare v_q questions;
begin
  select * into v_q from questions q
  where q.status = 'approved'
    and (p_station is null or q.value = p_station or (p_station = 'triThuc' and q.topic = 'general'))
    and not (q.id = any (p_exclude))
    and q.id not in (
      select t.question_id from question_tickets t
      where t.user_id = p_uid and t.question_id is not null
      order by t.created_at desc limit 25
    )
  order by random() limit 1;
  if not found then
    select * into v_q from questions q
    where q.status = 'approved'
      and (p_station is null or q.value = p_station or (p_station = 'triThuc' and q.topic = 'general'))
      and not (q.id = any (p_exclude))
    order by random() limit 1;
  end if;
  if not found then raise exception 'no_questions'; end if;
  return v_q;
end;
$$;

-- Xáo đáp án, lưu vị trí đúng ở máy chủ, trả câu hỏi KHÔNG kèm đáp án.
create or replace function public._issue_ticket(p_uid uuid, p_q public.questions, p_kind text, p_station text, p_round uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_n int := array_length(p_q.options, 1);
  v_perm int[];
  v_opts text[];
  v_id uuid;
begin
  select array_agg(i order by random()) into v_perm from generate_series(1, v_n) i;
  select array_agg(p_q.options[v_perm[k]] order by k) into v_opts from generate_series(1, v_n) k;
  insert into question_tickets (user_id, question_id, correct_index, kind, station, round_id)
  values (p_uid, p_q.id, array_position(v_perm, 1) - 1, p_kind, p_station, p_round)
  returning id into v_id;
  return jsonb_build_object('ticketId', v_id, 'topic', p_q.topic, 'q', p_q.q, 'options', to_jsonb(v_opts));
end;
$$;

-- Câu hỏi dọc đường ('run') hoặc thử thách cột Vùng Đất ('station').
create or replace function public.issue_question(p_kind text, p_station text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
  v_every numeric := public._cfgn('EXPLORE', 'QUESTION_EVERY_M', 100);
begin
  if p_kind = 'run' then
    -- Phải thật sự chạy đủ quãng đường (máy chủ đếm qua add_distance).
    if d.distance - d.distance_at_run_q < v_every * 0.8 then
      raise exception 'not_enough_distance';
    end if;
    update daily_counters set distance_at_run_q = d.distance where user_id = v_uid and day = d.day;
    return public._issue_ticket(v_uid, public._pick_question(v_uid, null), 'run', null, null);
  elsif p_kind = 'station' then
    if p_station not in ('nhanAi', 'banLinh', 'triThuc', 'trachNhiem', 'khaiPhong') then
      raise exception 'invalid_station';
    end if;
    if p_station = any (d.stations) then
      return jsonb_build_object('done', true);
    end if;
    return public._issue_ticket(v_uid, public._pick_question(v_uid, p_station), 'station', p_station, null);
  end if;
  raise exception 'invalid_kind';
end;
$$;

-- ── Quiz Tri Thức (lượt 5 câu) ────────────────────────────────────────────
create or replace function public.start_quiz_round()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
  v_rewarded boolean := d.quiz_rounds < public._cfgn('QUIZ', 'REWARDED_ROUNDS_PER_DAY', 3);
  v_round uuid;
  v_n int := public._cfgn('QUIZ', 'QUESTIONS_PER_ROUND', 5)::int;
  v_questions jsonb := '[]';
  v_used bigint[] := '{}';
  v_q questions;
begin
  if v_rewarded then
    update daily_counters set quiz_rounds = quiz_rounds + 1 where user_id = v_uid and day = d.day;
  end if;
  insert into quiz_rounds (user_id, day, rewarded) values (v_uid, d.day, v_rewarded) returning id into v_round;
  for i in 1..v_n loop
    v_q := public._pick_question(v_uid, null, v_used);
    v_used := array_append(v_used, v_q.id);
    v_questions := v_questions || public._issue_ticket(v_uid, v_q, 'round', null, v_round);
  end loop;
  return jsonb_build_object(
    'roundId', v_round,
    'rewarded', v_rewarded,
    'timeLimit', public._cfgn('QUIZ', 'TIME_LIMIT_SEC', 180),
    'questions', v_questions,
    'state', public._state_json(v_uid)
  );
end;
$$;

-- Trả lời một vé. Vé lượt quiz: chưa thưởng (tính khi kết thúc lượt).
create or replace function public.answer_ticket(p_ticket uuid, p_choice int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  t question_tickets;
  d daily_counters;
  v_correct boolean;
  v_explain text;
  v_reward jsonb := null;
  v_all jsonb := null;
  v_stations text[];
begin
  select * into t from question_tickets where id = p_ticket and user_id = v_uid for update;
  if not found then raise exception 'ticket_not_found'; end if;
  if t.answered_at is not null then raise exception 'already_answered'; end if;
  if now() - t.created_at > interval '15 minutes' then raise exception 'ticket_expired'; end if;

  v_correct := p_choice = t.correct_index;
  update question_tickets set answered_at = now(), chosen = p_choice, correct = v_correct where id = t.id;
  update player_state
    set total_answered = total_answered + 1, total_correct = total_correct + v_correct::int
    where user_id = v_uid;
  select explain into v_explain from questions where id = t.question_id;

  if t.kind = 'run' then
    d := public._daily(v_uid);
    if d.run_questions < public._cfgn('EXPLORE', 'RUN_QUESTIONS_REWARDED_PER_DAY', 6) then
      update daily_counters set run_questions = run_questions + 1 where user_id = v_uid and day = d.day;
      v_reward := case when v_correct
        then public._apply_reward(v_uid, public._cfgn('EXPLORE', 'RUN_QUESTION_XP', 5)::int, public._cfgn('EXPLORE', 'RUN_QUESTION_COINS', 3)::int, 'run_question')
        else public._apply_reward(v_uid, public._cfgn('EXPLORE', 'RUN_QUESTION_TRY_XP', 1)::int, 0, 'run_question')
      end || jsonb_build_object('rewarded', true);
    else
      v_reward := public._no_reward() || jsonb_build_object('rewarded', false);
    end if;
  elsif t.kind = 'station' then
    d := public._daily(v_uid);
    if t.station = any (d.stations) then
      v_reward := public._no_reward() || jsonb_build_object('rewarded', false);
    else
      update daily_counters set stations = array_append(stations, t.station)
        where user_id = v_uid and day = d.day
        returning stations into v_stations;
      v_reward := case when v_correct
        then public._apply_reward(v_uid, public._cfgn('EXPLORE', 'STATION_XP', 10)::int, public._cfgn('EXPLORE', 'STATION_COINS', 8)::int, 'station', jsonb_build_object('station', t.station))
        else public._apply_reward(v_uid, public._cfgn('EXPLORE', 'STATION_TRY_XP', 3)::int, 0, 'station', jsonb_build_object('station', t.station))
      end || jsonb_build_object('rewarded', true);
      if array_length(v_stations, 1) >= 5 and not d.all_stations then
        update daily_counters set all_stations = true where user_id = v_uid and day = d.day;
        v_all := public._apply_reward(v_uid, public._cfgn('EXPLORE', 'ALL_STATIONS_XP', 25)::int, public._cfgn('EXPLORE', 'ALL_STATIONS_COINS', 25)::int, 'all_stations');
      end if;
      v_reward := v_reward || jsonb_build_object('allStations', v_all);
    end if;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'correctIndex', t.correct_index,
    'explain', v_explain,
    'reward', v_reward,
    'state', public._state_json(v_uid)
  );
end;
$$;

create or replace function public.finish_quiz_round(p_round uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  r quiz_rounds;
  v_limit numeric := public._cfgn('QUIZ', 'TIME_LIMIT_SEC', 180);
  v_correct int;
  v_total int;
  v_wrong int;
  v_perfect boolean;
  v_res jsonb;
begin
  select * into r from quiz_rounds where id = p_round and user_id = v_uid for update;
  if not found then raise exception 'round_not_found'; end if;
  if r.finished_at is not null then raise exception 'already_finished'; end if;

  select count(*) filter (where correct and answered_at <= r.started_at + make_interval(secs => v_limit + 20)),
         count(*)
    into v_correct, v_total
    from question_tickets where round_id = r.id;
  v_wrong := v_total - v_correct;
  v_perfect := v_total > 0 and v_correct = v_total;

  update quiz_rounds set finished_at = now(), correct = v_correct, total = v_total where id = r.id;
  update player_state set quiz_rounds = quiz_rounds + 1 where user_id = v_uid;
  update daily_counters set quiz_finished = quiz_finished + 1 where user_id = v_uid and day = public._today();

  if r.rewarded then
    v_res := public._apply_reward(
      v_uid,
      v_correct * public._cfgn('QUIZ', 'XP_PER_CORRECT', 10)::int
        + v_wrong * public._cfgn('QUIZ', 'XP_PER_TRY', 2)::int
        + case when v_perfect then public._cfgn('QUIZ', 'PERFECT_BONUS_XP', 20)::int else 0 end,
      v_correct * public._cfgn('QUIZ', 'COINS_PER_CORRECT', 5)::int
        + case when v_perfect then public._cfgn('QUIZ', 'PERFECT_BONUS_COINS', 10)::int else 0 end,
      'quiz',
      jsonb_build_object('correct', v_correct, 'total', v_total)
    );
  else
    v_res := public._no_reward();
  end if;
  return jsonb_build_object(
    'result', v_res || jsonb_build_object('rewarded', r.rewarded, 'perfect', v_perfect, 'correct', v_correct, 'total', v_total),
    'state', public._state_json(v_uid)
  );
end;
$$;

-- ── Khám phá: quãng đường, xu, hộp quà ────────────────────────────────────
create or replace function public.add_distance(p_meters numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
  v_secs numeric := extract(epoch from now() - coalesce(d.last_distance_at, now() - interval '5 seconds'));
  -- Không thể chạy nhanh hơn tốc độ chạy tối đa (chống gửi quãng đường giả).
  v_max numeric := public._cfgn('EXPLORE', 'RUN_SPEED', 7.5) * 1.3 * least(v_secs, 60) + 3;
  v_add numeric := greatest(0, least(coalesce(p_meters, 0), v_max, 500));
begin
  update daily_counters set distance = distance + v_add, last_distance_at = now()
    where user_id = v_uid and day = d.day;
  update player_state set distance = distance + v_add where user_id = v_uid;
  return jsonb_build_object('added', v_add, 'state', public._state_json(v_uid));
end;
$$;

create or replace function public.collect_coin()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
begin
  if d.coin_pickups >= public._cfgn('EXPLORE', 'COIN_PICKUPS_PER_DAY', 40)
     or d.last_coin_at > now() - interval '200 milliseconds' then
    return jsonb_build_object('ok', false, 'state', public._state_json(v_uid));
  end if;
  update daily_counters set coin_pickups = coin_pickups + 1, last_coin_at = now() where user_id = v_uid and day = d.day;
  update player_state set coins = coins + 1 where user_id = v_uid;
  return jsonb_build_object('ok', true, 'state', public._state_json(v_uid));
end;
$$;

create or replace function public.open_gift()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
  v_roll numeric := random();
  v_coin numeric := public._cfgn('EXPLORE', 'GIFT_COIN_CHANCE', 0.6);
  v_xpc numeric := public._cfgn('EXPLORE', 'GIFT_XP_CHANCE', 0.3);
  v_kind text;
  v_amount int := 0;
  v_item record;
  v_item_json jsonb := null;
  v_voucher jsonb := null;
  v_reward jsonb;
begin
  if d.gifts >= public._cfgn('EXPLORE', 'GIFTS_PER_DAY', 5)
     or d.last_gift_at > now() - make_interval(secs => public._cfgn('EXPLORE', 'GIFT_INTERVAL_SEC', 60) * 0.4) then
    return jsonb_build_object('result', null, 'state', public._state_json(v_uid));
  end if;
  update daily_counters set gifts = gifts + 1, last_gift_at = now() where user_id = v_uid and day = d.day;

  if random() < public._cfgn('VOUCHER', 'GIFT_CHANCE', 0) then
    insert into vouchers (user_id, title, reason)
    values (v_uid, coalesce(public._cfg('VOUCHER') ->> 'GIFT_TITLE', 'Phiếu quà may mắn'), 'Hộp quà bất ngờ')
    returning jsonb_build_object('id', id, 'title', title, 'status', status) into v_voucher;
    v_kind := 'voucher';
    v_reward := public._no_reward();
  elsif v_roll >= v_coin + v_xpc then
    select i.id, i.name into v_item from items i, player_state s
    where s.user_id = v_uid and i.price > 0 and i.rank_id is null and not (i.id = any (s.owned))
    order by random() limit 1;
    if found then
      update player_state set owned = array_append(owned, v_item.id) where user_id = v_uid;
      v_kind := 'item';
      v_item_json := jsonb_build_object('id', v_item.id, 'name', v_item.name);
      v_reward := public._no_reward();
    end if;
  end if;

  if v_kind is null and v_roll < v_coin + v_xpc and v_roll >= v_coin then
    v_kind := 'xp';
    v_reward := public._apply_reward(v_uid, 5 + floor(random() * 8)::int, 0, 'gift');
    v_amount := (v_reward ->> 'xp')::int;
  elsif v_kind is null then
    v_kind := 'coins';
    v_amount := 5 + floor(random() * 11)::int;
    v_reward := public._apply_reward(v_uid, 0, v_amount, 'gift');
  end if;

  return jsonb_build_object(
    'result', jsonb_build_object('kind', v_kind, 'amount', v_amount, 'item', v_item_json, 'voucher', v_voucher, 'reward', v_reward),
    'state', public._state_json(v_uid)
  );
end;
$$;

-- ── Tủ đồ ─────────────────────────────────────────────────────────────────
create or replace function public.buy_item(p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  i items;
  s player_state;
begin
  select * into i from items where id = p_item;
  if not found or i.rank_id is not null then raise exception 'item_not_buyable'; end if;
  select * into s from player_state where user_id = v_uid for update;
  if p_item = any (s.owned) then raise exception 'already_owned'; end if;
  if s.coins < i.price then raise exception 'not_enough_coins'; end if;
  update player_state set coins = coins - i.price, owned = array_append(owned, i.id) where user_id = v_uid;
  insert into reward_log (user_id, kind, xp, coins, meta) values (v_uid, 'buy', 0, -i.price, jsonb_build_object('item', i.id));
  return jsonb_build_object('ok', true, 'state', public._state_json(v_uid));
end;
$$;

create or replace function public.equip_item(p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  i items;
begin
  select * into i from items where id = p_item;
  if not found then raise exception 'item_not_found'; end if;
  if not exists (select 1 from player_state where user_id = v_uid and p_item = any (owned)) then
    raise exception 'not_owned';
  end if;
  update player_state set equipped = jsonb_set(equipped, array[i.slot], to_jsonb(i.id)) where user_id = v_uid;
  return jsonb_build_object('ok', true, 'state', public._state_json(v_uid));
end;
$$;

-- ── Nhiệm vụ hằng ngày ────────────────────────────────────────────────────
create or replace function public.claim_mission_chest()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
  r jsonb;
begin
  if d.chest_claimed or exists (
    select 1 from jsonb_array_elements(public._missions_status(d)) m where not (m ->> 'done')::boolean
  ) then
    return jsonb_build_object('result', null, 'state', public._state_json(v_uid));
  end if;
  update daily_counters set chest_claimed = true where user_id = v_uid and day = d.day;
  r := public._apply_reward(v_uid, public._cfgn('MISSIONS', 'CHEST_XP', 30)::int, public._cfgn('MISSIONS', 'CHEST_COINS', 30)::int, 'chest');
  return jsonb_build_object('result', r, 'state', public._state_json(v_uid));
end;
$$;


-- >>> 04_social_rpc.sql
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
      'pet', s.active_pet,
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
    'pet', s.active_pet,
    'petCount', coalesce(array_length(s.pets, 1), 0),
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
    select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'reason', reason, 'status', status, 'note', note, 'at', created_at,
      'source', source, 'coinsSpent', coins_spent, 'refunded', refunded) order by created_at desc)
    from vouchers where user_id = v_uid
  ), '[]');
end;
$$;


-- >>> 05_staff_rpc.sql
-- ════════════════════════════════════════════════════════════════════════
-- Quản trị (trang admin.html): giáo viên soạn câu hỏi; BGH/admin duyệt câu hỏi,
-- quản lý người chơi, phiếu quà, xem thống kê.
-- Vai trò (từ cao xuống thấp): admin › bgh › teacher › player.
-- ════════════════════════════════════════════════════════════════════════

-- ── Câu hỏi ───────────────────────────────────────────────────────────────
create or replace function public.staff_list_questions(
  p_status text default null, p_search text default null, p_topic text default null,
  p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := public._require_staff();
  v_manager boolean := public.is_manager();
begin
  return (
    with f as (
      select q.*, coalesce(p.display_name, p.full_name) as author
      from questions q left join profiles p on p.id = q.created_by
      where (p_status is null or q.status = p_status)
        and (p_topic is null or q.topic = p_topic)
        and (p_search is null or q.q ilike '%' || p_search || '%')
        -- Giáo viên thấy câu đã duyệt + câu của chính mình.
        and (v_manager or q.status = 'approved' or q.created_by = v_uid)
    )
    select jsonb_build_object(
      'total', (select count(*) from f),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
          'id', id, 'topic', topic, 'value', value, 'q', q, 'options', to_jsonb(options), 'explain', explain,
          'status', status, 'author', author, 'mine', created_by = v_uid, 'createdAt', created_at
        ) order by created_at desc) from (select * from f order by created_at desc limit least(p_limit, 200) offset p_offset) t), '[]')
    )
  );
end;
$$;

-- Thêm (p_id null) hoặc sửa câu hỏi. options[1] là đáp án đúng.
-- Giáo viên: câu mới/sửa → "chờ duyệt"; BGH/admin: duyệt luôn.
create or replace function public.staff_save_question(
  p_id bigint, p_topic text, p_value text, p_q text, p_options text[], p_explain text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_staff();
  v_manager boolean := public.is_manager();
  v_status text := case when v_manager then 'approved' else 'pending' end;
  v_opts text[] := array(select btrim(o) from unnest(p_options) o where btrim(o) <> '');
  v_id bigint;
  v_owner uuid;
begin
  if length(btrim(coalesce(p_q, ''))) < 5 then raise exception 'question_too_short'; end if;
  if array_length(v_opts, 1) is null or array_length(v_opts, 1) < 2 then raise exception 'need_two_options'; end if;
  if p_id is null then
    insert into questions (topic, value, q, options, explain, status, created_by, reviewed_by)
    values (p_topic, nullif(p_value, ''), btrim(p_q), v_opts, nullif(btrim(coalesce(p_explain, '')), ''), v_status, v_uid,
            case when v_manager then v_uid end)
    returning id into v_id;
  else
    select created_by into v_owner from questions where id = p_id;
    if not found then raise exception 'question_not_found'; end if;
    if not v_manager and v_owner is distinct from v_uid then raise exception 'forbidden'; end if;
    update questions set topic = p_topic, value = nullif(p_value, ''), q = btrim(p_q), options = v_opts,
      explain = nullif(btrim(coalesce(p_explain, '')), ''), status = v_status, updated_at = now(),
      reviewed_by = case when v_manager then v_uid else null end
    where id = p_id returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;

create or replace function public.staff_review_question(p_id bigint, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_manager();
begin
  if p_status not in ('approved', 'rejected', 'pending') then raise exception 'invalid_status'; end if;
  update questions set status = p_status, reviewed_by = v_uid, updated_at = now() where id = p_id;
  if not found then raise exception 'question_not_found'; end if;
  return jsonb_build_object('id', p_id, 'status', p_status);
end;
$$;

create or replace function public.staff_delete_question(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_staff();
  q questions;
begin
  select * into q from questions where id = p_id;
  if not found then raise exception 'question_not_found'; end if;
  if not public.is_manager() and not (q.created_by = v_uid and q.status <> 'approved') then
    raise exception 'forbidden';
  end if;
  delete from questions where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── Thống kê tổng quan (Tổng quan → Phân tích → Chi tiết) ─────────────────
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_staff();
  return jsonb_build_object(
    'players', (select count(*) from profiles),
    'activeToday', (select count(distinct user_id) from daily_counters where day = public._today()),
    'active7d', (select count(distinct user_id) from daily_counters where day > public._today() - 7),
    'xpToday', (select coalesce(sum(xp), 0) from reward_log where created_at >= public._today()::timestamp at time zone 'Asia/Ho_Chi_Minh'),
    'answersToday', (select count(*) from question_tickets where answered_at >= public._today()::timestamp at time zone 'Asia/Ho_Chi_Minh'),
    'correctRateToday', (select coalesce(round(100.0 * count(*) filter (where correct) / nullif(count(*), 0)), 0)
                         from question_tickets where answered_at >= public._today()::timestamp at time zone 'Asia/Ho_Chi_Minh'),
    'questions', (select jsonb_object_agg(status, n) from (select status, count(*) n from questions group by status) t),
    'pendingVouchers', (select count(*) from vouchers where status = 'pending'),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', g.day, 'players', coalesce(c.n, 0)) order by g.day), '[]')
      from generate_series(public._today() - 13, public._today(), interval '1 day') g(day)
      left join (select day, count(distinct user_id) n from daily_counters where day > public._today() - 14 group by day) c
        on c.day = g.day::date
    ),
    'ranks', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'icon', r.icon, 'players', (
        select count(*) from player_state s where (public._rank_of(s.xp)).id = r.id)) order by r.sort), '[]')
      from ranks r
    ),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object('unit', unit, 'players', n, 'xp', xp) order by xp desc), '[]')
      from (select coalesce(p.unit, '(chưa đặt)') unit, count(*) n, sum(s.xp) xp
            from profiles p join player_state s on s.user_id = p.id group by 1 order by 3 desc limit 12) t
    ),
    'houses', public._house_points(public._period_start('month'), 'infinity')
  );
end;
$$;

-- ── Người chơi ────────────────────────────────────────────────────────────
create or replace function public.admin_list_players(
  p_search text default null, p_unit text default null, p_role text default null,
  p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_staff();
  return (
    with f as (
      select p.*, s.xp, s.coins, s.streak_count, s.streak_last, s.total_answered, s.total_correct
      from profiles p join player_state s on s.user_id = p.id
      where (p_search is null or p.email ilike '%' || p_search || '%' or p.full_name ilike '%' || p_search || '%'
             or p.display_name ilike '%' || p_search || '%')
        and (p_unit is null or p.unit = p_unit)
        and (p_role is null or p.role = p_role)
    )
    select jsonb_build_object(
      'total', (select count(*) from f),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
          'id', id, 'email', email, 'fullName', full_name, 'displayName', display_name, 'unit', unit,
          'role', role, 'house', house, 'xp', xp, 'coins', coins, 'rank', (public._rank_of(xp)).name,
          'streak', case when streak_last >= public._today() - 1 then streak_count else 0 end,
          'accuracy', case when total_answered > 0 then round(100.0 * total_correct / total_answered) else null end,
          'lastSeen', last_seen_at
        ) order by xp desc) from (select * from f order by xp desc limit least(p_limit, 200) offset p_offset) t), '[]')
    )
  );
end;
$$;

-- Chỉ admin cấp quyền admin/bgh; BGH cấp teacher/player. Không tự hạ quyền chính mình.
create or replace function public.admin_update_player(
  p_id uuid, p_display_name text default null, p_unit text default null, p_role text default null, p_house text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_manager();
  v_my_role text := public.my_role();
  v_target_role text;
begin
  select role into v_target_role from profiles where id = p_id;
  if not found then raise exception 'profile_not_found'; end if;
  if p_role is not null and p_role <> v_target_role then
    if p_id = v_uid then raise exception 'cannot_change_own_role'; end if;
    if v_my_role <> 'admin' and (p_role in ('admin', 'bgh') or v_target_role in ('admin', 'bgh')) then
      raise exception 'forbidden';
    end if;
  end if;
  update profiles set
    display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
    unit = coalesce(nullif(btrim(p_unit), ''), unit),
    role = coalesce(p_role, role),
    house = coalesce(p_house, house)
  where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── Phiếu quà hiện vật ────────────────────────────────────────────────────
create or replace function public.admin_list_vouchers(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id, 'title', v.title, 'reason', v.reason, 'status', v.status, 'note', v.note, 'at', v.created_at,
      'source', v.source, 'coinsSpent', v.coins_spent, 'refunded', v.refunded,
      'userId', v.user_id, 'name', coalesce(p.display_name, p.full_name), 'unit', p.unit, 'email', p.email
    ) order by v.created_at desc)
    from vouchers v join profiles p on p.id = v.user_id
    where p_status is null or v.status = p_status
  ), '[]');
end;
$$;

create or replace function public.admin_grant_voucher(p_user uuid, p_title text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_manager();
begin
  if length(btrim(coalesce(p_title, ''))) < 3 then raise exception 'invalid_title'; end if;
  insert into vouchers (user_id, title, reason, status, decided_by, decided_at)
  values (p_user, btrim(p_title), p_reason, 'approved', v_uid, now());
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_decide_voucher(p_id bigint, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_manager();
  v vouchers;
begin
  if p_status not in ('approved', 'rejected', 'redeemed') then raise exception 'invalid_status'; end if;
  select * into v from vouchers where id = p_id for update;
  if not found then raise exception 'voucher_not_found'; end if;
  update vouchers set status = p_status, note = coalesce(p_note, note), decided_by = v_uid, decided_at = now() where id = p_id;
  -- Phiếu đổi bằng Xu bị từ chối → hoàn Xu (một lần) và trả lại số lượng quà.
  if p_status = 'rejected' and v.coins_spent > 0 and not v.refunded then
    update vouchers set refunded = true where id = p_id;
    update player_state set coins = coins + v.coins_spent, updated_at = now() where user_id = v.user_id;
    insert into reward_log (user_id, kind, xp, coins, meta)
    values (v.user_id, 'gift_refund', 0, v.coins_spent, jsonb_build_object('voucher', p_id));
    update gift_catalog set stock = stock + 1 where id = v.gift_id and stock is not null;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── Cài đặt ───────────────────────────────────────────────────────────────
create or replace function public.admin_set_allowed_domains(p_domains text[])
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._require_manager();
  if public.my_role() <> 'admin' then raise exception 'forbidden'; end if;
  insert into game_settings (key, value) values ('ALLOWED_EMAIL_DOMAINS', to_jsonb(p_domains))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

-- Người đầu tiên chạy hàm này (khi chưa có admin nào) trở thành admin.
-- Sau đó hàm không còn tác dụng — an toàn để để lại.
create or replace function public.claim_first_admin()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_player();
begin
  if exists (select 1 from profiles where role = 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'admin_exists');
  end if;
  update profiles set role = 'admin' where id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;


-- >>> 07_gift_shop.sql
-- ════════════════════════════════════════════════════════════════════════
-- Cửa hàng đổi Xu lấy Phiếu quà hiện vật
-- Người chơi đổi → trừ Xu, giữ chỗ 1 món, tạo phiếu "Chờ duyệt". BGH duyệt → "Chờ trao" → "Đã trao".
-- BGH không duyệt → hoàn Xu tự động (admin_decide_voucher).
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists "đọc danh mục quà" on public.gift_catalog;
create policy "đọc danh mục quà" on public.gift_catalog for select to authenticated using (true);

-- Danh mục quà đang mở + giới hạn của người chơi.
create or replace function public.gift_shop()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._require_player();
begin
  return jsonb_build_object(
    'gifts', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'icon', icon, 'description', description, 'cost', cost, 'stock', stock)
        order by sort, cost)
      from gift_catalog where active
    ), '[]'),
    'pending', (select count(*) from vouchers where user_id = v_uid and source = 'shop' and status = 'pending'),
    'thisMonth', (select count(*) from vouchers where user_id = v_uid and source = 'shop' and status <> 'rejected'
                   and created_at >= date_trunc('month', public._now_vn()) at time zone 'Asia/Ho_Chi_Minh'),
    'maxPending', public._cfgn('GIFT_SHOP', 'MAX_PENDING', 2),
    'monthlyLimit', public._cfgn('GIFT_SHOP', 'MONTHLY_LIMIT', 3)
  );
end;
$$;

create or replace function public.redeem_gift(p_gift text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  g gift_catalog;
  s player_state;
  v_pending int;
  v_month int;
  v_id bigint;
begin
  select * into s from player_state where user_id = v_uid for update;
  select * into g from gift_catalog where id = p_gift and active for update;
  if not found then raise exception 'gift_not_found'; end if;
  if g.stock is not null and g.stock <= 0 then raise exception 'gift_out_of_stock'; end if;

  select count(*) into v_pending from vouchers where user_id = v_uid and source = 'shop' and status = 'pending';
  if v_pending >= public._cfgn('GIFT_SHOP', 'MAX_PENDING', 2) then raise exception 'too_many_pending'; end if;
  select count(*) into v_month from vouchers where user_id = v_uid and source = 'shop' and status <> 'rejected'
    and created_at >= date_trunc('month', public._now_vn()) at time zone 'Asia/Ho_Chi_Minh';
  if v_month >= public._cfgn('GIFT_SHOP', 'MONTHLY_LIMIT', 3) then raise exception 'monthly_limit'; end if;
  if s.coins < g.cost then raise exception 'not_enough_coins'; end if;

  update player_state set coins = coins - g.cost, updated_at = now() where user_id = v_uid;
  update gift_catalog set stock = stock - 1 where id = g.id and stock is not null;
  insert into vouchers (user_id, title, reason, status, source, gift_id, coins_spent)
  values (v_uid, g.icon || ' ' || g.name, 'Đổi bằng ' || g.cost || ' Xu', 'pending', 'shop', g.id, g.cost)
  returning id into v_id;
  insert into reward_log (user_id, kind, xp, coins, meta)
  values (v_uid, 'gift_redeem', 0, -g.cost, jsonb_build_object('gift', g.id, 'voucher', v_id));
  return jsonb_build_object('ok', true, 'voucherId', v_id, 'state', public._state_json(v_uid));
end;
$$;

-- ── Quản lý danh mục (BGH / Quản trị) ─────────────────────────────────────
create or replace function public.admin_list_gifts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'icon', g.icon, 'description', g.description, 'cost', g.cost, 'stock', g.stock,
      'active', g.active, 'sort', g.sort,
      'redeemed', (select count(*) from vouchers v where v.gift_id = g.id and v.status <> 'rejected')
    ) order by g.sort, g.cost)
    from gift_catalog g
  ), '[]');
end;
$$;

create or replace function public.admin_save_gift(
  p_id text, p_name text, p_icon text, p_description text, p_cost int, p_stock int, p_active boolean, p_sort int default 0
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id text := nullif(btrim(coalesce(p_id, '')), '');
begin
  perform public._require_manager();
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if coalesce(p_cost, 0) <= 0 then raise exception 'invalid_cost'; end if;
  if p_stock is not null and p_stock < 0 then raise exception 'invalid_stock'; end if;
  v_id := coalesce(v_id, 'gift-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into gift_catalog (id, name, icon, description, cost, stock, active, sort)
  values (v_id, btrim(p_name), coalesce(nullif(btrim(p_icon), ''), '🎁'), nullif(btrim(coalesce(p_description, '')), ''),
          p_cost, p_stock, coalesce(p_active, true), coalesce(p_sort, 0))
  on conflict (id) do update set name = excluded.name, icon = excluded.icon, description = excluded.description,
    cost = excluded.cost, stock = excluded.stock, active = excluded.active, sort = excluded.sort;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;


-- >>> 08_pets.sql
-- ════════════════════════════════════════════════════════════════════════
-- Thú cưng: mỗi lần điểm danh ấp trứng thêm 1 ngày; đủ PETS.EGG_DAYS → nở một bạn chưa có
-- (chọn ngẫu nhiên theo trọng số độ hiếm trong PET_CATALOG). Có đủ rồi → nở ra Xu.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public._egg_tick(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s player_state;
  v_need int := public._cfgn('PETS', 'EGG_DAYS', 3)::int;
  v_pick jsonb;
  v_coins int;
begin
  select * into s from player_state where user_id = p_uid for update;
  if s.egg_progress + 1 < v_need then
    update player_state set egg_progress = egg_progress + 1 where user_id = p_uid;
    return jsonb_build_object('progress', s.egg_progress + 1, 'need', v_need, 'hatched', null);
  end if;

  -- Bốc thăm có trọng số (khoá -ln(u)/w nhỏ nhất thắng).
  select p into v_pick
  from jsonb_array_elements(public._cfg('PET_CATALOG')) p
  where not ((p ->> 'id') = any (s.pets))
  order by -ln(greatest(random(), 1e-9)) / greatest((p ->> 'weight')::numeric, 0.0001)
  limit 1;

  update player_state set egg_progress = 0 where user_id = p_uid;
  if v_pick is null then
    v_coins := public._cfgn('PETS', 'DUPLICATE_COINS', 40)::int;
    perform public._apply_reward(p_uid, 0, v_coins, 'egg', null);
    return jsonb_build_object('progress', 0, 'need', v_need, 'hatched', null, 'coins', v_coins);
  end if;
  update player_state
    set pets = array_append(pets, v_pick ->> 'id'), active_pet = coalesce(active_pet, v_pick ->> 'id')
    where user_id = p_uid;
  return jsonb_build_object('progress', 0, 'need', v_need,
    'hatched', jsonb_build_object('id', v_pick ->> 'id', 'name', v_pick ->> 'name', 'rarity', v_pick ->> 'rarity'));
end;
$$;

-- Dắt thú cưng đi cùng (p_pet = null → cho thú cưng nghỉ).
create or replace function public.equip_pet(p_pet text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_player();
begin
  if nullif(p_pet, '') is not null and not exists (
    select 1 from player_state where user_id = v_uid and p_pet = any (pets)
  ) then
    raise exception 'pet_not_owned';
  end if;
  update player_state set active_pet = nullif(p_pet, '') where user_id = v_uid;
  return jsonb_build_object('ok', true, 'state', public._state_json(v_uid));
end;
$$;


-- ── Dữ liệu ban đầu (sinh tự động từ src/ — đừng sửa tay) ──
insert into public.game_settings (key, value) values ('QUIZ', '{"QUESTIONS_PER_ROUND":5,"TIME_LIMIT_SEC":180,"XP_PER_CORRECT":10,"COINS_PER_CORRECT":5,"XP_PER_TRY":2,"PERFECT_BONUS_XP":20,"PERFECT_BONUS_COINS":10,"REWARDED_ROUNDS_PER_DAY":3}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('CHECK_IN', '{"XP":20,"COINS":15,"STREAK_BONUS_COINS_PER_DAY":2,"STREAK_BONUS_MAX_DAYS":7}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('GOLDEN_HOURS', '{"RANGES":[[12,13],[19,21]],"XP_MULTIPLIER":2}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('EXPLORE', '{"WALK_SPEED":4.2,"RUN_SPEED":7.5,"QUESTION_EVERY_M":100,"RUN_QUESTION_XP":5,"RUN_QUESTION_COINS":3,"RUN_QUESTION_TRY_XP":1,"RUN_QUESTIONS_REWARDED_PER_DAY":6,"STATION_XP":10,"STATION_COINS":8,"STATION_TRY_XP":3,"ALL_STATIONS_XP":25,"ALL_STATIONS_COINS":25,"COIN_PICKUPS_PER_DAY":40,"COIN_RESPAWN_SEC":45,"COINS_ON_MAP":18,"GIFTS_PER_DAY":5,"GIFT_INTERVAL_SEC":60,"GIFT_COIN_CHANCE":0.6,"GIFT_XP_CHANCE":0.3}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('MISSIONS', '{"PER_DAY":3,"CATALOG":[{"id":"checkin","label":"Điểm danh hôm nay","counter":"checkedIn","target":1},{"id":"quiz","label":"Hoàn thành 1 lượt Tri Thức","counter":"quizRounds","target":1},{"id":"stations","label":"Chinh phục 2 Vùng Đất","counter":"stationCount","target":2},{"id":"coins","label":"Nhặt 10 xu vàng","counter":"coinPickups","target":10},{"id":"distance","label":"Chạy 300 m","counter":"distance","target":300},{"id":"runq","label":"Trả lời 2 câu hỏi dọc đường","counter":"runQuestions","target":2},{"id":"gift","label":"Mở 1 hộp quà bất ngờ","counter":"gifts","target":1},{"id":"thanks","label":"Gửi 1 lời cảm ơn","counter":"thanksSent","target":1}],"CHEST_XP":30,"CHEST_COINS":30}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('KUDOS', '{"THANKS_PER_DAY":3,"THANKS_COINS_SENDER":5,"THANKS_COINS_RECEIVER":5,"HEARTS_PER_DAY":20,"MESSAGE_MAX":120}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('VOUCHER', '{"GIFT_CHANCE":0.01,"GIFT_TITLE":"Phiếu quà may mắn"}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('GIFT_SHOP', '{"MAX_PENDING":2,"MONTHLY_LIMIT":3}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('PETS', '{"EGG_DAYS":3,"DUPLICATE_COINS":40}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('PET_CATALOG', '[{"id":"ga","name":"Gà Con Tò Mò","rarity":"common","weight":30},{"id":"meo","name":"Mèo Mướp","rarity":"common","weight":25},{"id":"cun","name":"Cún Vàng","rarity":"common","weight":25},{"id":"tho","name":"Thỏ Bông","rarity":"rare","weight":15},{"id":"rua","name":"Rùa Thông Thái","rarity":"rare","weight":15},{"id":"gautruc","name":"Gấu Trúc Mũm Mĩm","rarity":"epic","weight":8},{"id":"cao","name":"Cáo Lửa","rarity":"epic","weight":8},{"id":"rong","name":"Rồng Con Vàng","rarity":"legendary","weight":3}]'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('VALUES', '[{"id":"nhanAi","name":"Nhân Ái","color":"#009082","motto":"Biết nghĩ cho người khác"},{"id":"banLinh","name":"Bản Lĩnh","color":"#725139","motto":"Dám đặt đòi hỏi của bản thân ở phía sau"},{"id":"triThuc","name":"Tri Thức","color":"#9A0036","motto":"Học hỏi liên tục để mở rộng dung lượng trái tim"},{"id":"trachNhiem","name":"Trách Nhiệm","color":"#C49C57","motto":"Thử sai và chấp nhận các hệ quả"},{"id":"khaiPhong","name":"Khai Phóng","color":"#1750B5","motto":"Nung nấu hoài bão và nguyện ước lớn"}]'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.game_settings (key, value) values ('ALLOWED_EMAIL_DOMAINS', '["vaschools.edu.vn"]'::jsonb) on conflict (key) do nothing;
insert into public.game_settings (key, value) values ('DEFAULT_EQUIPPED', '{"jacket":"jacket-va","hat":"hat-none","glasses":"glasses-none","shoes":"shoes-red","backpack":"backpack-none","aura":"aura-none"}'::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.ranks (id, sort, name, icon, xp, color, reward, tiers) values ('tapSu', 0, 'Tập Sự', '🐣', 0, '#8F7562', 'Áo khoác VA cơ bản', false) on conflict (id) do update set sort = excluded.sort, name = excluded.name, icon = excluded.icon, xp = excluded.xp, color = excluded.color, reward = excluded.reward, tiers = excluded.tiers;
insert into public.ranks (id, sort, name, icon, xp, color, reward, tiers) values ('thanhVien', 1, 'Thành Viên', '🎒', 300, '#009082', 'Ba lô đen', false) on conflict (id) do update set sort = excluded.sort, name = excluded.name, icon = excluded.icon, xp = excluded.xp, color = excluded.color, reward = excluded.reward, tiers = excluded.tiers;
insert into public.ranks (id, sort, name, icon, xp, color, reward, tiers) values ('dong', 2, 'Đồng', '🥉', 1500, '#B87333', 'Khung hạng màu đồng', true) on conflict (id) do update set sort = excluded.sort, name = excluded.name, icon = excluded.icon, xp = excluded.xp, color = excluded.color, reward = excluded.reward, tiers = excluded.tiers;
insert into public.ranks (id, sort, name, icon, xp, color, reward, tiers) values ('bac', 3, 'Bạc', '🥈', 5000, '#8A9BA8', 'Giày bạc', true) on conflict (id) do update set sort = excluded.sort, name = excluded.name, icon = excluded.icon, xp = excluded.xp, color = excluded.color, reward = excluded.reward, tiers = excluded.tiers;
insert into public.ranks (id, sort, name, icon, xp, color, reward, tiers) values ('vang', 4, 'Vàng', '🥇', 12000, '#C49C57', 'Vương miện vàng', true) on conflict (id) do update set sort = excluded.sort, name = excluded.name, icon = excluded.icon, xp = excluded.xp, color = excluded.color, reward = excluded.reward, tiers = excluded.tiers;
insert into public.ranks (id, sort, name, icon, xp, color, reward, tiers) values ('kimCuong', 5, 'Kim Cương', '💎', 25000, '#1750B5', 'Áo khoác Kim Cương', true) on conflict (id) do update set sort = excluded.sort, name = excluded.name, icon = excluded.icon, xp = excluded.xp, color = excluded.color, reward = excluded.reward, tiers = excluded.tiers;
insert into public.ranks (id, sort, name, icon, xp, color, reward, tiers) values ('huyenThoai', 6, 'Kỳ Lân Huyền Thoại', '👑', 50000, '#9A0036', 'Hào quang Huyền Thoại', false) on conflict (id) do update set sort = excluded.sort, name = excluded.name, icon = excluded.icon, xp = excluded.xp, color = excluded.color, reward = excluded.reward, tiers = excluded.tiers;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('jacket-va', 'jacket', 'Áo khoác VA', 0, null, 'common', 'jacket', true) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('jacket-nhanai', 'jacket', 'Áo Nhân Ái', 120, null, 'rare', 'jacket', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('jacket-banlinh', 'jacket', 'Áo Bản Lĩnh', 120, null, 'rare', 'jacket', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('jacket-trachnhiem', 'jacket', 'Áo Trách Nhiệm', 120, null, 'rare', 'jacket', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('jacket-khaiphong', 'jacket', 'Áo Khai Phóng', 120, null, 'rare', 'jacket', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('jacket-kimcuong', 'jacket', 'Áo Kim Cương', 0, 'kimCuong', 'legendary', 'jacket', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('hat-none', 'hat', 'Không đội', 0, null, 'common', null, true) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('hat-cap', 'hat', 'Nón lưỡi trai VA', 80, null, 'common', 'cap', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('hat-nonla', 'hat', 'Nón lá', 150, null, 'rare', 'nonLa', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('hat-grad', 'hat', 'Mũ tốt nghiệp', 250, null, 'epic', 'gradCap', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('hat-crown', 'hat', 'Vương miện vàng', 0, 'vang', 'legendary', 'crown', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('glasses-none', 'glasses', 'Không đeo', 0, null, 'common', null, true) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('glasses-round', 'glasses', 'Kính học giả', 60, null, 'common', 'glasses', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('glasses-sun', 'glasses', 'Kính râm', 90, null, 'rare', 'glasses', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('shoes-red', 'shoes', 'Giày đỏ VA', 0, null, 'common', 'shoes', true) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('shoes-blue', 'shoes', 'Giày Khai Phóng', 80, null, 'common', 'shoes', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('shoes-white', 'shoes', 'Sneaker trắng', 100, null, 'rare', 'shoes', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('shoes-silver', 'shoes', 'Giày bạc', 0, 'bac', 'epic', 'shoes', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('backpack-none', 'backpack', 'Không đeo', 0, null, 'common', null, true) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('backpack-black', 'backpack', 'Ba lô đen', 0, 'thanhVien', 'common', 'backpack', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('backpack-teal', 'backpack', 'Ba lô Nhân Ái', 100, null, 'rare', 'backpack', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('aura-none', 'aura', 'Không', 0, null, 'common', null, true) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values ('aura-legend', 'aura', 'Hào quang Huyền Thoại', 0, 'huyenThoai', 'legendary', 'aura', false) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;
insert into public.gift_catalog (id, name, icon, description, cost, stock, sort) values ('but-va', 'Bút bi VA', '🖊️', 'Bút bi in logo VA Schools.', 400, null, 0) on conflict (id) do nothing;
insert into public.gift_catalog (id, name, icon, description, cost, stock, sort) values ('moc-khoa', 'Móc khoá Kỳ lân', '🔑', 'Móc khoá hình Kỳ lân VA dễ thương.', 600, null, 1) on conflict (id) do nothing;
insert into public.gift_catalog (id, name, icon, description, cost, stock, sort) values ('ca-phe', 'Phiếu cà phê căng tin', '☕', 'Một ly cà phê / trà sữa tại căng tin trường.', 700, null, 2) on conflict (id) do nothing;
insert into public.gift_catalog (id, name, icon, description, cost, stock, sort) values ('so-tay', 'Sổ tay VA', '📒', 'Sổ tay bìa cứng VA Schools.', 800, null, 3) on conflict (id) do nothing;
insert into public.gift_catalog (id, name, icon, description, cost, stock, sort) values ('ly-su', 'Ly sứ VA', '🍵', 'Ly sứ in hình Kỳ lân và 5 giá trị.', 1200, 30, 4) on conflict (id) do nothing;
insert into public.gift_catalog (id, name, icon, description, cost, stock, sort) values ('binh-nuoc', 'Bình nước VA', '🧴', 'Bình giữ nhiệt VA Schools.', 1500, 30, 5) on conflict (id) do nothing;
insert into public.gift_catalog (id, name, icon, description, cost, stock, sort) values ('ao-thun', 'Áo thun VA', '👕', 'Áo thun đỏ VA Schools (chọn size khi nhận).', 3000, 20, 6) on conflict (id) do nothing;
insert into public.gift_catalog (id, name, icon, description, cost, stock, sort) values ('gau-bong', 'Gấu bông Kỳ lân', '🧸', 'Kỳ lân nhồi bông — quà hiếm!', 4000, 10, 7) on conflict (id) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', null, 'VA Schools có bao nhiêu giá trị cốt lõi?', array['5', '3', '4', '7']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', null, 'Thứ tự đúng của 5 giá trị cốt lõi VA Schools là gì?', array['Nhân ái – Bản lĩnh – Tri thức – Trách nhiệm – Khai phóng', 'Tri thức – Nhân ái – Khai phóng – Bản lĩnh – Trách nhiệm', 'Trách nhiệm – Tri thức – Nhân ái – Khai phóng – Bản lĩnh', 'Khai phóng – Trách nhiệm – Bản lĩnh – Tri thức – Nhân ái']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'nhanAi', 'Giá trị cốt lõi ĐẦU TIÊN mà VA Schools đề cao là gì?', array['Nhân ái', 'Tri thức', 'Khai phóng', 'Bản lĩnh']::text[], 'Nhân ái là nền tảng cho các giá trị tiếp theo.') on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'nhanAi', '"Biết nghĩ cho người khác" là định nghĩa ngắn gọn của giá trị nào?', array['Nhân ái', 'Trách nhiệm', 'Bản lĩnh', 'Khai phóng']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'banLinh', '"Dám đặt đòi hỏi của bản thân ở phía sau" là định nghĩa của giá trị nào?', array['Bản lĩnh', 'Nhân ái', 'Tri thức', 'Trách nhiệm']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'triThuc', '"Trau dồi và học hỏi liên tục để mở rộng dung lượng trái tim" là giá trị nào?', array['Tri thức', 'Khai phóng', 'Nhân ái', 'Bản lĩnh']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'trachNhiem', '"Thử sai và chấp nhận các hệ quả" là định nghĩa của giá trị nào?', array['Trách nhiệm', 'Bản lĩnh', 'Khai phóng', 'Tri thức']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'khaiPhong', '"Nung nấu hoài bão và nguyện ước lớn" là định nghĩa của giá trị nào?', array['Khai phóng', 'Tri thức', 'Trách nhiệm', 'Nhân ái']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'khaiPhong', 'Giá trị nào được BỔ SUNG như lời khẳng định giáo dục là nền tảng để con người hướng đến tự do và hoà hợp?', array['Khai phóng', 'Trách nhiệm', 'Tri thức', 'Bản lĩnh']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'nhanAi', 'Theo VA Schools, nền tảng của nhân ái nằm ở đâu?', array['Ở cách hành xử', 'Ở cảm xúc', 'Ở lời nói', 'Ở thành tích']::text[], 'Nền tảng của nhân ái không nằm ở cảm xúc mà ở cách hành xử.') on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'nhanAi', 'Bước đầu tiên để tiến đến sự thấu hiểu, đồng cảm và bao dung là gì?', array['Đặt mình vào hoàn cảnh của người khác', 'Bảo vệ quan điểm của mình', 'Tránh xa mâu thuẫn', 'Chờ người khác xin lỗi trước']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'nhanAi', 'Nhân ái không bắt đầu từ điều vĩ đại mà khởi đi từ đâu?', array['Một suy nghĩ đơn giản: nghĩ cho người khác', 'Những việc làm từ thiện lớn', 'Sự giàu có', 'Địa vị xã hội']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'banLinh', '"Hiểu cho người khác là nhân ái. Còn can đảm đón nhận người trái ý mình chính là…"', array['Bản lĩnh', 'Trách nhiệm', 'Khai phóng', 'Tri thức']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'banLinh', 'Theo tài liệu VA, "vượt lên trên cái tôi của mình để nâng đỡ người yếu thế hơn" được gọi là gì?', array['Can đảm', 'Dũng cảm', 'Liều lĩnh', 'Tự tin']::text[], 'Can đảm là chiến thắng nỗi sợ bên trong; dũng cảm là đương đầu thử thách bên ngoài.') on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'banLinh', 'Dũng khí đương đầu với thử thách hoặc hiểm nguy TỪ BÊN NGOÀI được gọi là gì?', array['Dũng cảm', 'Can đảm', 'Nhân ái', 'Khai phóng']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'banLinh', 'Một giáo viên xin lỗi học trò vì đã giảng sai, dù không ai phát hiện. Đó là biểu hiện của điều gì?', array['Can đảm', 'Sự yếu đuối', 'Dũng cảm đối đầu', 'Nghĩa vụ hành chính']::text[], 'Người thầy đặt thể diện cá nhân phía sau, đưa quyền lợi của học trò lên đầu.') on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'banLinh', 'Theo tài liệu, "thấu hiểu" và "chấp nhận" là…', array['Hai chuyện khác nhau', 'Cùng một nghĩa', 'Đối lập hoàn toàn', 'Không liên quan đến giá trị cốt lõi']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'triThuc', 'Theo VA Schools, ngoài để khẳng định mình, chúng ta còn cần học để làm gì?', array['Để hiểu và thương những người xung quanh tốt hơn', 'Để hơn người khác', 'Để có bằng cấp', 'Để không bị chê']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'triThuc', 'Tri thức theo VA Schools KHÔNG chỉ là tích luỹ kiến thức, mà còn là…', array['Sự hiểu biết sâu sắc về thế giới và con người', 'Điểm số cao', 'Số lượng sách đã đọc', 'Khả năng ghi nhớ']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'trachNhiem', 'Trách nhiệm khác nghĩa vụ ở điểm nào?', array['Trách nhiệm đến từ sự tự nguyện bên trong, không thể áp đặt', 'Trách nhiệm luôn có điều khoản ràng buộc', 'Trách nhiệm chỉ dành cho người quản lý', 'Không có gì khác nhau']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'trachNhiem', 'Trách nhiệm được hình thành khi nào?', array['Khi ý thức được mối liên hệ giữa việc mình làm và hệ quả của nó', 'Khi được cấp trên giao việc', 'Khi ký hợp đồng', 'Khi bị nhắc nhở']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'trachNhiem', 'Trong môi trường giáo dục, VA Schools khuyến khích tinh thần gì thay vì đòi hỏi sự hoàn hảo?', array['Thử sai có trách nhiệm', 'Không bao giờ được sai', 'Làm theo mẫu có sẵn', 'Tránh việc mới']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'trachNhiem', 'Hình ảnh "Một cánh én nhỏ có thể không làm nên mùa xuân, nhưng có thể báo hiệu mùa xuân" minh hoạ giá trị nào?', array['Trách nhiệm', 'Nhân ái', 'Tri thức', 'Bản lĩnh']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'khaiPhong', 'Trong giá trị Khai phóng, nhà trường được ví như gì?', array['Một vườn ươm', 'Một nhà máy', 'Một pháo đài', 'Một sân khấu']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'khaiPhong', '"Rễ đâm sâu thì cây mới vươn cao" gắn với giá trị nào?', array['Khai phóng', 'Trách nhiệm', 'Nhân ái', 'Bản lĩnh']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'khaiPhong', 'Khai phóng là hiểu mình đứng trên nền tảng nào để vươn đến hoà hợp mà không…', array['Hoà tan', 'Hoà giải', 'Hoà bình', 'Hoà nhã']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'khaiPhong', 'Tinh thần khai phóng: biết suy nghĩ độc lập nhưng vẫn giữ được…', array['Sự khiêm nhường', 'Sự im lặng', 'Sự phục tùng', 'Sự hoài nghi tất cả']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', 'khaiPhong', 'Theo tài liệu, lý tưởng đích thực là gì?', array['Điều ta sẵn sàng dành trọn đời xây dựng, dù có thể không là người thụ hưởng', 'Điều mang lại lợi ích ngay cho bản thân', 'Mục tiêu trong một năm', 'Ước mơ của người khác']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', null, 'Hệ giá trị cốt lõi VA được sắp xếp theo mạch phát triển từ … đến tri thức.', array['Giáo dục nhân cách', 'Kỹ năng sống', 'Thể chất', 'Ngoại ngữ']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', null, 'Câu kết của tài liệu 5 giá trị cốt lõi là gì?', array['Mười năm trồng cây – Trăm năm trồng người', 'Học, học nữa, học mãi', 'Tiên học lễ, hậu học văn', 'Có công mài sắt có ngày nên kim']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('values', null, 'VA Schools hướng đến tạo nên những công dân như thế nào?', array['Hạnh phúc, giàu tri thức, giàu lòng nhân ái, dám bước ra thế giới', 'Hoàn hảo, không mắc lỗi', 'Chỉ giỏi thi cử', 'Chỉ biết nghe lời']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Câu định vị (slogan) của VA Schools là gì?', array['Trường học của sự Lắng Nghe', 'Trường học của tương lai', 'Học để thành công', 'Nơi ươm mầm tài năng']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', 'triThuc', 'Màu nhận diện của giá trị Tri Thức là màu gì?', array['Đỏ đô', 'Xanh ngọc', 'Nâu', 'Xanh dương']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', 'nhanAi', 'Màu nhận diện của giá trị Nhân Ái là màu gì?', array['Xanh ngọc', 'Đỏ đô', 'Vàng đồng', 'Nâu']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', 'khaiPhong', 'Màu nhận diện của giá trị Khai Phóng là màu gì?', array['Xanh dương', 'Xanh ngọc', 'Vàng đồng', 'Đỏ đô']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', 'banLinh', 'Màu nhận diện của giá trị Bản Lĩnh là màu gì?', array['Nâu', 'Xanh dương', 'Đỏ đô', 'Xanh ngọc']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', 'trachNhiem', 'Màu nhận diện của giá trị Trách Nhiệm là màu gì?', array['Vàng đồng', 'Nâu', 'Xanh dương', 'Đỏ đô']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', 'khaiPhong', 'Biểu tượng (icon) của giá trị Khai Phóng là hình gì?', array['Thuyền buồm', 'Cái cây', 'Cán cân', 'Trái tim']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', 'trachNhiem', 'Biểu tượng (icon) của giá trị Trách Nhiệm là hình gì?', array['Cán cân', 'Thuyền buồm', 'Tảng băng', 'Cái cây']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', 'triThuc', 'Biểu tượng (icon) của giá trị Tri Thức là hình gì?', array['Cái cây', 'Cán cân', 'Thuyền buồm', 'Tảng băng']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', 'nhanAi', 'Biểu tượng (icon) của giá trị Nhân Ái là hình gì?', array['Trái tim có mầm cây', 'Thuyền buồm', 'Cán cân', 'Ngọn núi']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Mascot Kỳ lân của VA Schools có mấy ngón tay trên mỗi bàn tay?', array['4', '5', '3', '6']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Đặc điểm nhận diện cốt lõi nào của mascot Kỳ lân PHẢI giữ nguyên?', array['Sừng vàng, lông mày vàng xoắn, bàn tay 4 ngón', 'Áo khoác xanh, mũ đỏ', 'Đôi cánh trắng', 'Đuôi cầu vồng']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Font chữ được dùng thống nhất trong Design System của Phòng Công Nghệ là gì?', array['Be Vietnam Pro', 'Times New Roman', 'Comic Sans', 'Arial']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Website chính thức của VA Schools là gì?', array['vaschools.edu.vn', 'vaschools.com.vn', 'vietmy.edu.vn', 'vaschool.vn']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Dây đeo thẻ của NHÂN VIÊN và GIÁO VIÊN mang chủ đề giá trị nào?', array['Khai Phóng', 'Nhân Ái', 'Tri Thức', 'Bản Lĩnh']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Dây đeo thẻ học sinh MẦM NON mang chủ đề giá trị nào?', array['Nhân Ái', 'Trách Nhiệm', 'Khai Phóng', 'Tri Thức']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Dây đeo thẻ học sinh TRUNG HỌC CƠ SỞ mang chủ đề giá trị nào?', array['Tri Thức', 'Bản Lĩnh', 'Nhân Ái', 'Trách Nhiệm']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Theo chuẩn UX của Phòng Công Nghệ, tính năng XOÁ bắt buộc phải có gì?', array['Hỏi lại xác nhận, loading và thông báo thành công', 'Xoá ngay không cần hỏi', 'Chỉ cần nút màu đỏ', 'Gửi email cho quản trị']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('va', null, 'Tỉ lệ tương phản màu tối thiểu cho chữ thường theo chuẩn Accessibility của VA là bao nhiêu?', array['4.5:1', '2:1', '1.5:1', '10:1']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Đỉnh núi cao nhất Việt Nam là đỉnh nào?', array['Fansipan', 'Bà Đen', 'Ngọc Linh', 'Tây Côn Lĩnh']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Hành tinh lớn nhất trong Hệ Mặt Trời là hành tinh nào?', array['Sao Mộc', 'Sao Thổ', 'Trái Đất', 'Sao Hải Vương']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Ở áp suất tiêu chuẩn, nước sôi ở bao nhiêu độ C?', array['100 °C', '90 °C', '80 °C', '120 °C']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Công thức hoá học của nước là gì?', array['H₂O', 'CO₂', 'O₂', 'NaCl']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Khí nào chiếm tỉ lệ lớn nhất trong khí quyển Trái Đất?', array['Nitơ', 'Oxy', 'Cacbonic', 'Hiđrô']::text[], 'Nitơ chiếm khoảng 78% khí quyển.') on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Khi quang hợp, cây xanh hấp thụ khí gì?', array['Cacbonic (CO₂)', 'Oxy (O₂)', 'Nitơ (N₂)', 'Hêli (He)']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, '7 × 8 bằng bao nhiêu?', array['56', '54', '64', '48']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Số nguyên tố nhỏ nhất là số nào?', array['2', '1', '0', '3']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Tổng các góc trong một tam giác bằng bao nhiêu độ?', array['180°', '360°', '90°', '270°']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Căn bậc hai của 144 là bao nhiêu?', array['12', '14', '11', '72']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, '15% của 200 là bao nhiêu?', array['30', '15', '20', '35']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Công thức tính chu vi hình tròn bán kính r là gì?', array['2πr', 'πr²', '2r', 'πr']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, '1 giờ bằng bao nhiêu giây?', array['3.600 giây', '360 giây', '6.000 giây', '60 giây']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, '2 mũ 10 (2¹⁰) bằng bao nhiêu?', array['1.024', '1.000', '512', '2.048']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Hình đa giác có 6 cạnh gọi là gì?', array['Lục giác', 'Ngũ giác', 'Bát giác', 'Tứ giác']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Năm nhuận, tháng 2 có bao nhiêu ngày?', array['29', '28', '30', '31']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Số π (pi) xấp xỉ bằng bao nhiêu?', array['3,14', '2,71', '1,41', '3,41']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Tác phẩm "Truyện Kiều" do ai sáng tác?', array['Nguyễn Du', 'Nguyễn Trãi', 'Hồ Xuân Hương', 'Nguyễn Đình Chiểu']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, '"Bình Ngô đại cáo" là tác phẩm của ai?', array['Nguyễn Trãi', 'Lý Thường Kiệt', 'Trần Hưng Đạo', 'Lê Lợi']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Chiến thắng Điện Biên Phủ diễn ra vào năm nào?', array['1954', '1945', '1975', '1968']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập vào ngày nào?', array['2/9/1945', '19/8/1945', '30/4/1975', '7/5/1954']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Vị vua đầu tiên của triều Nguyễn là ai?', array['Gia Long', 'Minh Mạng', 'Tự Đức', 'Bảo Đại']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Ngày Nhà giáo Việt Nam là ngày nào?', array['20/11', '20/10', '8/3', '1/6']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Tác giả bài "Tiến quân ca" (Quốc ca Việt Nam) là ai?', array['Văn Cao', 'Trịnh Công Sơn', 'Phạm Tuyên', 'Hoàng Vân']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Vịnh Hạ Long thuộc tỉnh nào?', array['Quảng Ninh', 'Hải Phòng', 'Thanh Hoá', 'Nghệ An']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Con sông lớn chảy qua thủ đô Hà Nội là sông nào?', array['Sông Hồng', 'Sông Đà', 'Sông Mã', 'Sông Hương']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Đại dương lớn nhất thế giới là đại dương nào?', array['Thái Bình Dương', 'Đại Tây Dương', 'Ấn Độ Dương', 'Bắc Băng Dương']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Châu lục có diện tích lớn nhất là châu nào?', array['Châu Á', 'Châu Phi', 'Châu Mỹ', 'Châu Âu']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Loài động vật lớn nhất từng sống trên Trái Đất là loài nào?', array['Cá voi xanh', 'Voi châu Phi', 'Khủng long bạo chúa', 'Cá mập trắng']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Cơ quan lớn nhất của cơ thể người là gì?', array['Da', 'Gan', 'Phổi', 'Tim']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Bộ xương người trưởng thành có khoảng bao nhiêu chiếc xương?', array['206', '106', '306', '186']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Kim loại nào ở thể lỏng ở nhiệt độ phòng?', array['Thuỷ ngân', 'Sắt', 'Nhôm', 'Đồng']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Ký hiệu hoá học "Fe" là của nguyên tố nào?', array['Sắt', 'Flo', 'Vàng', 'Chì']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Ký hiệu hoá học "Au" là của nguyên tố nào?', array['Vàng', 'Bạc', 'Nhôm', 'Đồng']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Đơn vị đo cường độ dòng điện là gì?', array['Ampe (A)', 'Vôn (V)', 'Oát (W)', 'Ôm (Ω)']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Ai là người phát biểu định luật vạn vật hấp dẫn?', array['Isaac Newton', 'Albert Einstein', 'Galileo Galilei', 'Marie Curie']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Thuyết tương đối gắn liền với nhà khoa học nào?', array['Albert Einstein', 'Isaac Newton', 'Thomas Edison', 'Charles Darwin']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Vận tốc ánh sáng trong chân không xấp xỉ bao nhiêu?', array['300.000 km/s', '300 km/s', '3.000 km/h', '30.000 km/s']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'English: Thì quá khứ của động từ "go" là gì?', array['went', 'goed', 'gone', 'going']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'English: Số nhiều của "child" là gì?', array['children', 'childs', 'childes', 'childrens']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'English: Chọn câu đúng.', array['She goes to school every day.', 'She go to school every day.', 'She going to school every day.', 'She gone to school every day.']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'English: Từ nào đồng nghĩa với "happy"?', array['joyful', 'angry', 'tired', 'hungry']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'English: "Library" nghĩa là gì?', array['Thư viện', 'Phòng thí nghiệm', 'Nhà sách', 'Phòng học']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, '1 byte bằng bao nhiêu bit?', array['8', '4', '16', '10']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Trên Windows, phím tắt để SAO CHÉP là gì?', array['Ctrl + C', 'Ctrl + V', 'Ctrl + X', 'Ctrl + Z']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Ngôn ngữ lập trình nào chạy trực tiếp trong trình duyệt web?', array['JavaScript', 'Python', 'C++', 'Java']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Nhận được email lạ yêu cầu đăng nhập để "xác minh tài khoản", bạn nên làm gì?', array['Không bấm link, báo cho bộ phận IT', 'Đăng nhập ngay cho nhanh', 'Chuyển tiếp cho đồng nghiệp', 'Trả lời email kèm mật khẩu']::text[], 'Đây thường là email lừa đảo (phishing).') on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Mật khẩu nào sau đây mạnh nhất?', array['Ky#Lan2026!Vas', '12345678', 'matkhau', 'vaschools']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Kỹ thuật Pomodoro thường chia thời gian làm việc tập trung thành các phiên bao nhiêu phút?', array['25 phút', '5 phút', '60 phút', '90 phút']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Trong tháp nhu cầu Maslow, tầng thấp nhất là nhu cầu gì?', array['Nhu cầu sinh lý', 'Nhu cầu được tôn trọng', 'Nhu cầu tự thể hiện', 'Nhu cầu xã hội']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Trong thang Bloom (bản sửa đổi), mức tư duy CAO nhất là gì?', array['Sáng tạo', 'Ghi nhớ', 'Hiểu', 'Vận dụng']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Khái niệm "Tư duy phát triển" (Growth Mindset) gắn với nhà tâm lý học nào?', array['Carol Dweck', 'Sigmund Freud', 'Jean Piaget', 'Howard Gardner']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Thuyết Đa trí tuệ (Multiple Intelligences) do ai đề xuất?', array['Howard Gardner', 'Carol Dweck', 'Benjamin Bloom', 'Abraham Maslow']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Biểu hiện nào thể hiện "lắng nghe tích cực"?', array['Tóm tắt lại ý người nói để xác nhận đã hiểu đúng', 'Vừa nghe vừa xem điện thoại', 'Ngắt lời để đưa ra giải pháp ngay', 'Chuẩn bị câu trả lời khi người khác đang nói']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Mặt Trời mọc ở hướng nào?', array['Hướng Đông', 'Hướng Tây', 'Hướng Nam', 'Hướng Bắc']::text[], null) on conflict (md5(q)) do nothing;
insert into public.questions (topic, value, q, options, explain) values ('general', null, 'Quần đảo Trường Sa thuộc tỉnh nào của Việt Nam?', array['Khánh Hoà', 'Đà Nẵng', 'Bình Định', 'Phú Yên']::text[], null) on conflict (md5(q)) do nothing;

-- >>> 06_realtime_grants.sql
-- ════════════════════════════════════════════════════════════════════════
-- Kênh thời gian thực (nhiều người trên một đảo) + phân quyền gọi hàm.
-- ════════════════════════════════════════════════════════════════════════

-- Kênh riêng tư "island-*": chỉ người đã đăng nhập được nghe & gửi.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "klt nghe kênh đảo" on realtime.messages';
    execute $p$create policy "klt nghe kênh đảo" on realtime.messages for select to authenticated
      using (realtime.topic() like 'island-%')$p$;
    execute 'drop policy if exists "klt gửi kênh đảo" on realtime.messages';
    execute $p$create policy "klt gửi kênh đảo" on realtime.messages for insert to authenticated
      with check (realtime.topic() like 'island-%')$p$;
  end if;
end $$;

-- Không ai được ghi thẳng vào bảng: mọi thay đổi đi qua hàm RPC ở trên.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

-- Thu hồi quyền gọi mọi hàm, rồi chỉ cấp lại các hàm công khai cho người đã đăng nhập.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not like '\_%' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;


select 'Cài đặt Kỳ Lân Tri Thức thành công ✔' as ket_qua;
