create table if not exists public.users (
  id serial primary key,
  email text not null unique,
  name text not null,
  tenup_id text,
  password_hash text not null,
  password_salt text not null,
  role text not null default 'user',
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists tenup_id text;
alter table public.users add column if not exists role text;
alter table public.users add column if not exists approved boolean;
alter table public.users add column if not exists approved_at timestamptz;
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users alter column role set default 'user';
update public.users set role = 'user' where role is null or role = '';
alter table public.users alter column role set not null;
alter table public.users alter column approved set default false;
update public.users set approved = false where approved is null;
alter table public.users alter column approved set not null;

create unique index if not exists users_tenup_id_idx
  on public.users (tenup_id)
  where tenup_id is not null and tenup_id <> '';

create table if not exists public.tournois (
  id serial primary key,
  date date not null,
  nom text not null,
  categorie text not null check (categorie in ('DM', 'DD', 'DX')),
  partenaire text not null,
  classement integer not null check (classement > 0),
  point integer not null check (point > 0),
  validite text,
  manuel boolean not null default false,
  user_id integer references public.users(id) on delete cascade
);

alter table public.tournois add column if not exists validite text;
alter table public.tournois add column if not exists manuel boolean;
alter table public.tournois add column if not exists user_id integer references public.users(id) on delete cascade;
alter table public.tournois alter column manuel set default false;
update public.tournois set manuel = false where manuel is null;
alter table public.tournois alter column manuel set not null;

create index if not exists tournois_lookup_idx
  on public.tournois (date, categorie, partenaire, classement, point);

create index if not exists tournois_user_id_idx
  on public.tournois (user_id);

create table if not exists public.sync_runs (
  id serial primary key,
  source text not null,
  status text not null,
  received integer not null default 0,
  imported integer not null default 0,
  skipped integer not null default 0,
  message text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.sync_runs add column if not exists details jsonb;

alter table public.users enable row level security;
alter table public.tournois enable row level security;
alter table public.sync_runs enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.tournois from anon, authenticated;
revoke all on table public.sync_runs from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant all on table public.users to service_role;
grant all on table public.tournois to service_role;
grant all on table public.sync_runs to service_role;
grant all on all sequences in schema public to service_role;
