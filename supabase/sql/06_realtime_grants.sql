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

-- Màn hình bảo trì hiện cả khi chưa đăng nhập.
grant execute on function public.maintenance_status() to anon;
