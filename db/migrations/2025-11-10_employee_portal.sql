-- Employees (ties to existing users via user_id)
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('technician','dispatcher','admin')) default 'technician',
  phone text,
  vehicle text,
  default_nav text check (default_nav in ('google','apple')) default 'google',
  status text check (status in ('active','inactive')) default 'active',
  created_at timestamptz not null default now()
);

-- Shifts and time events
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  shift_date date not null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_minutes int default 0,
  notes text
);

create table if not exists time_events (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  event_type text not null check (event_type in ('clock_in','clock_out','break_start','break_end','travel_start','travel_end','arrive','start_job','complete_job')),
  ts timestamptz not null default now(),
  geo geography(point,4326),
  meta jsonb default '{}'::jsonb
);

-- Routes and stops
create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  route_date date not null,
  employee_id uuid not null references employees(id) on delete cascade,
  name text,
  status text check (status in ('draft','assigned','in_progress','completed')) default 'assigned',
  notes text
);

create table if not exists route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  assignment_id uuid not null,
  seq int not null,
  eta timestamptz,
  status text check (status in ('scheduled','skipped','completed')) default 'scheduled'
);

-- Assignments link to existing appointments
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  status text check (status in ('scheduled','en_route','in_progress','completed','no_show','skipped')) default 'scheduled',
  arrive_at timestamptz,
  start_at timestamptz,
  complete_at timestamptz,
  geo_arrive geography(point,4326),
  geo_complete geography(point,4326)
);

-- Job artifacts
create table if not exists job_media (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  media_type text check (media_type in ('photo','video','doc')) not null,
  url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists job_checklists (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  checklist jsonb not null default '[]'::jsonb,
  completed_by uuid references employees(id),
  completed_at timestamptz
);

create table if not exists chemicals_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  item text not null,
  amount numeric(10,2) not null,
  unit text not null,
  epa_reg_no text,
  notes text
);

create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  signed_by text not null,
  role text check (role in ('customer','tech')) not null,
  image_url text not null,
  signed_at timestamptz not null default now()
);

-- Extend message threads & messages (shared across portals)
alter table if exists message_threads add column if not exists assignment_id uuid references assignments(id) on delete set null;
alter table if exists message_threads add column if not exists customer_visible boolean default true;

alter table if exists messages add column if not exists direction text check (direction in ('outbound','inbound')) default 'outbound';
alter table if exists messages add column if not exists channel text check (channel in ('in_app','sms')) default 'in_app';
alter table if exists messages add column if not exists provider_msg_id text;
alter table if exists messages add column if not exists delivered_at timestamptz;
alter table if exists messages add column if not exists read_at timestamptz;
