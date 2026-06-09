import { useState, useEffect, useCallback } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  UserPlus,
  Loader2,
  Mail,
  Phone,
  Truck,
  Edit2,
  PowerOff,
  Power,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { AdminLoadingState, AdminEmptyState } from "@/components/admin/AdminState";

interface EmployeeRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: "technician" | "dispatcher" | "admin";
  worker_type: "employee" | "contractor" | "vendor" | "test";
  is_test: boolean;
  phone: string | null;
  vehicle: string | null;
  default_nav: "google" | "apple";
  status: "active" | "inactive";
  gps_consent_at: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  technician: "Technician",
  dispatcher: "Dispatcher",
  admin: "Admin",
};

const Employees = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite dialog state
  const [showInvite, setShowInvite] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [invite, setInvite] = useState({
    firstName: "", lastName: "", email: "", role: "technician", phone: "", vehicle: "", default_nav: "google",
    worker_type: "employee", is_test: false, generate_temp_password: false,
  });
  const [tempPasswordDisplay, setTempPasswordDisplay] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    role: "technician", phone: "", vehicle: "", default_nav: "google", status: "active",
  });

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminApi("/api/admin/employees");
      setEmployees(data);
    } catch (err: any) {
      toast({ title: "Failed to load employees", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ── Invite ────────────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite.firstName.trim() || !invite.lastName.trim() || !invite.email.trim()) {
      toast({ title: "First name, last name, and email are required.", variant: "destructive" });
      return;
    }

    setIsInviting(true);
    try {
      const data = await adminApi("/api/admin/employees/invite", "POST", {
        name: `${invite.firstName.trim()} ${invite.lastName.trim()}`,
        email: invite.email.trim(),
        role: invite.role,
        phone: invite.phone.trim() || null,
        vehicle: invite.vehicle.trim() || null,
        default_nav: invite.default_nav,
        worker_type: invite.worker_type,
        is_test: invite.is_test,
        generate_temp_password: invite.generate_temp_password,
      });
      if (data.temp_password) {
        setTempPasswordDisplay(data.temp_password);
      } else {
        toast({ title: invite.is_test ? "Test employee created!" : "Invitation sent!", description: data.message });
      }
      setShowInvite(false);
      setInvite({ firstName: "", lastName: "", email: "", role: "technician", phone: "", vehicle: "", default_nav: "google", worker_type: "employee", is_test: false, generate_temp_password: false });
      fetchEmployees();
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    } finally {
      setIsInviting(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (emp: EmployeeRow) => {
    setEditTarget(emp);
    setEditForm({
      role: emp.role,
      phone: emp.phone ?? "",
      vehicle: emp.vehicle ?? "",
      default_nav: emp.default_nav ?? "google",
      status: emp.status,
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setIsEditing(true);
    try {
      await adminApi(`/api/admin/employees/${editTarget.id}`, "PATCH", {
        role: editForm.role,
        phone: editForm.phone.trim() || null,
        vehicle: editForm.vehicle.trim() || null,
        default_nav: editForm.default_nav,
        status: editForm.status,
      });
      toast({ title: "Employee updated." });
      setEditTarget(null);
      fetchEmployees();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setIsEditing(false);
    }
  };

  // ── Toggle status ─────────────────────────────────────────────────────────
  const toggleStatus = async (emp: EmployeeRow) => {
    const newStatus = emp.status === "active" ? "inactive" : "active";
    try {
      await adminApi(`/api/admin/employees/${emp.id}`, "PATCH", { status: newStatus });

      toast({
        title: newStatus === "active" ? "Employee reactivated." : "Employee deactivated.",
      });
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, status: newStatus as "active" | "inactive" } : e))
      );
    } catch (err: any) {
      toast({ title: "Status update failed", description: err.message, variant: "destructive" });
    }
  };

  // ── Hard delete (test employees only) ────────────────────────────────────
  const handleDeleteTestEmployee = async (emp: EmployeeRow) => {
    if (!emp.is_test) return;
    if (!window.confirm(`Permanently delete test employee "${emp.name}"? This cannot be undone.`)) return;
    setIsDeletingId(emp.id);
    try {
      await adminApi(`/api/admin/employees/${emp.id}`, "DELETE");
      toast({ title: "Test employee deleted." });
      fetchEmployees();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDeletingId(null);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activeCount = employees.filter((e) => e.status === "active").length;
  const inactiveCount = employees.filter((e) => e.status === "inactive").length;
  const techCount = employees.filter((e) => e.role === "technician" && e.status === "active").length;

  return (
    <div className="grid gap-8 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading
          eyebrow="Team Management"
          title="Employees"
          description="Invite technicians and dispatchers. All accounts are admin-initiated."
        />
        <Button onClick={() => setShowInvite(true)} className="rounded-xl shadow-brand self-start sm:self-auto">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total employees", value: employees.length, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: activeCount, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
          { label: "Technicians active", value: techCount, icon: Truck, color: "text-blue-600", bg: "bg-blue-100" },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-border/60 bg-card/95 shadow-soft">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-3xl font-display font-bold text-foreground">{stat.value}</p>
              </div>
              <div className={`rounded-xl p-3 ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Employee table */}
      {isLoading ? (
        <AdminLoadingState label="Loading employees..." />
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[28px] border border-dashed border-border/60 p-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold text-foreground">No employees yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Click "Invite Employee" to send a setup link to your first technician or dispatcher.
          </p>
          <Button onClick={() => setShowInvite(true)} className="rounded-xl mt-2">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Employee
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{emp.name}</span>
                      {emp.is_test && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 border rounded px-1.5 py-0">TEST</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${emp.email}`} className="text-primary hover:underline flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {emp.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="capitalize w-fit">
                        {ROLE_LABELS[emp.role] ?? emp.role}
                      </Badge>
                      {emp.worker_type && emp.worker_type !== "employee" && (
                        <Badge variant="outline" className="capitalize w-fit text-[10px] text-muted-foreground">
                          {emp.worker_type}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {emp.phone ? (
                      <a href={`tel:${emp.phone}`} className="flex items-center gap-1.5 hover:text-primary">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {emp.phone}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {emp.vehicle ? (
                      <span className="flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 shrink-0" />
                        {emp.vehicle}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        emp.status === "active"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-gray-50 text-gray-500 border-gray-200"
                      }
                    >
                      {emp.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-8"
                        onClick={() => openEdit(emp)}
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`rounded-lg h-8 ${
                          emp.status === "active"
                            ? "text-destructive hover:bg-destructive/10 border-destructive/30"
                            : "text-green-600 hover:bg-green-50 border-green-300"
                        }`}
                        onClick={() => toggleStatus(emp)}
                      >
                        {emp.status === "active" ? (
                          <><PowerOff className="h-3.5 w-3.5 mr-1.5" />Deactivate</>
                        ) : (
                          <><Power className="h-3.5 w-3.5 mr-1.5" />Activate</>
                        )}
                      </Button>
                      {emp.is_test && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg h-8 text-destructive hover:bg-destructive/10 border-destructive/30"
                          disabled={isDeletingId === emp.id}
                          onClick={() => handleDeleteTestEmployee(emp)}
                        >
                          {isDeletingId === emp.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <PowerOff className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Inactive employees note */}
      {inactiveCount > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {inactiveCount} inactive employee{inactiveCount > 1 ? "s" : ""} hidden from the active portal.
        </p>
      )}

      {/* ── Invite Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="rounded-[28px] sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Invite Employee</DialogTitle>
            <DialogDescription>
              An email with a secure setup link will be sent. The employee clicks it to create their password and log in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 mt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inv-firstname">First Name *</Label>
                <Input
                  id="inv-firstname"
                  value={invite.firstName}
                  onChange={(e) => setInvite((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="Luis"
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-lastname">Last Name *</Label>
                <Input
                  id="inv-lastname"
                  value={invite.lastName}
                  onChange={(e) => setInvite((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Martinez"
                  className="rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inv-email">Email Address *</Label>
              <Input
                id="inv-email"
                type="email"
                value={invite.email}
                onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
                placeholder="luis@example.com"
                className="rounded-xl"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={invite.role} onValueChange={(v) => setInvite((p) => ({ ...p, role: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Navigation</Label>
                <Select value={invite.default_nav} onValueChange={(v) => setInvite((p) => ({ ...p, default_nav: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google Maps</SelectItem>
                    <SelectItem value="apple">Apple Maps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inv-phone">Phone (optional)</Label>
                <Input
                  id="inv-phone"
                  type="tel"
                  value={invite.phone}
                  onChange={(e) => setInvite((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(949) 555-0101"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-vehicle">Vehicle (optional)</Label>
                <Input
                  id="inv-vehicle"
                  value={invite.vehicle}
                  onChange={(e) => setInvite((p) => ({ ...p, vehicle: e.target.value }))}
                  placeholder="Ford Transit — 8ABC123"
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Worker type + test options */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Worker Type</Label>
                <Select value={invite.worker_type} onValueChange={(v) => setInvite((p) => ({ ...p, worker_type: v, is_test: v === "test" ? true : p.is_test }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee (W2)</SelectItem>
                    <SelectItem value="contractor">Contractor (1099)</SelectItem>
                    <SelectItem value="vendor">Vendor / Partner</SelectItem>
                    <SelectItem value="test">Test Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm pb-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={invite.is_test}
                    onChange={(e) => setInvite((p) => ({ ...p, is_test: e.target.checked }))}
                  />
                  Mark as test account
                </label>
                {invite.is_test && (
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={invite.generate_temp_password}
                      onChange={(e) => setInvite((p) => ({ ...p, generate_temp_password: e.target.checked }))}
                    />
                    Generate temp password (no email sent)
                  </label>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowInvite(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isInviting} className="rounded-xl shadow-brand">
                {isInviting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating…</>
                ) : (
                  <><Mail className="h-4 w-4 mr-2" />{invite.generate_temp_password ? "Create Test Account" : "Send Invite"}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Temp Password Display Dialog ─────────────────────────────────── */}
      <Dialog open={!!tempPasswordDisplay} onOpenChange={() => setTempPasswordDisplay(null)}>
        <DialogContent className="rounded-[28px] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Test Employee Created</DialogTitle>
            <DialogDescription>
              Save this temporary password now — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-xs text-amber-700 mb-2 font-semibold uppercase tracking-wide">Temporary Password</p>
            <p className="font-mono text-xl font-bold text-amber-900 tracking-widest">{tempPasswordDisplay}</p>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Share this securely. The employee uses it to log in at /employee/login.
          </p>
          <DialogFooter>
            <Button className="rounded-xl w-full" onClick={() => { setTempPasswordDisplay(null); fetchEmployees(); }}>
              I've saved this password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="rounded-[28px] sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Edit Employee</DialogTitle>
            <DialogDescription>
              Update {editTarget?.name ?? "this employee"}'s role, contact info, and status.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={handleEdit} className="space-y-4 mt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm((p) => ({ ...p, role: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="(949) 555-0101"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vehicle">Vehicle</Label>
                  <Input
                    id="edit-vehicle"
                    value={editForm.vehicle}
                    onChange={(e) => setEditForm((p) => ({ ...p, vehicle: e.target.value }))}
                    placeholder="Ford Transit — 8ABC123"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default Navigation</Label>
                <Select value={editForm.default_nav} onValueChange={(v) => setEditForm((p) => ({ ...p, default_nav: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google Maps</SelectItem>
                    <SelectItem value="apple">Apple Maps</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditing} className="rounded-xl shadow-brand">
                  {isEditing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
