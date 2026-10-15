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
  return jsonb_build_object('result', r || jsonb_build_object('streak', v_streak), 'state', public._state_json(v_uid));
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
