-- Seed data for admin panel testing
-- Populates tickets, invoices, and updates profiles/properties/appointments for admin@nnm.com

DO $$
DECLARE
  admin_id UUID;
  prop_id UUID;
BEGIN
  -- Find admin user by email
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@nnm.com' LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE NOTICE 'admin@nnm.com not found in auth.users. Please create that user first.';
    RETURN;
  END IF;

  -- Ensure profile exists (idempotent upsert)
  INSERT INTO public.profiles (id, name, email, phone, role, created_at, updated_at, status)
  VALUES (admin_id, 'Elijah Noble', 'admin@nnm.com', '(949) 555-0123', 'admin', NOW(), NOW(), 'active')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = 'admin',
    status = 'active',
    updated_at = NOW();

  -- Try to get one property for admin to link tickets/appointments
  SELECT id INTO prop_id FROM public.properties WHERE user_id = admin_id LIMIT 1;

  -- If no property for admin exists, create one (idempotent check by address)
  IF prop_id IS NULL THEN
    INSERT INTO public.properties (user_id, address, zip, city, state, label, acreage, created_at, updated_at)
    SELECT admin_id, '18 Ocean Vista, Newport Beach, CA 92657', '92657', 'Newport Beach', 'CA', 'Home', 0.25, NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.properties WHERE user_id = admin_id AND address = '18 Ocean Vista, Newport Beach, CA 92657'
    )
    RETURNING id INTO prop_id;
  END IF;

  -- Update label/state to admin property if those columns exist (redundant if just created, but good for existing)
  UPDATE public.properties
  SET
    label = COALESCE(label, 'Home'),
    state = COALESCE(state, 'CA'),
    city = COALESCE(city, 'Newport Beach'),
    updated_at = NOW()
  WHERE user_id = admin_id
    AND id = prop_id;

  -- Insert sample tickets
  -- Open ticket
  INSERT INTO public.tickets (user_id, property_id, subject, description, priority, status, created_at, updated_at)
  SELECT admin_id, prop_id, 'Test: Mosquito treatment follow-up', 'Please re-check backyard fence line for missed spots.', 'medium', 'open', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.user_id = admin_id AND t.subject = 'Test: Mosquito treatment follow-up'
  );

  -- Resolved ticket
  INSERT INTO public.tickets (user_id, property_id, subject, description, priority, status, created_at, updated_at)
  SELECT admin_id, prop_id, 'Test: Billing question resolved', 'Customer asked about invoice; resolved in support thread.', 'low', 'resolved', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.user_id = admin_id AND t.subject = 'Test: Billing question resolved'
  );

  -- Insert sample invoices
  INSERT INTO public.invoices (user_id, amount, currency, status, description, due_at, created_at, updated_at)
  SELECT admin_id, 125.00, 'USD', 'open', 'Test invoice — monthly mosquito service', NOW() + INTERVAL '7 days', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.user_id = admin_id AND i.amount = 125.00 AND i.status = 'open' AND i.description = 'Test invoice — monthly mosquito service'
  );

  INSERT INTO public.invoices (user_id, amount, currency, status, description, due_at, created_at, updated_at)
  SELECT admin_id, 110.00, 'USD', 'overdue', 'Test invoice — overdue sample', NOW() - INTERVAL '14 days', NOW() - INTERVAL '21 days', NOW() - INTERVAL '14 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.user_id = admin_id AND i.amount = 110.00 AND i.status = 'overdue' AND i.description = 'Test invoice — overdue sample'
  );

  -- Update existing appointments with scheduled_start and scheduled_end
  UPDATE public.appointments
  SET scheduled_start = COALESCE(scheduled_start, scheduled_at - INTERVAL '30 minutes'),
      scheduled_end = COALESCE(scheduled_end, scheduled_at + INTERVAL '30 minutes'),
      updated_at = NOW()
  WHERE user_id = admin_id
    AND (scheduled_start IS NULL OR scheduled_end IS NULL);

  RAISE NOTICE 'Seeding completed for admin@nnm.com (user id: %). property_id: %', admin_id, prop_id;
END $$;
