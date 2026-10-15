-- ════════════════════════════════════════════════════════════════════════
-- Rung Chuông Vàng: trận loại trực tiếp theo giờ hẹn.
-- Máy chủ chạy theo ĐỒNG HỒ: vòng r mở lúc starts_at + (r-1)·(answer_sec+reveal_sec), nhận đáp án
-- trong answer_sec giây, rồi công bố đáp án trong reveal_sec giây. Không cần ai "làm chủ phòng".
-- Chốt vòng (loại người sai) diễn ra lười biếng ở lần gọi kế tiếp (_bell_settle).
-- Luật cứu trợ: nếu cả vòng không ai đúng thì không ai bị loại.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public._bell_game_json(g public.bell_games)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', g.id, 'title', g.title, 'startsAt', g.starts_at, 'questionCount', g.question_count,
    'answerSec', g.answer_sec, 'revealSec', g.reveal_sec, 'prizeXp', g.prize_xp, 'prizeCoins', g.prize_coins,
    'joinXp', g.join_xp, 'winnerVoucher', g.winner_voucher, 'status', g.status,
    'endsAt', g.starts_at + make_interval(secs => g.question_count * (g.answer_sec + g.reveal_sec))
  );
$$;

-- Giai đoạn hiện tại: lobby | answer | reveal | ended | cancelled.
create or replace function public._bell_phase(g public.bell_games, p_now timestamptz default now())
returns jsonb language plpgsql stable as $$
declare
  v_cycle numeric := g.answer_sec + g.reveal_sec;
  v_el numeric := extract(epoch from (p_now - g.starts_at));
  v_round int;
begin
  if g.status = 'cancelled' then return jsonb_build_object('phase', 'cancelled', 'round', 0, 'endsAt', null); end if;
  if v_el < 0 then return jsonb_build_object('phase', 'lobby', 'round', 0, 'endsAt', g.starts_at); end if;
  v_round := floor(v_el / v_cycle)::int + 1;
  if v_round > g.question_count then
    return jsonb_build_object('phase', 'ended', 'round', g.question_count, 'endsAt', null);
  end if;
  if v_el - (v_round - 1) * v_cycle < g.answer_sec then
    return jsonb_build_object('phase', 'answer', 'round', v_round,
      'endsAt', g.starts_at + make_interval(secs => (v_round - 1) * v_cycle + g.answer_sec));
  end if;
  return jsonb_build_object('phase', 'reveal', 'round', v_round, 'endsAt', g.starts_at + make_interval(secs => v_round * v_cycle));
end;
$$;

-- Trao thưởng khi kết thúc: người trụ lại nhận giải (+ phiếu quà nếu ít người thắng); ai tham gia cũng có XP.
create or replace function public._bell_finish(p_game bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  g bell_games;
  p bell_players;
  v_survivors int;
begin
  select * into g from bell_games where id = p_game;
  select count(*) into v_survivors from bell_players where game_id = p_game and out_round is null;
  for p in select * from bell_players where game_id = p_game loop
    if p.out_round is null then
      perform public._apply_reward(p.user_id, g.prize_xp + g.join_xp, g.prize_coins, 'bell_win', jsonb_build_object('game', g.id));
      if g.winner_voucher is not null and v_survivors <= public._cfgn('BELL', 'MAX_VOUCHER_WINNERS', 3) then
        insert into vouchers (user_id, title, reason, status, source)
        values (p.user_id, g.winner_voucher, 'Rung Chuông Vàng: ' || g.title, 'approved', 'bell');
      end if;
    elsif g.join_xp > 0 then
      perform public._apply_reward(p.user_id, g.join_xp, 0, 'bell_join', jsonb_build_object('game', g.id));
    end if;
  end loop;
  update bell_games set status = 'finished' where id = p_game;
end;
$$;

-- Chốt mọi vòng đã hết giờ (kể cả thời gian bù trễ). Khoá trận để chỉ chốt một lần.
create or replace function public._bell_settle(p_game bigint)
returns public.bell_games language plpgsql security definer set search_path = public as $$
declare
  g bell_games;
  v_cycle int;
  v_round int;
  v_correct int;
  v_grace numeric := public._cfgn('BELL', 'ANSWER_GRACE_SEC', 1);
begin
  select * into g from bell_games where id = p_game for update;
  if not found then raise exception 'bell_not_found'; end if;
  if g.status <> 'scheduled' then return g; end if;
  v_cycle := g.answer_sec + g.reveal_sec;
  v_round := g.settled_round + 1;
  while v_round <= g.question_count loop
    exit when now() < g.starts_at + make_interval(secs => (v_round - 1) * v_cycle + g.answer_sec + v_grace);
    select count(*) into v_correct
    from bell_answers a join bell_players p on p.game_id = a.game_id and p.user_id = a.user_id
    where a.game_id = p_game and a.round = v_round and a.correct and p.out_round is null;
    if v_correct > 0 then
      update bell_players p set out_round = v_round
      where p.game_id = p_game and p.out_round is null
        and not exists (select 1 from bell_answers a where a.game_id = p_game and a.round = v_round and a.user_id = p.user_id and a.correct);
    end if;
    update bell_players p set correct = correct + 1
    where p.game_id = p_game
      and exists (select 1 from bell_answers a where a.game_id = p_game and a.round = v_round and a.user_id = p.user_id and a.correct);
    g.settled_round := v_round;
    v_round := v_round + 1;
  end loop;
  update bell_games set settled_round = g.settled_round where id = p_game;
  if g.settled_round >= g.question_count then
    perform public._bell_finish(p_game);
    g.status := 'finished';
  end if;
  return g;
end;
$$;

-- ── Người chơi ────────────────────────────────────────────────────────────

-- Trận sắp diễn ra / đang diễn ra / vừa kết thúc (trong 5 phút).
create or replace function public.bell_upcoming()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  g bell_games;
begin
  select * into g from bell_games
  where status <> 'cancelled'
    and starts_at < now() + interval '7 days'
    and starts_at + make_interval(secs => question_count * (answer_sec + reveal_sec) + 300) > now()
  order by starts_at
  limit 1;
  if not found then return jsonb_build_object('game', null, 'serverTime', now()); end if;
  return jsonb_build_object(
    'game', public._bell_game_json(g),
    'joined', exists (select 1 from bell_players where game_id = g.id and user_id = v_uid),
    'players', (select count(*) from bell_players where game_id = g.id),
    'lobbyOpensAt', g.starts_at - make_interval(mins => public._cfgn('BELL', 'LOBBY_MIN', 30)::int),
    'serverTime', now()
  );
end;
$$;

create or replace function public.bell_join(p_game bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  g bell_games;
begin
  select * into g from bell_games where id = p_game;
  if not found or g.status <> 'scheduled' then raise exception 'bell_not_found'; end if;
  if now() < g.starts_at - make_interval(mins => public._cfgn('BELL', 'LOBBY_MIN', 30)::int) then raise exception 'bell_not_open'; end if;
  if now() > g.starts_at + make_interval(secs => public._cfgn('BELL', 'JOIN_GRACE_SEC', 5)) then raise exception 'bell_join_closed'; end if;
  insert into bell_players (game_id, user_id) values (p_game, v_uid) on conflict do nothing;
  return jsonb_build_object('ok', true, 'players', (select count(*) from bell_players where game_id = p_game));
end;
$$;

create or replace function public.bell_state(p_game bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  g bell_games;
  ph jsonb;
  v_phase text;
  v_round int;
  me bell_players;
  v_joined boolean;
  rr bell_rounds;
  v_choice int;
  v_correct boolean;
  v_answered boolean;
  res jsonb;
begin
  g := public._bell_settle(p_game);
  ph := public._bell_phase(g);
  v_phase := ph ->> 'phase';
  v_round := (ph ->> 'round')::int;
  select * into me from bell_players where game_id = g.id and user_id = v_uid;
  v_joined := found;

  res := jsonb_build_object(
    'serverTime', now(),
    'game', public._bell_game_json(g),
    'phase', v_phase,
    'round', v_round,
    'endsAt', ph -> 'endsAt',
    'players', (select count(*) from bell_players where game_id = g.id),
    'alive', (select count(*) from bell_players where game_id = g.id and out_round is null),
    'me', case when v_joined
      then jsonb_build_object('joined', true, 'outRound', me.out_round, 'correct', me.correct)
      else jsonb_build_object('joined', false) end
  );

  if v_phase in ('answer', 'reveal') then
    select * into rr from bell_rounds where game_id = g.id and round = v_round;
    res := res || jsonb_build_object('question', jsonb_build_object('q', rr.q, 'options', to_jsonb(rr.options)));
    select choice, correct into v_choice, v_correct from bell_answers where game_id = g.id and round = v_round and user_id = v_uid;
    v_answered := found;
    if v_answered then res := res || jsonb_build_object('myChoice', v_choice); end if;
    -- Chỉ công bố đáp án khi vòng đã chốt (sau thời gian bù trễ).
    if v_phase = 'reveal' and g.settled_round >= v_round then
      res := res || jsonb_build_object('reveal', jsonb_build_object(
        'correctIndex', rr.correct_index,
        'explain', rr.explain,
        'myCorrect', coalesce(v_answered and v_correct, false),
        'eliminated', (select count(*) from bell_players where game_id = g.id and out_round = v_round),
        'answeredCorrect', (select count(*) from bell_answers where game_id = g.id and round = v_round and correct)
      ));
    end if;
  end if;

  if g.status = 'finished' then
    res := res || jsonb_build_object('results', jsonb_build_object(
      'survivors', (select count(*) from bell_players where game_id = g.id and out_round is null),
      'winners', coalesce((
        select jsonb_agg(jsonb_build_object('name', coalesce(pr.display_name, pr.full_name), 'unit', pr.unit, 'house', pr.house, 'correct', bp.correct, 'me', bp.user_id = v_uid)
          order by bp.correct desc, bp.joined_at)
        from (select * from bell_players where game_id = g.id and out_round is null order by correct desc, joined_at limit 30) bp
        join profiles pr on pr.id = bp.user_id
      ), '[]')
    ));
  end if;
  return res;
end;
$$;

create or replace function public.bell_answer(p_game bigint, p_round int, p_choice int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  g bell_games;
  rr bell_rounds;
  v_open timestamptz;
  v_out int;
  v_prev int;
begin
  g := public._bell_settle(p_game);
  if g.status <> 'scheduled' then raise exception 'bell_round_closed'; end if;
  v_open := g.starts_at + make_interval(secs => (p_round - 1) * (g.answer_sec + g.reveal_sec));
  if now() < v_open or now() > v_open + make_interval(secs => g.answer_sec + public._cfgn('BELL', 'ANSWER_GRACE_SEC', 1)) then
    raise exception 'bell_round_closed';
  end if;
  select out_round into v_out from bell_players where game_id = p_game and user_id = v_uid;
  if not found then raise exception 'bell_not_joined'; end if;
  if v_out is not null then raise exception 'bell_eliminated'; end if;
  select * into rr from bell_rounds where game_id = p_game and round = p_round;
  if not found or p_choice < 0 or p_choice >= array_length(rr.options, 1) then raise exception 'invalid_choice'; end if;
  insert into bell_answers (game_id, round, user_id, choice, correct)
  values (p_game, p_round, v_uid, p_choice, p_choice = rr.correct_index)
  on conflict do nothing;
  if not found then
    select choice into v_prev from bell_answers where game_id = p_game and round = p_round and user_id = v_uid;
    return jsonb_build_object('ok', false, 'reason', 'already', 'choice', v_prev);
  end if;
  return jsonb_build_object('ok', true, 'choice', p_choice);
end;
$$;

-- ── BGH / Quản trị ────────────────────────────────────────────────────────

create or replace function public.admin_bell_create(
  p_title text, p_starts_at timestamptz, p_count int, p_answer_sec int,
  p_prize_xp int, p_prize_coins int, p_winner_voucher text default null, p_topic text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_manager();
  v_id bigint;
  v_q record;
  v_i int := 0;
  v_opts text[];
begin
  if length(btrim(coalesce(p_title, ''))) < 3 then raise exception 'invalid_title'; end if;
  if p_starts_at < now() + interval '30 seconds' then raise exception 'bell_start_in_past'; end if;
  insert into bell_games (title, starts_at, question_count, answer_sec, reveal_sec, prize_xp, prize_coins, winner_voucher, created_by)
  values (btrim(p_title), p_starts_at, p_count, coalesce(p_answer_sec, public._cfgn('BELL', 'DEFAULT_ANSWER_SEC', 15)::int),
          public._cfgn('BELL', 'REVEAL_SEC', 6)::int, coalesce(p_prize_xp, 50), coalesce(p_prize_coins, 100),
          nullif(btrim(coalesce(p_winner_voucher, '')), ''), v_uid)
  returning id into v_id;
  for v_q in
    select * from questions
    where status = 'approved' and (event is null or event = public._active_event())
      and (p_topic is null or topic = p_topic)
    order by random() limit p_count
  loop
    v_i := v_i + 1;
    select array_agg(x order by random()) into v_opts from unnest(v_q.options) x;
    insert into bell_rounds (game_id, round, question_id, q, options, correct_index, explain)
    values (v_id, v_i, v_q.id, v_q.q, v_opts, array_position(v_opts, v_q.options[1]) - 1, v_q.explain);
  end loop;
  if v_i < p_count then raise exception 'not_enough_questions'; end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.admin_bell_list()
returns jsonb language plpgsql security definer set search_path = public as $$
declare g record;
begin
  perform public._require_manager();
  -- Chốt các trận đã hết giờ để danh sách hiển thị đúng kết quả.
  for g in select id from bell_games where status = 'scheduled' and starts_at < now() loop
    perform public._bell_settle(g.id);
  end loop;
  return coalesce((
    select jsonb_agg(public._bell_game_json(b) || jsonb_build_object(
      'phase', public._bell_phase(b) ->> 'phase',
      'players', (select count(*) from bell_players p where p.game_id = b.id),
      'survivors', (select count(*) from bell_players p where p.game_id = b.id and p.out_round is null)
    ) order by b.starts_at desc)
    from (select * from bell_games order by starts_at desc limit 30) b
  ), '[]');
end;
$$;

create or replace function public.admin_bell_cancel(p_game bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._require_manager();
  update bell_games set status = 'cancelled' where id = p_game and status = 'scheduled';
  if not found then raise exception 'bell_not_cancellable'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_bell_results(p_game bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._require_manager();
  perform public._bell_settle(p_game);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', coalesce(pr.display_name, pr.full_name), 'unit', pr.unit, 'email', pr.email,
      'correct', bp.correct, 'outRound', bp.out_round
    ) order by bp.out_round desc nulls first, bp.correct desc, bp.joined_at)
    from bell_players bp join profiles pr on pr.id = bp.user_id
    where bp.game_id = p_game
  ), '[]');
end;
$$;
