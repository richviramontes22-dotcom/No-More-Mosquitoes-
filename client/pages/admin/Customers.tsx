import { useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Input } from "@/components/ui/input";
import { Label as FormLabel } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Plus,
  User,
  Mail,
  Phone,
  Calendar,
  ChevronRight,
  Filter,
  MoreHorizontal,
  ShieldCheck as ShieldCheckIcon,
  Clock,
  Loader2
} from "lucide-react";
import {
  customers as seedCustomers,
  properties as seedProperties,
  invoices as seedInvoices,
  messages as seedMessages,
  getCustomerProperties,
  getCustomerInvoices,
  getCustomerMessages,
  Customer,
  CustomerStatus,
  findCustomer,
} from "@/data/admin";
import { formatCurrency } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<CustomerStatus, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-amber-100 text-amber-700 border-amber-200",
  canceled: "bg-red-100 text-red-700 border-red-200",
};

const Customers = () => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>(() => seedCustomers.slice());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: Customer[] = data.map(p => ({
          id: p.id,
          name: p.name || "Unknown",
          email: p.email || "",
          phone: p.phone || "",
          status: (p.role === "admin" ? "active" : "active") as any, // Placeholder status mapping
          createdAt: p.created_at
        }));
        setCustomers(mapped);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesQuery = !q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q);
      const matchesStatus = status === "all" || c.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [customers, query, status]);

  const addCustomer = async (c: Omit<Customer, "id">) => {
    toast({ title: "Operation Restricted", description: "Manual customer creation via admin is restricted to Supabase Auth." });
    // In a real scenario, you'd use supabase.auth.admin to create users
  };

  return (
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Management"
          title="Customer Database"
          description="Search and manage profiles, properties, subscriptions, and communication."
        />
        <Dialog>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-brand">
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <NewCustomerDialog onCreate={addCustomer} />
        </Dialog>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between bg-muted/20 p-4 rounded-[24px] border border-border/40">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, or phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 rounded-xl bg-background border-border/60"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">
            <Filter className="h-3 w-3" />
            Status
          </div>
          <select
            aria-label="Filter by status"
            className="h-10 rounded-xl border border-border/60 bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
      </div>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden mb-10">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-none">
                  <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Contact</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-center">Properties</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Joined</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Status</TableHead>
                  <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center bg-muted/5">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40 mb-2" />
                      <span className="text-muted-foreground italic">Loading customers...</span>
                    </TableCell>
                  </TableRow>
                ) : filtered.length > 0 ? (
                  filtered.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/20 transition-colors border-border/40 group">
                      <TableCell className="pl-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {c.name.charAt(0)}
                          </div>
                          <span className="font-bold text-sm">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                            <Mail className="h-3 w-3 text-muted-foreground" /> {c.email}
                          </span>
                          <span className="flex items-center gap-1.5 text-muted-foreground italic">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5 text-center">
                        <Badge variant="secondary" className="bg-muted text-foreground font-bold border-none">
                          {getCustomerProperties(c.id).length}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 text-xs font-medium text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge variant="outline" className={`capitalize font-bold border-none ${statusColors[c.status]}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-8 py-5 text-right">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="ghost" size="sm" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all" onClick={() => setSelectedId(c.id)}>
                              View Details <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <CustomerDetailsSheet customerId={c.id} />
                        </Sheet>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center text-muted-foreground italic bg-muted/5">
                      No customers found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const CustomerDetailsSheet = ({ customerId }: { customerId: string }) => {
  const c = findCustomer(customerId);
  const props = getCustomerProperties(customerId);
  const inv = getCustomerInvoices(customerId);
  const threads = getCustomerMessages(customerId);

  return (
    <SheetContent className="w-full sm:max-w-3xl p-0 border-none">
      <SheetHeader className="p-8 bg-primary/5 border-b border-border/40">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
            {c.name.charAt(0)}
          </div>
          <div>
            <SheetTitle className="text-2xl font-display font-bold">{c.name}</SheetTitle>
            <SheetDescription className="font-medium text-muted-foreground flex items-center gap-2">
              <Badge variant="outline" className={`capitalize font-bold border-none ${statusColors[c.status]}`}>{c.status}</Badge>
              <span>{c.email}</span>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="px-8 py-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="bg-muted/50 p-1 rounded-xl w-full justify-start mb-8">
            <TabsTrigger value="profile" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Profile</TabsTrigger>
            <TabsTrigger value="properties" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Properties</TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Invoices</TabsTrigger>
            <TabsTrigger value="messages" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-0 outline-none">
            <div className="grid gap-8">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Phone Number</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" /> {c.phone}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Customer Since</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/20 p-6 border border-border/40">
                <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <ShieldCheckIcon className="h-4 w-4 text-primary" /> Account Metadata
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User ID</span>
                    <span className="font-mono text-[10px]">{c.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">System Role</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">Customer</Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="properties" className="mt-0 outline-none">
            <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-none">
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6 py-3">Label</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest py-3">Address</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest py-3 text-right pr-6">Acreage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.map((p) => (
                    <TableRow key={p.id} className="border-border/40">
                      <TableCell className="pl-6 py-4">
                        <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-bold text-[10px] uppercase">{p.label}</Badge>
                      </TableCell>
                      <TableCell className="py-4 text-sm font-medium">
                        {p.address1}, {p.city} {p.zip}
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6 font-bold text-sm">
                        {p.acreage} <span className="text-[10px] text-muted-foreground font-medium uppercase ml-0.5">AC</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="mt-0 outline-none">
            <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-none">
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6 py-3">Date</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest py-3">Total</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest py-3">Status</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest py-3 text-right pr-6">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.map((i) => (
                    <TableRow key={i.id} className="border-border/40">
                      <TableCell className="pl-6 py-4 text-sm font-medium">{new Date(i.date).toLocaleDateString()}</TableCell>
                      <TableCell className="py-4 font-bold text-sm">{formatCurrency(i.total)}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider ${i.status === 'paid' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                          {i.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6 text-sm text-muted-foreground">{new Date(i.dueDate).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-0 outline-none">
            <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {threads.length > 0 ? threads.map((t) => (
                <div key={t.id} className="rounded-2xl border border-border/40 p-5 bg-card hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-bold text-sm text-foreground">{t.subject}</div>
                    <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(t.lastMessageAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {t.messages.map((m) => (
                      <div key={m.id} className={`flex flex-col ${m.from === 'Team' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                          m.from === 'Team'
                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                            : 'bg-muted text-foreground rounded-tl-none'
                        }`}>
                          {m.body}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 px-1 font-bold uppercase tracking-widest">{m.from}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 bg-muted/10 rounded-[32px] border border-dashed border-border/60">
                  <p className="text-muted-foreground font-medium italic">No message history available.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SheetContent>
  );
};

const NewCustomerDialog = ({ onCreate }: { onCreate: (c: Omit<Customer, "id">) => void }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("active");

  const valid = name.trim() && /.+@.+/.test(email) && phone.trim();

  return (
    <DialogContent className="max-w-lg rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
      <div className="bg-primary/5 p-8 border-b border-border/40">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-display font-bold text-primary flex items-center gap-2">
            <Plus className="h-6 w-6" /> Create New Profile
          </DialogTitle>
          <DialogDescription className="text-base">
            Initialize a new customer account record in the system.
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="p-8 space-y-6">
        <div className="grid gap-5">
          <div className="space-y-2">
            <FormLabel htmlFor="c-name" className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Full Name</FormLabel>
            <Input id="c-name" placeholder="e.g., John Smith" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-12" />
          </div>
          <div className="space-y-2">
            <FormLabel htmlFor="c-email" className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Email Address</FormLabel>
            <Input id="c-email" type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-12" />
          </div>
          <div className="space-y-2">
            <FormLabel htmlFor="c-phone" className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Phone Number</FormLabel>
            <Input id="c-phone" placeholder="(949) 555-0123" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl h-12" />
          </div>
          <div className="space-y-2">
            <FormLabel htmlFor="c-status" className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Initial Status</FormLabel>
            <select
              id="c-status"
              className="h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomerStatus)}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>
      </div>

      <DialogFooter className="p-8 bg-muted/30 border-t border-border/40 flex gap-3">
        <Button
          className="rounded-xl h-12 flex-1 shadow-brand font-bold"
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            onCreate({ name: name.trim(), email: email.trim(), phone: phone.trim(), status, createdAt: new Date().toISOString() });
          }}
        >
          Initialize Account
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default Customers;
