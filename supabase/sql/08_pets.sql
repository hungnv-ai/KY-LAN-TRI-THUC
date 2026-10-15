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
