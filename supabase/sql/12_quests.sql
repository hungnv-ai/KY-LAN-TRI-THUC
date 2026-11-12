-- ════════════════════════════════════════════════════════════════════════
-- Nhiệm vụ khám phá đảo (mỗi ngày PER_DAY nhiệm vụ) + cho thú ăn.
-- Danh mục & phần thưởng lấy từ game_settings 'QUESTS' / 'FEED' (src/config.js).
-- ════════════════════════════════════════════════════════════════════════

-- Nhiệm vụ khám phá của hôm nay (giống nhau cho mọi người, đổi theo ngày).
create or replace function public._quests_today()
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(q order by ord), '[]')
  from (
    select q, ord
    from jsonb_array_elements(public._cfg('QUESTS') -> 'CATALOG') with ordinality as t(q, ord)
    order by md5(public._today()::text || 'quest' || (q ->> 'id'))
    limit public._cfgn('QUESTS', 'PER_DAY', 3)::int
  ) s;
$$;

create or replace function public._quests_status(p_d public.daily_counters)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q ->> 'id',
      'icon', q ->> 'icon',
      'label', q ->> 'label',
      'xp', coalesce((q ->> 'xp')::int, 0),
      'coins', coalesce((q ->> 'coins')::int, 0),
      'need', coalesce((q ->> 'need')::int, 1),
      'done', (q ->> 'id') = any (p_d.quests)
    )), '[]')
  from jsonb_array_elements(public._quests_today()) q;
$$;

-- Hoàn thành một nhiệm vụ khám phá: phải thuộc bộ hôm nay, mỗi nhiệm vụ thưởng một lần/ngày.
create or replace function public.complete_quest(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
  q jsonb;
  r jsonb;
begin
  select t.q into q from jsonb_array_elements(public._quests_today()) as t(q) where t.q ->> 'id' = p_id;
  if q is null or p_id = any (d.quests) then
    return jsonb_build_object('result', null, 'state', public._state_json(v_uid));
  end if;
  -- "Cho thú ăn" kiểm tra bằng bộ đếm của máy chủ.
  if p_id = 'feed' and d.feeds < coalesce((q ->> 'need')::int, 1) then
    raise exception 'quest_not_ready';
  end if;
  update daily_counters set quests = array_append(quests, p_id) where user_id = v_uid and day = d.day;
  r := public._apply_reward(v_uid, coalesce((q ->> 'xp')::int, 0), coalesce((q ->> 'coins')::int, 0), 'quest',
    jsonb_build_object('quest', p_id));
  return jsonb_build_object('result', r, 'state', public._state_json(v_uid));
end;
$$;

-- Cho một bạn thú ăn: thưởng nhỏ, tối đa FEED.PER_DAY lần/ngày, có thời gian nghỉ.
create or replace function public.feed_animal()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_player();
  d daily_counters := public._daily(v_uid);
  r jsonb;
begin
  if d.feeds >= public._cfgn('FEED', 'PER_DAY', 8)
     or d.last_feed_at > now() - make_interval(secs => public._cfgn('FEED', 'COOLDOWN_SEC', 3) * 0.8) then
    return jsonb_build_object('result', null, 'state', public._state_json(v_uid));
  end if;
  update daily_counters set feeds = feeds + 1, last_feed_at = now() where user_id = v_uid and day = d.day;
  r := public._apply_reward(v_uid, public._cfgn('FEED', 'XP', 1)::int, public._cfgn('FEED', 'COINS', 2)::int, 'feed');
  return jsonb_build_object('result', r, 'state', public._state_json(v_uid));
end;
$$;
