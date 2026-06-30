import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";

export interface AdminLeadStaffMember {
  id: string;
  name: string | null;
  email: string;
}

/** Fetches admin/employee profiles eligible to be assigned a lead or follow-up. */
export function useAdminLeadStaff() {
  const [staff, setStaff] = useState<AdminLeadStaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    adminApi("/api/admin/leads/staff")
      .then((data) => setStaff(data.staff ?? []))
      .catch(() => setStaff([]))
      .finally(() => setIsLoading(false));
  }, []);

  return { staff, isLoading };
}

export interface AdminLead {
  id: string;
  source: string;
  status: string;
  address_hash: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  acreage: number | null;
  program: string | null;
  cadence: string | null;
  manual_review_reason: string | null;
  lost_reason: string | null;
  service_state: string | null;
  service_county: string | null;
  service_zip: string | null;
  service_area_status: string | null;
  service_area_id: string | null;
  out_of_area_reason: string | null;
  profile_id: string | null;
  property_id: string | null;
  subscription_id: string | null;
  schedule_request_id: string | null;
  admin_alert_id: string | null;
  converted_customer_id: string | null;
  assigned_to: string | null;
  first_seen_at: string;
  last_seen_at: string;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  activity_count: number;
}

export interface AdminLeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  actor: "system" | "admin";
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminLeadNote {
  id: string;
  lead_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface AdminLeadFollowUp {
  id: string;
  lead_id: string;
  assigned_to: string | null;
  due_at: string;
  status: "pending" | "completed" | "skipped";
  notes: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminLeadDetail {
  lead: AdminLead;
  activities: AdminLeadActivity[];
  notes: AdminLeadNote[];
  followups: AdminLeadFollowUp[];
  linked: {
    profile: Record<string, unknown> | null;
    property: Record<string, unknown> | null;
    scheduleRequest: Record<string, unknown> | null;
    subscription: Record<string, unknown> | null;
    referral: { code: string | null; owner_type: string | null; partner_name: string | null; status: string } | null;
  };
}

export interface UseAdminLeadsOptions {
  status?: string;
  source?: string;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Fetches a page of leads for the admin Lead Inbox, with status/source/search
 * filters and sorting handled server-side by GET /api/admin/leads.
 */
export function useAdminLeads(options: UseAdminLeadsOptions = {}) {
  const { status, source, search, sort, page = 1, pageSize = 25 } = options;

  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (source) params.set("source", source);
      if (search) params.set("search", search);
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const data = await adminApi(`/api/admin/leads?${params.toString()}`);
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
      setLeads([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [status, source, search, sort, page, pageSize]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  return { leads, total, page, pageSize, isLoading, error, refetch: fetchLeads };
}

/**
 * Fetches a single lead with its activity timeline, staff notes, and linked
 * records for the lead detail view.
 */
export function useAdminLeadDetail(id: string | undefined) {
  const [detail, setDetail] = useState<AdminLeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi(`/api/admin/leads/${id}`);
      setDetail(data);
    } catch (err: any) {
      setError(err.message);
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  return { detail, isLoading, error, refetch: fetchDetail };
}

/** PATCH /api/admin/leads/:id — update lead status (admin only). */
export async function patchLeadStatus(
  id: string,
  status: string,
  lostReason?: string,
): Promise<AdminLead> {
  const body: Record<string, string> = { status };
  if (lostReason) body.lost_reason = lostReason;
  const data = await adminApi(`/api/admin/leads/${id}`, "PATCH", body);
  return data.lead as AdminLead;
}

/** POST /api/admin/leads/:id/notes — add a staff note to a lead (admin only). */
export async function postLeadNote(id: string, body: string): Promise<AdminLeadNote> {
  const data = await adminApi(`/api/admin/leads/${id}/notes`, "POST", { body });
  return data.note as AdminLeadNote;
}

/** POST /api/admin/leads/:id/assign — assign a lead to a staff member (admin only). */
export async function assignLeadTo(id: string, assignedTo: string): Promise<AdminLead> {
  const data = await adminApi(`/api/admin/leads/${id}/assign`, "POST", { assigned_to: assignedTo });
  return data.lead as AdminLead;
}

/** POST /api/admin/leads/:id/followups — create a due-dated follow-up (admin only). */
export async function postLeadFollowUp(
  id: string,
  params: { dueAt: string; assignedTo?: string; notes?: string },
): Promise<AdminLeadFollowUp> {
  const data = await adminApi(`/api/admin/leads/${id}/followups`, "POST", {
    due_at: params.dueAt,
    assigned_to: params.assignedTo,
    notes: params.notes,
  });
  return data.followup as AdminLeadFollowUp;
}

/** PATCH /api/admin/leads/followups/:followupId — mark a follow-up completed or skipped. */
export async function patchFollowUpStatus(
  followupId: string,
  status: "completed" | "skipped",
): Promise<AdminLeadFollowUp> {
  const data = await adminApi(`/api/admin/leads/followups/${followupId}`, "PATCH", { status });
  return data.followup as AdminLeadFollowUp;
}
