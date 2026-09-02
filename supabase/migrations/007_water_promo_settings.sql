-- Runtime-controlled public presentation settings for the water experience.
-- Browser clients still go through the Edge Functions; direct table/RPC access
-- remains limited to service_role, matching the water rewards security model.

create table if not exists public.water_settings (
  singleton boolean primary key default true check (singleton),
  tarot_promo_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.water_settings (singleton, tarot_promo_enabled)
values (true, true)
on conflict (singleton) do nothing;

drop trigger if exists touch_water_settings_updated_at on public.water_settings;
create trigger touch_water_settings_updated_at
before update on public.water_settings
for each row execute function public.water_touch_updated_at();

create or replace function public.water_get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tarotPromoEnabled', coalesce(
      (select tarot_promo_enabled from public.water_settings where singleton),
      true
    ),
    'updatedAt', (
      select updated_at from public.water_settings where singleton
    )
  );
$$;

create or replace function public.water_admin_get_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.water_get_public_settings();
$$;

create or replace function public.water_admin_update_settings(
  p_tarot_promo_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tarot_promo_enabled is null then
    raise exception 'WATER_INVALID_TAROT_PROMO_ENABLED';
  end if;

  insert into public.water_settings (singleton, tarot_promo_enabled)
  values (true, p_tarot_promo_enabled)
  on conflict (singleton) do update
  set tarot_promo_enabled = excluded.tarot_promo_enabled;

  insert into public.water_admin_audit(action, payload)
  values (
    'update_settings',
    jsonb_build_object('tarotPromoEnabled', p_tarot_promo_enabled)
  );

  return public.water_get_public_settings();
end;
$$;

alter table public.water_settings enable row level security;

revoke all on table public.water_settings from public, anon, authenticated;
revoke all on function public.water_get_public_settings() from public, anon, authenticated;
revoke all on function public.water_admin_get_settings() from public, anon, authenticated;
revoke all on function public.water_admin_update_settings(boolean) from public, anon, authenticated;

grant execute on function public.water_get_public_settings() to service_role;
grant execute on function public.water_admin_get_settings() to service_role;
grant execute on function public.water_admin_update_settings(boolean) to service_role;
