-- ════════════════════════════════════════════════════════════════════════
-- Nhân vật: Kỳ lân Nam / Nữ dựng sẵn + nhân vật 3D (.glb) do BGH / Quản trị tải lên.
-- File .glb lưu ở Supabase Storage (bucket công khai "characters").
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.characters (
  id text primary key,
  name text not null,
  gender text not null default 'nam' check (gender in ('nam', 'nu', 'khac')),
  variant text,            -- 'male' | 'female' = dựng sẵn bằng code; null = model 3D tải lên
  model_url text,          -- đường dẫn file .glb (null với nhân vật dựng sẵn)
  storage_path text,       -- đường dẫn trong bucket (để xoá file)
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
-- Động tác tải thêm: { "walk": { "url": "...", "path": "..." }, ... } (id ô trong ANIMATION_SLOTS).
alter table public.characters add column if not exists animations jsonb not null default '{}';
alter table public.characters enable row level security;
drop policy if exists "đọc nhân vật" on public.characters;
create policy "đọc nhân vật" on public.characters for select using (true);

-- ── Nhân vật mặc định ─────────────────────────────────────────────────────
-- Quản trị chọn nhân vật cho người mới / người chưa tự chọn (game_settings 'DEFAULT_CHARACTER').
create or replace function public._default_character()
returns text language plpgsql stable security definer set search_path = public as $$
declare v text := public._cfg('DEFAULT_CHARACTER') ->> 'id';
begin
  if v is not null and exists (select 1 from characters where id = v and active) then return v; end if;
  return 'kylan-nam';
end;
$$;

-- Nhân vật thực sự hiển thị: đã tự chọn (và còn mở) → nhân vật đó; chưa chọn → mặc định.
create or replace function public._effective_character(p_chosen boolean, p_id text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if p_chosen and exists (select 1 from characters where id = p_id and active) then return p_id; end if;
  return public._default_character();
end;
$$;

-- Nhân vật đang mở cho người chơi chọn.
create or replace function public.list_characters()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_player();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'gender', c.gender, 'variant', c.variant, 'modelUrl', c.model_url,
        'animations', coalesce((select jsonb_object_agg(a.key, a.value ->> 'url') from jsonb_each(c.animations) a), '{}'::jsonb))
      order by c.sort, c.created_at)
    from characters c where c.active
  ), '[]');
end;
$$;

create or replace function public.set_character(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._require_player();
begin
  if not exists (select 1 from characters where id = p_id and active) then raise exception 'character_not_found'; end if;
  update player_state set character_id = p_id, character_chosen = true, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('ok', true, 'state', public._state_json(v_uid));
end;
$$;

-- ── Quản trị ──────────────────────────────────────────────────────────────
create or replace function public.admin_list_characters()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'gender', c.gender, 'variant', c.variant, 'modelUrl', c.model_url,
      'storagePath', c.storage_path, 'active', c.active, 'createdAt', c.created_at, 'animations', c.animations,
      'players', (select count(*) from player_state s where public._effective_character(s.character_chosen, s.character_id) = c.id),
      'isDefault', c.id = public._default_character()
    ) order by c.sort, c.created_at)
    from characters c
  ), '[]');
end;
$$;

-- Thêm (p_id null) hoặc sửa nhân vật. Nhân vật dựng sẵn chỉ đổi được tên / bật–tắt.
-- p_animations: bộ động tác mới (null = giữ nguyên).
drop function if exists public.admin_save_character(text, text, text, text, text, boolean);
create or replace function public.admin_save_character(
  p_id text, p_name text, p_gender text, p_model_url text default null, p_storage_path text default null,
  p_active boolean default true, p_animations jsonb default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id text := p_id;
  v_name text := trim(coalesce(p_name, ''));
begin
  perform public._require_manager();
  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if p_gender not in ('nam', 'nu', 'khac') then raise exception 'invalid_gender'; end if;
  if v_id = 'kylan-nam' and not coalesce(p_active, true) then raise exception 'default_character_locked'; end if;
  if p_animations is not null and (
    jsonb_typeof(p_animations) <> 'object'
    or exists (
      select 1 from jsonb_each(p_animations) a
      where a.key !~ '^(idle|walk|run|wave|cheer|happy|cry|think|oops|faint|cool|bored)$'
         or coalesce(a.value ->> 'url', '') !~ '^https://'
    )
  ) then raise exception 'invalid_animations'; end if;
  if v_id is null then
    if coalesce(p_model_url, '') !~ '^https://' then raise exception 'invalid_model_url'; end if;
    v_id := 'glb-' || substr(md5(gen_random_uuid()::text), 1, 10);
    insert into characters (id, name, gender, model_url, storage_path, active, animations)
    values (v_id, v_name, p_gender, p_model_url, p_storage_path, coalesce(p_active, true), coalesce(p_animations, '{}'));
  else
    update characters set
      name = v_name,
      gender = p_gender,
      active = coalesce(p_active, true),
      model_url = case when variant is null and p_model_url ~ '^https://' then p_model_url else model_url end,
      storage_path = case when variant is null and p_storage_path is not null then p_storage_path else storage_path end,
      animations = case when variant is null and p_animations is not null then p_animations else animations end
    where id = v_id;
    if not found then raise exception 'character_not_found'; end if;
  end if;
  -- Nhân vật bị tắt → người đang dùng quay về nhân vật mặc định.
  update player_state set character_id = 'kylan-nam', character_chosen = false
  where character_id in (select id from characters where not active);
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Chỉ Quản trị: đặt nhân vật mặc định cho người mới / người chưa tự chọn.
create or replace function public.admin_set_default_character(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._require_manager();
  if public.my_role() <> 'admin' then raise exception 'forbidden'; end if;
  if not exists (select 1 from characters where id = p_id and active) then raise exception 'character_not_found'; end if;
  insert into game_settings (key, value) values ('DEFAULT_CHARACTER', jsonb_build_object('id', p_id))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.admin_delete_character(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c characters;
begin
  perform public._require_manager();
  select * into c from characters where id = p_id;
  if not found then raise exception 'character_not_found'; end if;
  if c.variant is not null then raise exception 'builtin_character_locked'; end if;
  update player_state set character_id = 'kylan-nam', character_chosen = false where character_id = p_id;
  delete from characters where id = p_id;
  return jsonb_build_object('ok', true, 'storagePath', c.storage_path,
    'animationPaths', coalesce((select jsonb_agg(a.value ->> 'path') from jsonb_each(c.animations) a where a.value ? 'path'), '[]'));
end;
$$;

-- ── Kho file .glb (Supabase Storage): ai cũng tải về xem được, chỉ BGH / Quản trị tải lên / xoá ──
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('characters', 'characters', true)
    on conflict (id) do update set public = true;
    execute 'drop policy if exists "klt nhân vật: tải lên" on storage.objects';
    execute $p$create policy "klt nhân vật: tải lên" on storage.objects for insert to authenticated
      with check (bucket_id = 'characters' and public.is_manager())$p$;
    execute 'drop policy if exists "klt nhân vật: sửa" on storage.objects';
    execute $p$create policy "klt nhân vật: sửa" on storage.objects for update to authenticated
      using (bucket_id = 'characters' and public.is_manager())$p$;
    execute 'drop policy if exists "klt nhân vật: xoá" on storage.objects';
    execute $p$create policy "klt nhân vật: xoá" on storage.objects for delete to authenticated
      using (bucket_id = 'characters' and public.is_manager())$p$;
  end if;
end $$;
