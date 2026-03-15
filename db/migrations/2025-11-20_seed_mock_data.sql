-- Seed mock data for the admin account to facilitate testing
-- This script ensures that the first admin account has complete profile data, properties, and appointments.

-- 1. Ensure the first admin profile has mock contact information
UPDATE public.profiles
SET
  name = 'Elijah Noble',
  email = 'admin@nnm.com',
  phone = '(949) 555-0123',
  updated_at = now()
WHERE id IN (
  SELECT id FROM public.profiles 
  WHERE role = 'admin' 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- 2. Add mock properties for the admin
WITH admin_user AS (
  SELECT id FROM public.profiles 
  WHERE role = 'admin' 
  ORDER BY created_at ASC 
  LIMIT 1
)
INSERT INTO public.properties (user_id, address, zip, acreage, notes)
SELECT id, '18 Ocean Vista, Newport Beach, CA 92657', '92657', 0.25, 'Main residence; dog in backyard.'
FROM admin_user
WHERE NOT EXISTS (
  SELECT 1 FROM public.properties 
  WHERE user_id = admin_user.id 
  AND address = '18 Ocean Vista, Newport Beach, CA 92657'
);

WITH admin_user AS (
  SELECT id FROM public.profiles 
  WHERE role = 'admin' 
  ORDER BY created_at ASC 
  LIMIT 1
)
INSERT INTO public.properties (user_id, address, zip, acreage, notes)
SELECT id, '42 Palm Terrace, Laguna Beach, CA 92651', '92651', 0.15, 'Secondary property; gate code 1234.'
FROM admin_user
WHERE NOT EXISTS (
  SELECT 1 FROM public.properties 
  WHERE user_id = admin_user.id 
  AND address = '42 Palm Terrace, Laguna Beach, CA 92651'
);

-- 3. Add mock appointments for the admin
WITH admin_props AS (
  SELECT p.id as property_id, p.user_id
  FROM public.properties p
  JOIN public.profiles pr ON pr.id = p.user_id
  WHERE pr.role = 'admin'
  LIMIT 1
)
INSERT INTO public.appointments (user_id, property_id, status, scheduled_at, notes, service_type, frequency)
SELECT user_id, property_id, 'scheduled', now() + interval '2 days', 'Regular mosquito treatment.', 'Mosquito Service', 'monthly'
FROM admin_props
WHERE NOT EXISTS (
  SELECT 1 FROM public.appointments 
  WHERE user_id = admin_props.user_id 
  AND status = 'scheduled'
);

WITH admin_props AS (
  SELECT p.id as property_id, p.user_id
  FROM public.properties p
  JOIN public.profiles pr ON pr.id = p.user_id
  WHERE pr.role = 'admin'
  LIMIT 1
)
INSERT INTO public.appointments (user_id, property_id, status, scheduled_at, notes, service_type, frequency)
SELECT user_id, property_id, 'completed', now() - interval '14 days', 'Initial property assessment and treatment.', 'Mosquito Service', 'single'
FROM admin_props
WHERE NOT EXISTS (
  SELECT 1 FROM public.appointments 
  WHERE user_id = admin_props.user_id 
  AND status = 'completed'
);

-- 4. Add mock videos for the admin (via job_media and assignments)
WITH admin_apps AS (
  SELECT a.id as appointment_id
  FROM public.appointments a
  JOIN public.profiles pr ON pr.id = a.user_id
  WHERE pr.role = 'admin'
  LIMIT 1
)
INSERT INTO public.assignments (appointment_id, status, arrive_at, start_at, complete_at)
SELECT appointment_id, 'completed', now() - interval '14 days' - interval '2 hours', now() - interval '14 days' - interval '1 hour', now() - interval '14 days'
FROM admin_apps
WHERE NOT EXISTS (
  SELECT 1 FROM public.assignments 
  WHERE appointment_id = admin_apps.appointment_id
);

WITH admin_assigns AS (
  SELECT ass.id as assignment_id
  FROM public.assignments ass
  JOIN public.appointments a ON a.id = ass.appointment_id
  JOIN public.profiles pr ON pr.id = a.user_id
  WHERE pr.role = 'admin'
  LIMIT 1
)
INSERT INTO public.job_media (assignment_id, media_type, url, caption)
SELECT assignment_id, 'video', 'https://vimeo.com/76979871', 'HD recap of initial treatment areas and property assessment.'
FROM admin_assigns
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_media 
  WHERE assignment_id = admin_assigns.assignment_id
);

-- 5. Add mock messages for the admin
WITH admin_assigns AS (
  SELECT ass.id as assignment_id
  FROM public.assignments ass
  JOIN public.appointments a ON a.id = ass.appointment_id
  JOIN public.profiles pr ON pr.id = a.user_id
  WHERE pr.role = 'admin'
  LIMIT 1
)
INSERT INTO public.message_threads (assignment_id, customer_visible, last_activity_at)
SELECT assignment_id, true, now()
FROM admin_assigns
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_threads 
  WHERE assignment_id = admin_assigns.assignment_id
);

WITH admin_threads AS (
  SELECT t.id as thread_id
  FROM public.message_threads t
  JOIN public.assignments ass ON ass.id = t.assignment_id
  JOIN public.appointments a ON a.id = ass.appointment_id
  JOIN public.profiles pr ON pr.id = a.user_id
  WHERE pr.role = 'admin'
  LIMIT 1
)
INSERT INTO public.messages (thread_id, body, direction, channel, created_at)
SELECT thread_id, 'Hello, I will be arriving in about 15 minutes for your mosquito treatment.', 'outbound', 'in_app', now() - interval '14 days' - interval '3 hours'
FROM admin_threads
WHERE NOT EXISTS (
  SELECT 1 FROM public.messages 
  WHERE thread_id = admin_threads.thread_id 
  AND body LIKE 'Hello, I will be arriving%'
);

WITH admin_threads AS (
  SELECT t.id as thread_id
  FROM public.message_threads t
  JOIN public.assignments ass ON ass.id = t.assignment_id
  JOIN public.appointments a ON a.id = ass.appointment_id
  JOIN public.profiles pr ON pr.id = a.user_id
  WHERE pr.role = 'admin'
  LIMIT 1
)
INSERT INTO public.messages (thread_id, body, direction, channel, created_at)
SELECT thread_id, 'Great, thank you for letting me know! The gate code is 1234.', 'inbound', 'in_app', now() - interval '14 days' - interval '2.5 hours'
FROM admin_threads
WHERE NOT EXISTS (
  SELECT 1 FROM public.messages 
  WHERE thread_id = admin_threads.thread_id 
  AND body LIKE 'Great, thank you for letting me know%'
);
