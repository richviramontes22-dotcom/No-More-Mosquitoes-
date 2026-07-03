import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Plus,
  Pencil,
  PowerOff,
  Power,
  Search,
  ExternalLink,
  Loader2,
  AlertCircle,
  ImageOff,
  Store,
  Tag,
} from "lucide-react";

interface CatalogRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  fulfillment_type: string;
  price_type: string;
  price_cents: number | null;
  min_price_cents: number | null;
  max_price_cents: number | null;
  image_url: string | null;
  active: boolean;
  is_featured: boolean;
  display_order: number;
}

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  category: "product",
  fulfillment_type: "appointment",
  price_type: "fixed",
  price_cents: "",
  min_price_cents: "",
  max_price_cents: "",
  image_url: "",
  requires_property: true,
  requires_schedule: false,
  requires_consultation: false,
  active: true,
  is_featured: false,
  display_order: "99",
};
type FormState = typeof EMPTY_FORM;

const CATEGORIES = ["add_on", "product", "consultation", "service"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  add_on: "Add-On",
  product: "Product",
  consultation: "Consultation",
  service: "Service",
};
const FULFILLMENT_TYPES = ["appointment", "shipped", "consultation", "digital"] as const;
const PRICE_TYPES = ["fixed", "free", "range", "consultation"] as const;

const formatCents = (c: number | null) => {
  if (c === null) return "—";
  return `$${(c / 100).toFixed(2)}`;
};

const formatPriceDisplay = (row: CatalogRow): string => {
  switch (row.price_type) {
    case "fixed":
      return formatCents(row.price_cents);
    case "free":
      return "Free";
    case "range":
      return `${formatCents(row.min_price_cents)} – ${formatCents(row.max_price_cents)}`;
    case "consultation":
      return "Custom quote";
    default:
      return "—";
  }
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function validateForm(form: FormState): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Name is required.");
  if (!form.slug.trim()) errors.push("Slug is required.");
  if (form.slug.trim() && !/^[a-z0-9-]+$/.test(form.slug.trim()))
    errors.push("Slug must be URL-safe (lowercase letters, numbers, hyphens only).");
  if (!CATEGORIES.includes(form.category as any)) errors.push("Category is invalid.");
  if (!FULFILLMENT_TYPES.includes(form.fulfillment_type as any))
    errors.push("Fulfillment type is invalid.");
  if (!PRICE_TYPES.includes(form.price_type as any)) errors.push("Price type is invalid.");
  if (form.price_type === "fixed") {
    const p = Number(form.price_cents);
    if (!form.price_cents || isNaN(p) || p < 0)
      errors.push("Fixed price requires a valid price in cents.");
  }
  if (form.price_type === "range") {
    const mn = Number(form.min_price_cents);
    const mx = Number(form.max_price_cents);
    if (!form.min_price_cents || isNaN(mn) || mn < 0)
      errors.push("Range price requires a valid minimum price in cents.");
    if (!form.max_price_cents || isNaN(mx) || mx < 0)
      errors.push("Range price requires a valid maximum price in cents.");
    if (!isNaN(mn) && !isNaN(mx) && mn > mx)
      errors.push("Minimum price must be less than or equal to maximum price.");
  }
  if (form.image_url.trim() && !/^https?:\/\/.+/.test(form.image_url.trim()))
    errors.push("Image URL must start with http:// or https://.");
  const order = Number(form.display_order);
  if (isNaN(order)) errors.push("Display order must be a number.");
  return errors;
}

function rowToForm(row: CatalogRow): FormState {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    category: row.category,
    fulfillment_type: row.fulfillment_type,
    price_type: row.price_type,
    price_cents: row.price_cents !== null ? String(row.price_cents) : "",
    min_price_cents: row.min_price_cents !== null ? String(row.min_price_cents) : "",
    max_price_cents: row.max_price_cents !== null ? String(row.max_price_cents) : "",
    image_url: row.image_url ?? "",
    requires_property: true,
    requires_schedule: false,
    requires_consultation: row.price_type === "consultation",
    active: row.active,
    is_featured: row.is_featured,
    display_order: String(row.display_order),
  };
}

function formToPayload(form: FormState) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    category: form.category,
    fulfillment_type: form.fulfillment_type,
    price_type: form.price_type,
    price_cents:
      form.price_type === "fixed" ? Number(form.price_cents) : null,
    min_price_cents:
      form.price_type === "range" ? Number(form.min_price_cents) : null,
    max_price_cents:
      form.price_type === "range" ? Number(form.max_price_cents) : null,
    image_url: form.image_url.trim() || null,
    requires_property: form.requires_property,
    requires_schedule: form.requires_schedule,
    requires_consultation: form.requires_consultation,
    active: form.active,
    is_featured: form.is_featured,
    display_order: Number(form.display_order),
  };
}

export default function CatalogManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/cms/catalog", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setFormErrors([]);
    setDialogOpen(true);
  };

  const openEdit = (row: CatalogRow) => {
    setEditingItem(row);
    setForm(rowToForm(row));
    setFormErrors([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const errors = validateForm(form);
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);
    setSaving(true);
    try {
      const token = await getToken();
      const payload = formToPayload(form);
      const url = editingItem
        ? `/api/admin/cms/catalog/${editingItem.id}`
        : "/api/admin/cms/catalog";
      const method = editingItem ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      toast({
        title: editingItem ? "Item updated" : "Item created",
        description: `"${payload.name}" saved successfully.`,
      });
      setDialogOpen(false);
      await fetchItems();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: CatalogRow) => {
    setTogglingId(row.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/cms/catalog/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !row.active }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      toast({
        title: row.active ? "Item deactivated" : "Item activated",
        description: `"${row.name}" is now ${row.active ? "inactive" : "active"}.`,
      });
      await fetchItems();
    } catch (e: any) {
      toast({ title: "Toggle failed", description: e.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleNameChange = (v: string) => {
    setField("name", v);
    if (!editingItem) setField("slug", slugify(v));
  };

  // Derived stats
  const total = items.length;
  const active = items.filter((i) => i.active).length;
  const inactive = total - active;
  const missingDesc = items.filter((i) => !i.description).length;
  const missingImg = items.filter((i) => !i.image_url).length;
  const consultationCount = items.filter((i) => i.price_type === "consultation").length;

  // Filtered table rows
  const filtered = items.filter((row) => {
    const matchSearch =
      !search ||
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.slug.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || row.category === filterCategory;
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && row.active) ||
      (filterStatus === "inactive" && !row.active);
    return matchSearch && matchCat && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Catalog Management</h1>
            <p className="text-sm text-muted-foreground">Manage marketplace products and services</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/marketplace"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Customer view
          </a>
          <Button onClick={openCreate} className="rounded-xl gap-2 h-9">
            <Plus className="h-4 w-4" />
            New Item
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { label: "Total", value: total, color: "text-foreground" },
          { label: "Active", value: active, color: "text-emerald-600" },
          { label: "Inactive", value: inactive, color: "text-muted-foreground" },
          { label: "No Description", value: missingDesc, color: missingDesc > 0 ? "text-amber-600" : "text-muted-foreground" },
          { label: "No Image", value: missingImg, color: missingImg > 0 ? "text-amber-600" : "text-muted-foreground" },
          { label: "Consultation", value: consultationCount, color: "text-blue-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border/60 bg-card p-3 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 rounded-xl text-sm"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-9 w-40 rounded-xl text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="h-9 w-36 rounded-xl text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterCategory !== "all" || filterStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-xl text-xs"
            onClick={() => { setSearch(""); setFilterCategory("all"); setFilterStatus("all"); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading catalog…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchItems} className="ml-auto rounded-lg h-8">
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Package className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No items match your filters</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">
                    Price
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">
                    Sort
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-border/40 transition-colors hover:bg-muted/20 ${
                      i === filtered.length - 1 ? "border-b-0" : ""
                    } ${!row.active ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
                          {row.image_url ? (
                            <img
                              src={row.image_url}
                              alt={row.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <ImageOff className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-[160px] sm:max-w-[200px]">
                            {row.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">{row.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {CATEGORY_LABELS[row.category] ?? row.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm font-medium">
                      {formatPriceDisplay(row)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-center text-muted-foreground text-xs">
                      {row.display_order}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={`text-[11px] ${
                          row.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-muted text-muted-foreground"
                        }`}
                        variant="outline"
                      >
                        {row.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg"
                          onClick={() => openEdit(row)}
                          title="Edit item"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 rounded-lg ${
                            row.active
                              ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          }`}
                          onClick={() => handleToggleActive(row)}
                          disabled={togglingId === row.id}
                          title={row.active ? "Deactivate" : "Activate"}
                        >
                          {togglingId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : row.active ? (
                            <PowerOff className="h-3.5 w-3.5" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? `Edit: ${editingItem.name}` : "New Catalog Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {formErrors.length > 0 && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-1">
                {formErrors.map((e) => (
                  <p key={e} className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {e}
                  </p>
                ))}
              </div>
            )}

            {/* Name + Slug */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="item-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="item-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Gutter Cleaning"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-slug">
                  Slug <span className="text-destructive">*</span>
                  <span className="ml-1 text-[11px] text-muted-foreground font-normal">(URL-safe, no spaces)</span>
                </Label>
                <Input
                  id="item-slug"
                  value={form.slug}
                  onChange={(e) => setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="e.g. gutter-cleaning"
                  className="rounded-xl font-mono text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea
                id="item-desc"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Brief description shown to customers…"
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>

            {/* Category + Fulfillment */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select value={form.category} onValueChange={(v) => setField("category", v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fulfillment Type <span className="text-destructive">*</span></Label>
                <Select value={form.fulfillment_type} onValueChange={(v) => setField("fulfillment_type", v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FULFILLMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price Type + Price fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Price Type <span className="text-destructive">*</span></Label>
                <Select value={form.price_type} onValueChange={(v) => setField("price_type", v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed price</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="range">Price range (min–max)</SelectItem>
                    <SelectItem value="consultation">Consultation / custom quote</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.price_type === "fixed" && (
                <div className="space-y-1.5">
                  <Label htmlFor="price-cents">
                    Price (cents) <span className="text-destructive">*</span>
                    <span className="ml-1 text-[11px] text-muted-foreground font-normal">e.g. 4500 = $45.00</span>
                  </Label>
                  <Input
                    id="price-cents"
                    type="number"
                    min="0"
                    value={form.price_cents}
                    onChange={(e) => setField("price_cents", e.target.value)}
                    placeholder="4500"
                    className="rounded-xl"
                  />
                </div>
              )}

              {form.price_type === "range" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="min-cents">Min price (cents) <span className="text-destructive">*</span></Label>
                    <Input
                      id="min-cents"
                      type="number"
                      min="0"
                      value={form.min_price_cents}
                      onChange={(e) => setField("min_price_cents", e.target.value)}
                      placeholder="7500"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="max-cents">Max price (cents) <span className="text-destructive">*</span></Label>
                    <Input
                      id="max-cents"
                      type="number"
                      min="0"
                      value={form.max_price_cents}
                      onChange={(e) => setField("max_price_cents", e.target.value)}
                      placeholder="30000"
                      className="rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Image URL + Sort Order */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="image-url">Image URL</Label>
                <Input
                  id="image-url"
                  value={form.image_url}
                  onChange={(e) => setField("image_url", e.target.value)}
                  placeholder="https://…"
                  className="rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sort-order">Display Order</Label>
                <Input
                  id="sort-order"
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setField("display_order", e.target.value)}
                  placeholder="99"
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border/60 bg-muted/20 p-4">
              {(
                [
                  { key: "active", label: "Active", desc: "Visible to customers" },
                  { key: "is_featured", label: "Featured", desc: "Highlighted in the store" },
                  { key: "requires_property", label: "Requires Property", desc: "Customer must have a property on file" },
                  { key: "requires_schedule", label: "Requires Schedule", desc: "Must be tied to an appointment" },
                  { key: "requires_consultation", label: "Requires Consultation", desc: "Shows consultation CTA" },
                ] as Array<{ key: keyof FormState; label: string; desc: string }>
              ).map(({ key, label, desc }) => (
                <div key={String(key)} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={Boolean(form[key])}
                    onCheckedChange={(v) => setField(key, v as any)}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingItem ? "Save Changes" : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
