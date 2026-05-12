import { useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  MapPin,
  Maximize,
  User,
  Trash2,
  Loader2
} from "lucide-react";

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  acreage?: number;
  user_id: string;
  notes?: string;
  created_at: string;
  customer_name?: string;
}

interface Customer {
  id: string;
  name: string;
}

const Properties = () => {
  const [items, setItems] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Load properties and customers from Supabase
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const loadData = async () => {
      try {
        setIsLoading(true);

        // Timeout fallback: if data takes > 5 seconds, show empty state
        timeoutId = setTimeout(() => {
          console.log("[Admin Properties] Fetch timeout - showing empty state");
          setIsLoading(false);
        }, 5000);

        // Fetch customers (all non-admin profiles for dropdown)
        const { data: custData, error: custError } = await supabase
          .from("profiles")
          .select("id, name")
          .neq("role", "admin")
          .order("name", { ascending: true });

        if (custError) {
          console.error("[Admin Properties] Customer dropdown fetch error:", custError);
        } else if (custData) {
          setCustomers(custData);
          console.log(`[Admin Properties] Fetched ${custData.length} customers for dropdown`);
        }

        // Fetch properties (without relational join - safe map approach)
        const { data: propData, error: propError } = await supabase
          .from("properties")
          .select("id, address, city, state, zip, acreage, user_id, notes, created_at")
          .order("created_at", { ascending: false });

        if (propError) {
          console.error("[Admin Properties] Properties fetch error:", propError);
          setItems([]);
          return;
        }

        if (propData && propData.length > 0) {
          console.log(`[Admin Properties] Fetched ${propData.length} properties`);
          // Fetch customer data for all property owners
          const uniqueUserIds = [...new Set(propData.map((p: any) => p.user_id))];
          const { data: customerData, error: customerError } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", uniqueUserIds);

          if (customerError) {
            console.error("[Admin Properties] Customer name fetch error:", customerError);
          } else {
            console.log(`[Admin Properties] Fetched ${customerData?.length || 0} customers for properties`);
          }

          // Build customer name map
          const customerMap: Record<string, string> = {};
          if (customerData) {
            customerData.forEach((c: any) => {
              customerMap[c.id] = c.name || "Unknown";
            });
          }

          const mapped = propData.map((p: any) => ({
            id: p.id,
            address: p.address,
            city: p.city,
            state: p.state,
            zip: p.zip,
            acreage: p.acreage,
            user_id: p.user_id,
            notes: p.notes,
            created_at: p.created_at,
            customer_name: customerMap[p.user_id] || "Unknown"
          }));
          setItems(mapped);
          console.log(`[Admin Properties] Mapped ${mapped.length} properties with customer names`);
        } else {
          console.log(`[Admin Properties] No properties found`);
          setItems([]);
        }
      } catch (err) {
        console.error("[Properties] Error loading data:", err);
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => 
      `${p.address} ${p.city} ${p.state} ${p.zip} ${p.customer_name}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  const addProperty = async (p: Omit<Property, "id" | "created_at" | "customer_name">) => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .insert({
          address: p.address,
          city: p.city,
          state: p.state,
          zip: p.zip,
          acreage: p.acreage,
          user_id: p.user_id,
          notes: p.notes
        })
        .select("id, address, city, state, zip, acreage, user_id, notes, created_at");

      if (error) throw error;

      if (data && data.length > 0) {
        const newProp = data[0] as any;

        // Fetch customer name separately
        const { data: customerData } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", newProp.user_id)
          .single();

        setItems((prev) => [
          {
            id: newProp.id,
            address: newProp.address,
            city: newProp.city,
            state: newProp.state,
            zip: newProp.zip,
            acreage: newProp.acreage,
            user_id: newProp.user_id,
            notes: newProp.notes,
            created_at: newProp.created_at,
            customer_name: customerData?.name || "Unknown"
          },
          ...prev
        ]);
        setDialogOpen(false);
      }
    } catch (err) {
      console.error("[Properties] Error creating property:", err);
    }
  };

  const deleteProperty = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property?")) return;

    try {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("[Properties] Error deleting property:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading properties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Inventory"
          title="Service Locations"
          description="Global directory of all customer addresses and property details."
        />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-brand">
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Button>
          </DialogTrigger>
          <NewPropertyDialog customers={customers} onCreate={addProperty} />
        </Dialog>
      </div>

      <div className="relative max-w-md bg-muted/20 p-4 rounded-[24px] border border-border/40">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by address, city, or customer..."
          className="pl-10 rounded-xl bg-background border-border/60"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden mb-10">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No properties found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-none">
                    <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Address</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Location</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Acreage</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                    <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/20 transition-colors border-border/40 group">
                      <TableCell className="pl-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/5 text-primary flex items-center justify-center">
                            <MapPin className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground">{p.address}</span>
                            {p.notes && (
                              <Badge variant="secondary" className="w-fit text-[9px] uppercase font-bold px-1.5 py-0 bg-muted border-none mt-1">
                                {p.notes.substring(0, 20)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                            <MapPin className="h-3 w-3" /> {p.city}
                          </span>
                          <span className="italic">{p.state} {p.zip}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex items-center gap-2">
                          <Maximize className="h-3.5 w-3.5 text-primary" />
                          <span className="font-bold text-sm">{p.acreage || "—"}</span>
                          {p.acreage && <span className="text-[10px] font-bold text-muted-foreground uppercase">AC</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <span className="text-sm font-medium">{p.customer_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-8 py-5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProperty(p.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const NewPropertyDialog = ({ customers, onCreate }: { customers: Customer[], onCreate: (p: Omit<Property, "id" | "created_at" | "customer_name">) => Promise<void> }) => {
  const [customerId, setCustomerId] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("CA");
  const [zip, setZip] = useState("");
  const [acreage, setAcreage] = useState(0.2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const valid = customerId && address.trim() && city.trim() && zip.trim();

  const handleCreate = async () => {
    if (!valid) return;
    try {
      setIsSubmitting(true);
      await onCreate({
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        acreage,
        user_id: customerId,
        notes: ""
      });
      // Reset form
      setCustomerId("");
      setAddress("");
      setCity("");
      setState("CA");
      setZip("");
      setAcreage(0.2);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-xl rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
      <div className="bg-primary/5 p-8 border-b border-border/40">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-display font-bold text-primary flex items-center gap-2">
            <MapPin className="h-6 w-6" /> Register Property
          </DialogTitle>
          <DialogDescription className="text-base">
            Add a new service location for a customer.
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="p-8 space-y-6">
        <div className="grid gap-5">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Assign to Customer</label>
            <select
              className="h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Acreage</label>
              <Input
                type="number"
                step="0.01"
                value={acreage}
                onChange={(e) => setAcreage(parseFloat(e.target.value) || 0.2)}
                className="rounded-xl h-12"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">ZIP Code</label>
              <Input
                placeholder="92660"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="rounded-xl h-12"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Street Address</label>
            <Input
              placeholder="123 Main St"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="rounded-xl h-12"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">City</label>
              <Input
                placeholder="Newport Beach"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="rounded-xl h-12"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">State</label>
              <Input
                placeholder="CA"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="rounded-xl h-12 uppercase"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="p-8 bg-muted/30 border-t border-border/40 flex gap-3">
        <Button
          className="rounded-xl h-12 flex-1 shadow-brand font-bold"
          disabled={!valid || isSubmitting}
          onClick={handleCreate}
        >
          {isSubmitting ? "Creating..." : "Create Property"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default Properties;
