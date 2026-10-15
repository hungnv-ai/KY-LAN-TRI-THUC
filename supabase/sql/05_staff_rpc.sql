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
