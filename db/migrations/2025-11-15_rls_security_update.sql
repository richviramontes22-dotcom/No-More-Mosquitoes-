-- Ensure appointments table has service type and frequency
alter table if exists public.appointments add column if not exists service_type text default 'Mosquito Service';
alter table if exists public.appointments add column if not exists frequency text;

-- Enable RLS on all employee-related tables
alter table if exists employees enable row level security;
alter table if exists assignments enable row level security;
alter table if exists job_media enable row level security;
alter table if exists message_threads enable row level security;
alter table if exists messages enable row level security;
alter table if exists shifts enable row level security;
alter table if exists time_events enable row level security;
alter table if exists routes enable row level security;
alter table if exists route_stops enable row level security;
alter table if exists job_checklists enable row level security;
alter table if exists chemicals_logs enable row level security;
alter table if exists signatures enable row level security;

-- Employees policies
create policy "Employees can view their own record" on employees
  for select using (auth.uid() = user_id);

create policy "Admins can view all employees" on employees
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Assignments policies
create policy "Customers can view their own assignments" on assignments
  for select using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.user_id = auth.uid()
    )
  );

create policy "Employees can view their own assignments" on assignments
  for select using (
    exists (
      select 1 from employees e
      where e.id = employee_id and e.user_id = auth.uid()
    )
  );

create policy "Admins can view all assignments" on assignments
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Job Media policies
create policy "Customers can view their job media" on job_media
  for select using (
    exists (
      select 1 from assignments a
      join public.appointments ap on ap.id = a.appointment_id
      where a.id = job_media.assignment_id and ap.user_id = auth.uid()
    )
  );

create policy "Employees can view/insert job media" on job_media
  for all using (
    exists (
      select 1 from assignments a
      join employees e on e.id = a.employee_id
      where a.id = job_media.assignment_id and e.user_id = auth.uid()
    )
  );

-- Message Threads policies
create policy "Customers can view their message threads" on message_threads
  for select using (
    exists (
      select 1 from assignments a
      join public.appointments ap on ap.id = a.appointment_id
      where a.id = message_threads.assignment_id and ap.user_id = auth.uid()
    )
  );

create policy "Employees can view message threads" on message_threads
  for all using (
    exists (
      select 1 from assignments a
      join employees e on e.id = a.employee_id
      where a.id = message_threads.assignment_id and e.user_id = auth.uid()
    )
  );

-- Messages policies
create policy "Customers can view/insert messages in their threads" on messages
  for all using (
    exists (
      select 1 from message_threads t
      join assignments a on a.id = t.assignment_id
      join public.appointments ap on ap.id = a.appointment_id
      where t.id = messages.thread_id and ap.user_id = auth.uid()
    )
  );

create policy "Employees can view/insert messages in their threads" on messages
  for all using (
    exists (
      select 1 from message_threads t
      join assignments a on a.id = t.assignment_id
      join employees e on e.id = a.employee_id
      where t.id = messages.thread_id and e.user_id = auth.uid()
    )
  );
