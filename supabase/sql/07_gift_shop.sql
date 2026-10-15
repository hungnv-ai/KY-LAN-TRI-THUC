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
