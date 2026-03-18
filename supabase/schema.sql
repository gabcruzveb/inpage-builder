-- =============================================================================
-- Page Builder - Supabase Schema
-- =============================================================================
-- Run this SQL in your Supabase project's SQL editor
-- Dashboard → SQL Editor → New Query → Paste & Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles table (extends supabase auth.users)
-- Automatically created when a user registers via trigger below
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role text default 'client' check (role in ('admin', 'client')),
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- sites table
-- Each site is a drag-and-drop page owned by a user
-- -----------------------------------------------------------------------------
create table if not exists sites (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  slug text unique not null,
  html text,                    -- full HTML saved by GrapeJS
  css text,                     -- CSS saved by GrapeJS
  gjson jsonb,                  -- GrapeJS JSON state (for re-loading editor)
  github_repo text,             -- format: "owner/repo"
  github_path text default 'index.html',  -- path in the repo
  github_branch text default 'main',
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookup by owner
create index if not exists sites_owner_id_idx on sites(owner_id);
create index if not exists sites_slug_idx on sites(slug);

-- -----------------------------------------------------------------------------
-- Trigger: auto-create profile on user registration
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: auto-update updated_at on sites
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_sites_updated on sites;
create trigger on_sites_updated
  before update on sites
  for each row execute procedure public.handle_updated_at();

drop trigger if exists on_profiles_updated on profiles;
create trigger on_profiles_updated
  before update on profiles
  for each row execute procedure public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- -----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table sites enable row level security;

-- PROFILES policies
-- Users can read their own profile
drop policy if exists "users can view own profile" on profiles;
create policy "users can view own profile"
  on profiles for select
  using (id = auth.uid());

-- Users can update their own profile
drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile"
  on profiles for update
  using (id = auth.uid());

-- Admins can view all profiles
drop policy if exists "admins can view all profiles" on profiles;
create policy "admins can view all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- SITES policies
-- Clients can only see their own sites
drop policy if exists "clients see own sites" on sites;
create policy "clients see own sites"
  on sites for select
  using (owner_id = auth.uid());

-- Clients can insert their own sites
drop policy if exists "clients insert own sites" on sites;
create policy "clients insert own sites"
  on sites for insert
  with check (owner_id = auth.uid());

-- Clients can update their own sites
drop policy if exists "clients update own sites" on sites;
create policy "clients update own sites"
  on sites for update
  using (owner_id = auth.uid());

-- Clients can delete their own sites
drop policy if exists "clients delete own sites" on sites;
create policy "clients delete own sites"
  on sites for delete
  using (owner_id = auth.uid());

-- Admins can see all sites
drop policy if exists "admins see all sites" on sites;
create policy "admins see all sites"
  on sites for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Helper: promote a user to admin (run manually as needed)
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@yourdomain.com';
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Sample data (optional, for testing)
-- -----------------------------------------------------------------------------
-- Note: The profiles are auto-created via trigger when users sign up
-- To manually set an admin after user registers:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
