-- Initial Schema for No More Mosquitoes

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('admin', 'support', 'customer')) default 'customer',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Properties table
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  zip text not null,
  acreage numeric(10, 2) not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Appointments table
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- Optional for guest requests
  property_id uuid references public.properties(id) on delete cascade,
  status text not null check (status in ('requested', 'scheduled', 'completed', 'canceled')) default 'requested',
  scheduled_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Schedule Requests table (for leads/guests)
create table if not exists public.schedule_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  zip text not null,
  frequency text not null,
  preferred_date date not null,
  contact_method text not null,
  acreage numeric(10, 2),
  notes text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.appointments enable row level security;
alter table public.schedule_requests enable row level security;

-- Policies
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Admins can view all profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can view their own properties" on public.properties
  for select using (auth.uid() = user_id);

create policy "Users can insert their own properties" on public.properties
  for insert with check (auth.uid() = user_id);

create policy "Users can view their own appointments" on public.appointments
  for select using (auth.uid() = user_id);

create policy "Users can insert their own appointments" on public.appointments
  for insert with check (auth.uid() = user_id);

create policy "Anyone can insert schedule requests" on public.schedule_requests
  for insert with check (true);

create policy "Admins can view all schedule requests" on public.schedule_requests
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
