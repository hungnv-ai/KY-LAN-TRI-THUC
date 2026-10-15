-- ════════════════════════════════════════════════════════════════════════
-- Sự kiện theo mùa (vd Tuần lễ Tri ân 20/11). Lịch nằm trong game_settings.EVENTS
-- (sinh từ src/data/events.js); BGH/Quản trị có thể bật sớm / tắt (EVENT_OVERRIDE).
-- ════════════════════════════════════════════════════════════════════════

-- Định nghĩa một sự kiện (jsonb) theo id.
create or replace function public._event_def(p_id text)
returns jsonb language sql stable set search_path = public as $$
  select e from jsonb_array_elements(
    case when jsonb_typeof(public._cfg('EVENTS')) = 'array' then public._cfg('EVENTS') else '[]'::jsonb end
  ) e
  where e ->> 'id' = p_id
  limit 1;
$$;

-- Sự kiện đang diễn ra (id) theo giờ Việt Nam; hỗ trợ sự kiện vắt qua năm mới.
create or replace function public._active_event()
returns text language plpgsql stable set search_path = public as $$
declare
  o jsonb := public._cfg('EVENT_OVERRIDE');
  v_md text := to_char(public._now_vn(), 'MM-DD');
  v_id text;
begin
  if o ->> 'mode' = 'on' and public._event_def(o ->> 'id') is not null then return o ->> 'id'; end if;
  if o ->> 'mode' = 'off' then return null; end if;
  select e ->> 'id' into v_id
  from jsonb_array_elements(
    case when jsonb_typeof(public._cfg('EVENTS')) = 'array' then public._cfg('EVENTS') else '[]'::jsonb end
  ) e
  where case
    when e ->> 'start' <= e ->> 'end' then v_md between e ->> 'start' and e ->> 'end'
    else v_md >= e ->> 'start' or v_md <= e ->> 'end'
  end
  limit 1;
  return v_id;
end;
$$;

-- Bật / tắt / tự động theo lịch (BGH, Quản trị).
create or replace function public.admin_set_event(p_mode text, p_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._require_manager();
  if p_mode not in ('auto', 'on', 'off') then raise exception 'invalid_mode'; end if;
  if p_mode = 'on' and public._event_def(p_id) is null then raise exception 'event_not_found'; end if;
  insert into game_settings (key, value) values ('EVENT_OVERRIDE', jsonb_build_object('mode', p_mode, 'id', p_id))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true, 'active', public._active_event());
end;
$$;

-- Trạng thái sự kiện cho trang quản trị.
create or replace function public.admin_event_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_manager();
  return jsonb_build_object(
    'override', public._cfg('EVENT_OVERRIDE'),
    'active', public._active_event(),
    'events', case when jsonb_typeof(public._cfg('EVENTS')) = 'array' then public._cfg('EVENTS') else '[]'::jsonb end,
    'cardsSent', (select count(*) from kudos where card is not null and created_at > now() - interval '60 days')
  );
end;
$$;
