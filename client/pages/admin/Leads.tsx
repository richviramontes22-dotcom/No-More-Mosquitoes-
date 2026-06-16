import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { AdminOwnershipBadge } from "@/components/admin/AdminOwnershipBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useAdminLeads } from "@/hooks/admin/useAdminLeads";

const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  manual_review: "bg-amber-100 text-amber-800",
  scheduled: "bg-green-100 text-green-800",
  out_of_area: "bg-slate-100 text-slate-700",
  contacted: "bg-indigo-100 text-indigo-800",
  quoted: "bg-violet-100 text-violet-800",
  lost: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  manual_review: "Manual Review",
  scheduled: "Scheduled",
  out_of_area: "Out of Area",
  contacted: "Contacted",
  quoted: "Quoted",
  lost: "Lost",
};

const SOURCE_LABEL: Record<string, string> = {
  quote: "Quote",
  manual_review: "Manual Review",
  schedule_request: "Schedule Request",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const PAGE_SIZE = 25;

const AdminLeads = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Debounce search input so we don't fire a request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [status, source, debouncedSearch]);

  const { leads, total, isLoading, error } = useAdminLeads({
    status: status === "all" ? undefined : status,
    source: source === "all" ? undefined : source,
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="CRM"
          title="Lead Inbox"
          description="Every prospect captured from instant quotes, manual reviews, and schedule requests."
        />
        <AdminOwnershipBadge kind="primary" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between bg-muted/20 p-4 rounded-[24px] border border-border/40">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone, or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl bg-background border-border/60"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">
            <Filter className="h-3 w-3" />
            Filters
          </div>
          <select
            aria-label="Filter by status"
            className="h-10 rounded-xl border border-border/60 bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="out_of_area">Out of Area</option>
            <option value="contacted">Contacted</option>
            <option value="quoted">Quoted</option>
            <option value="manual_review">Manual Review</option>
            <option value="scheduled">Scheduled</option>
            <option value="lost">Lost</option>
          </select>
          <select
            aria-label="Filter by source"
            className="h-10 rounded-xl border border-border/60 bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">All sources</option>
            <option value="quote">Quote</option>
            <option value="manual_review">Manual Review</option>
            <option value="schedule_request">Schedule Request</option>
            <option value="waitlist">Waitlist</option>
          </select>
        </div>
      </div>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-none">
                  <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Status</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Source</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Address</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Name</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Email</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Phone</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Acreage</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Created</TableHead>
                  <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center bg-muted/5">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40 mb-2" />
                      <span className="text-muted-foreground italic">Loading leads...</span>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center text-destructive bg-muted/5">
                      Failed to load leads: {error}
                    </TableCell>
                  </TableRow>
                ) : leads.length > 0 ? (
                  leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      onClick={() => navigate(`/admin/leads/${lead.id}`)}
                      className="hover:bg-muted/20 transition-colors border-border/40 cursor-pointer"
                    >
                      <TableCell className="pl-8 py-5">
                        <Badge variant="outline" className={`font-bold border-none ${STATUS_BADGE[lead.status] ?? "bg-muted text-foreground"}`}>
                          {STATUS_LABEL[lead.status] ?? lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 text-sm text-muted-foreground">
                        {SOURCE_LABEL[lead.source] ?? lead.source}
                      </TableCell>
                      <TableCell className="py-5 text-sm font-medium max-w-xs truncate">
                        {lead.address || "—"}
                        {lead.zip ? <span className="text-muted-foreground"> {lead.zip}</span> : null}
                      </TableCell>
                      <TableCell className="py-5 text-sm font-semibold">{lead.name || "—"}</TableCell>
                      <TableCell className="py-5 text-sm text-muted-foreground">{lead.email || "—"}</TableCell>
                      <TableCell className="py-5 text-sm text-muted-foreground">{lead.phone || "—"}</TableCell>
                      <TableCell className="py-5 text-sm text-right">{lead.acreage != null ? `${lead.acreage} ac` : "—"}</TableCell>
                      <TableCell className="py-5 text-xs font-medium text-muted-foreground">{formatDateTime(lead.created_at)}</TableCell>
                      <TableCell className="pr-8 py-5 text-xs font-medium text-muted-foreground">{formatDateTime(lead.last_seen_at)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center text-muted-foreground italic bg-muted/5">
                      No leads found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} lead{total === 1 ? "" : "s"})
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeads;
