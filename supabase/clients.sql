create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null,
  empresa text,
  producto text,
  dominio text,
  dominio_vencimiento text,
  mail text,
  telefono text,
  servidor text,
  base_datos text,
  plan text,
  metodo_pago text,
  ultimo_pago text,
  proximo_pago text,
  orden integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Solo se accede desde el servidor con la clave service_role (que ignora RLS).
alter table public.clients enable row level security;
