create extension if not exists postgis;

-- 1. Asegurar RLS en spatial_ref_sys para evitar accesos de escritura no restringidos
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'spatial_ref_sys') then
    alter table public.spatial_ref_sys enable row level security;
    drop policy if exists "spatial_ref_sys_read_only" on public.spatial_ref_sys;
    create policy "spatial_ref_sys_read_only" on public.spatial_ref_sys for select using (true);
  end if;
end;
$$;

-- 2. Storage bucket 'avatars' y políticas RLS para storage.objects
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar_read_public" on storage.objects;
drop policy if exists "avatar_insert_own" on storage.objects;
drop policy if exists "avatar_update_own" on storage.objects;
drop policy if exists "avatar_delete_own" on storage.objects;

create policy "avatar_read_public" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatar_insert_own" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (auth.uid()::text = (storage.foldername(name))[1] or name like auth.uid()::text || '%'));

create policy "avatar_update_own" on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (auth.uid()::text = (storage.foldername(name))[1] or name like auth.uid()::text || '%'));

create policy "avatar_delete_own" on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (auth.uid()::text = (storage.foldername(name))[1] or name like auth.uid()::text || '%'));

-- 3. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('cliente','conductor','admin')) default 'cliente',
  full_name text,
  phone text,
  photo_url text,
  vehicle text,
  rating numeric(3,2) default 5.00,
  trips_done int default 0,
  created_at timestamptz default now()
);

-- Asegurar columnas en profiles si la tabla ya existía previamente
alter table public.profiles add column if not exists role text not null default 'cliente' check (role in ('cliente','conductor','admin'));
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists vehicle text;
alter table public.profiles add column if not exists rating numeric(3,2) default 5.00;
alter table public.profiles add column if not exists trips_done int default 0;
alter table public.profiles add column if not exists created_at timestamptz default now();

alter table public.profiles enable row level security;

-- Trigger para prevenir que un usuario común se auto-escale a 'admin' o altere su 'role'
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Si no es admin y el rol está cambiando, bloquear la operación
  if old.role is distinct from new.role and (select role from public.profiles where id = auth.uid()) is distinct from 'admin' then
    raise exception 'No tienes permisos para modificar tu propio rol.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_escalation on public.profiles;
create trigger trg_prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- Helper function segura para obtener rol del usuario actual
create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function public.get_current_user_role() from public, anon;
grant execute on function public.get_current_user_role() to authenticated;

-- Policies for profiles
drop policy if exists "profiles_read" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;

create policy "profiles_select_policy" on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or public.get_current_user_role() = 'admin'
    or exists (
      select 1 from public.trips
      where (client_id = auth.uid() and driver_id = public.profiles.id)
         or (driver_id = auth.uid() and client_id = public.profiles.id)
    )
  );

create policy "profiles_insert_own" on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.get_current_user_role() = 'admin');

-- 4. Driver Locations Table
create table if not exists public.driver_locations (
  driver_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  heading real default 0,
  location geography(point, 4326),
  updated_at timestamptz default now()
);

alter table public.driver_locations add column if not exists location geography(point, 4326);
alter table public.driver_locations add column if not exists heading real default 0;

alter table public.driver_locations enable row level security;

drop policy if exists "loc_read" on public.driver_locations;
drop policy if exists "loc_insert_own" on public.driver_locations;
drop policy if exists "loc_update_own" on public.driver_locations;
drop policy if exists "loc_select_policy" on public.driver_locations;

create policy "loc_select_policy" on public.driver_locations for select
  to authenticated
  using (
    auth.uid() = driver_id
    or public.get_current_user_role() = 'admin'
    or exists (
      select 1 from public.trips
      where driver_id = public.driver_locations.driver_id
        and client_id = auth.uid()
        and status in ('driver_assigned', 'in_progress')
    )
  );

create policy "loc_insert_own" on public.driver_locations for insert
  to authenticated
  with check (auth.uid() = driver_id);

create policy "loc_update_own" on public.driver_locations for update
  to authenticated
  using (auth.uid() = driver_id);

-- 5. Trips Table
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  driver_id uuid references public.profiles(id),
  status text not null default 'searching'
    check (status in ('searching','driver_assigned','in_progress','completed','cancelled')),
  origin_name text,
  origin_lat double precision not null,
  origin_lng double precision not null,
  dest_name text,
  dest_lat double precision not null,
  dest_lng double precision not null,
  price numeric(10,2) not null,
  distance_m int,
  duration_s int,
  driver_lat double precision,
  driver_lng double precision,
  requested_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_by text check (cancelled_by in ('cliente','conductor')),
  client_rating int check (client_rating between 1 and 5),
  driver_rating int check (driver_rating between 1 and 5)
);

alter table public.trips enable row level security;

drop policy if exists "trips_select" on public.trips;
drop policy if exists "trips_insert" on public.trips;
drop policy if exists "trips_update" on public.trips;

create policy "trips_select" on public.trips for select
  to authenticated
  using (
    auth.uid() = client_id
    or auth.uid() = driver_id
    or public.get_current_user_role() = 'admin'
    or (status = 'searching' and public.get_current_user_role() = 'conductor')
  );

create policy "trips_insert" on public.trips for insert
  to authenticated
  with check (auth.uid() = client_id or public.get_current_user_role() = 'admin');

create policy "trips_update" on public.trips for update
  to authenticated
  using (
    auth.uid() = client_id
    or auth.uid() = driver_id
    or public.get_current_user_role() = 'admin'
    or (status = 'searching' and public.get_current_user_role() = 'conductor')
  );

-- 6. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info'
    check (type in ('info','success','warning','error')),
  trip_id uuid references public.trips(id) on delete cascade,
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notif_select_own" on public.notifications;
drop policy if exists "notif_insert_own" on public.notifications;
drop policy if exists "notif_update_own" on public.notifications;

create policy "notif_select_own" on public.notifications for select
  to authenticated
  using (auth.uid() = user_id or public.get_current_user_role() = 'admin');

create policy "notif_insert_own" on public.notifications for insert
  to authenticated
  with check (auth.uid() = user_id or public.get_current_user_role() = 'admin');

create policy "notif_update_own" on public.notifications for update
  to authenticated
  using (auth.uid() = user_id or public.get_current_user_role() = 'admin');

-- Índices
create index if not exists idx_trips_status on public.trips(status);
create index if not exists idx_trips_client on public.trips(client_id);
create index if not exists idx_trips_driver on public.trips(driver_id);
create index if not exists idx_loc_geo on public.driver_locations using gist(location);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname || '.' || tablename = 'public.trips') then
    alter publication supabase_realtime drop table public.trips;
  end if;
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname || '.' || tablename = 'public.driver_locations') then
    alter publication supabase_realtime drop table public.driver_locations;
  end if;
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname || '.' || tablename = 'public.notifications') then
    alter publication supabase_realtime drop table public.notifications;
  end if;
end;
$$;

alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.driver_locations;
alter publication supabase_realtime add table public.notifications;

-- 7. Funciones espaciales y triggers
create or replace function public.get_nearby_drivers(lat double precision, lng double precision, radius_m int default 30000)
returns table (driver_id uuid, lat double precision, lng double precision, distance_m double precision)
language sql stable
security invoker
set search_path = public, pg_temp
as $$
  select dl.driver_id,
         st_y(dl.location::geometry) as lat,
         st_x(dl.location::geometry) as lng,
         round(st_distance(dl.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography)::numeric) as distance_m
  from public.driver_locations dl
  where dl.location is not null
    and st_dwithin(dl.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m)
  order by distance_m;
$$;

revoke execute on function public.get_nearby_drivers(double precision, double precision, int) from public, anon;
grant execute on function public.get_nearby_drivers(double precision, double precision, int) to authenticated;

create or replace function public.sync_driver_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.location = st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_driver_location on public.driver_locations;
create trigger trg_sync_driver_location
  before insert or update of lat, lng on public.driver_locations
  for each row execute function public.sync_driver_location();

create or replace function public.on_trip_completed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if new.driver_rating is not null then
      update public.profiles
        set rating = (rating * trips_done + new.driver_rating) / (trips_done + 1)
        where id = new.driver_id;
    end if;
    update public.profiles
      set trips_done = trips_done + 1
      where id = new.driver_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_on_trip_completed on public.trips;
create trigger trg_on_trip_completed
  after update of status on public.trips
  for each row execute function public.on_trip_completed();

create or replace function public.notify_trip_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client uuid;
  v_driver uuid;
begin
  v_client := new.client_id;
  v_driver := new.driver_id;

  if new.status = 'driver_assigned' and old.status = 'searching' then
    insert into public.notifications (user_id, title, message, type, trip_id)
    values (v_client, 'Conductor asignado', 'Un conductor acepto tu solicitud', 'success', new.id);
    if v_driver is not null then
      insert into public.notifications (user_id, title, message, type, trip_id)
      values (v_driver, 'Solicitud aceptada', 'Ya tenes un viaje asignado', 'success', new.id);
    end if;
  end if;

  if new.status = 'in_progress' and old.status = 'driver_assigned' then
    insert into public.notifications (user_id, title, message, type, trip_id)
    values (v_client, 'Viaje iniciado', 'El conductor inicio el viaje', 'info', new.id);
    if v_driver is not null then
      insert into public.notifications (user_id, title, message, type, trip_id)
      values (v_driver, 'Viaje iniciado', 'El viaje esta en curso', 'info', new.id);
    end if;
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    insert into public.notifications (user_id, title, message, type, trip_id)
    values (v_client, 'Viaje completado', 'Califica a tu conductor', 'success', new.id);
    if v_driver is not null then
      insert into public.notifications (user_id, title, message, type, trip_id)
      values (v_driver, 'Viaje completado', 'El viaje finalizo correctamente', 'success', new.id);
    end if;
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into public.notifications (user_id, title, message, type, trip_id)
    values (v_client, 'Viaje cancelado', 'La solicitud fue cancelada', 'error', new.id);
    if v_driver is not null then
      insert into public.notifications (user_id, title, message, type, trip_id)
      values (v_driver, 'Viaje cancelado', 'El cliente cancelo el viaje', 'error', new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_trip_update on public.trips;
create trigger trg_notify_trip_update
  after update of status on public.trips
  for each row execute function public.notify_trip_update();
