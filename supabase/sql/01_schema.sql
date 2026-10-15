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
-- Sự kiện theo mùa (thêm sau): câu hỏi / trang phục chỉ dùng khi sự kiện đang diễn ra.
alter table public.questions add column if not exists event text;
alter table public.questions drop constraint if exists questions_topic_check;
alter table public.questions add constraint questions_topic_check check (topic in ('values', 'va', 'general', 'event'));
alter table public.items add column if not exists event text;
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
alter table public.kudos add column if not exists card text; -- mẫu thiệp sự kiện (vd thiệp 20/11)

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

-- Rung Chuông Vàng: trận đấu loại trực tiếp theo giờ hẹn (máy chủ chạy theo đồng hồ).
create table if not exists public.bell_games (
  id bigint generated always as identity primary key,
  title text not null,
  starts_at timestamptz not null,
  question_count int not null check (question_count between 3 and 30),
  answer_sec int not null default 15 check (answer_sec between 8 and 60),
  reveal_sec int not null default 6 check (reveal_sec between 3 and 20),
  prize_xp int not null default 50 check (prize_xp >= 0),
  prize_coins int not null default 100 check (prize_coins >= 0),
  join_xp int not null default 5 check (join_xp >= 0),
  winner_voucher text,
  status text not null default 'scheduled' check (status in ('scheduled', 'finished', 'cancelled')),
  settled_round int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bell_games_starts_idx on public.bell_games (starts_at);

create table if not exists public.bell_rounds (
  game_id bigint not null references public.bell_games (id) on delete cascade,
  round int not null,
  question_id bigint references public.questions (id) on delete set null,
  q text not null,
  options text[] not null,          -- đã xáo trộn
  correct_index int not null,       -- 0-based theo options đã xáo
  explain text,
  primary key (game_id, round)
);

create table if not exists public.bell_players (
  game_id bigint not null references public.bell_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  out_round int,                    -- null = còn trụ lại
  correct int not null default 0,
  primary key (game_id, user_id)
);

create table if not exists public.bell_answers (
  game_id bigint not null,
  round int not null,
  user_id uuid not null,
  choice int not null,
  correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (game_id, round, user_id),
  foreign key (game_id, user_id) references public.bell_players (game_id, user_id) on delete cascade
);

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
alter table public.bell_games enable row level security;
alter table public.bell_rounds enable row level security;
alter table public.bell_players enable row level security;
alter table public.bell_answers enable row level security;
