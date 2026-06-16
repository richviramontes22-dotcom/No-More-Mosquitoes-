import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";

export interface AdminLead {
  id: string;
  source: string;
  status: string;
  address_hash: string | null;
  address: string | null;
  zip: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  acreage: number | null;
  program: string | null;
  cadence: string | null;
  manual_review_reason: string | null;
  profile_id: string | null;
  property_id: string | null;
  subscription_id: string | null;
  schedule_request_id: string | null;
  admin_alert_id: string | null;
  converted_customer_id: string | null;
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

export interface AdminLeadDetail {
  lead: AdminLead;
  activities: AdminLeadActivity[];
  linked: {
    profile: Record<string, unknown> | null;
    property: Record<string, unknown> | null;
    scheduleRequest: Record<string, unknown> | null;
    subscription: Record<string, unknown> | null;
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
 * Fetches a single lead with its activity timeline and linked records
 * (profile/property/schedule request/subscription) for the lead detail view.
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
