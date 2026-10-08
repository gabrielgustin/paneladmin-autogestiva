-- Users allowed to enter the admin panel. A Supabase Auth account alone is not enough.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Only the server (service_role) reads this table.
alter table public.admin_users enable row level security;

-- After creating the admin user in Authentication > Users, authorize it:
-- insert into public.admin_users (user_id) select id from auth.users where email = 'tu@email.com';
