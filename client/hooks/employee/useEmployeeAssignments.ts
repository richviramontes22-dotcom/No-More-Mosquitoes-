import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

export interface AssignmentRow {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  scheduled_at: string | null;
  service_type: string | null;
  notes: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  appointment_id: string | null;
}

const fetchAssignments = async (employeeId: string, date: string): Promise<AssignmentRow[]> => {
  // Fetch assignments for this employee on the given date
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  const { data, error } = await supabase
    .from("assignments")
    .select(`
      id,
      status,
      started_at,
      completed_at,
      appointment_id,
      appointments!inner (
        scheduled_at,
        service_type,
        notes,
        user_id,
        property_id
      )
    `)
    .eq("employee_id", employeeId)
    .gte("appointments.scheduled_at", dayStart)
    .lte("appointments.scheduled_at", dayEnd)
    .order("appointments.scheduled_at", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Enrich with customer + property data
  const userIds = [...new Set((data as any[]).map((r: any) => r.appointments?.user_id).filter(Boolean))];
  const propIds = [...new Set((data as any[]).map((r: any) => r.appointments?.property_id).filter(Boolean))];

  const [profilesRes, propsRes] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id, name, phone").in("id", userIds)
      : { data: [], error: null },
    propIds.length > 0
      ? supabase.from("properties").select("id, address, city, zip").in("id", propIds)
      : { data: [], error: null },
  ]);

  const profileMap: Record<string, { name: string; phone: string | null }> = {};
  (profilesRes.data || []).forEach((p: any) => {
    profileMap[p.id] = { name: p.name, phone: p.phone };
  });

  const propMap: Record<string, { address: string; city: string | null; zip: string }> = {};
  (propsRes.data || []).forEach((p: any) => {
    propMap[p.id] = { address: p.address, city: p.city, zip: p.zip };
  });

  return (data as any[]).map((row: any) => {
    const appt = row.appointments || {};
    const profile: { name?: string; phone?: string | null } = profileMap[appt.user_id] ?? {};
    const prop: { address?: string; city?: string | null; zip?: string } = propMap[appt.property_id] ?? {};
    return {
      id: row.id,
      status: row.status || "assigned",
      started_at: row.started_at,
      completed_at: row.completed_at,
      appointment_id: row.appointment_id,
      scheduled_at: appt.scheduled_at || null,
      service_type: appt.service_type || "Mosquito Service",
      notes: appt.notes || null,
      address: prop.address || null,
      city: prop.city || null,
      zip: prop.zip || null,
      customer_name: profile.name || "Customer",
      customer_phone: profile.phone || null,
    } as AssignmentRow;
  });
};

export const useEmployeeAssignments = (employeeId?: string, date?: string) => {
  const today = date || format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["employeeAssignments", employeeId, today],
    queryFn: () => fetchAssignments(employeeId!, today),
    enabled: !!employeeId,
    staleTime: 2 * 60 * 1000,
    retry: 0,
  });
};
