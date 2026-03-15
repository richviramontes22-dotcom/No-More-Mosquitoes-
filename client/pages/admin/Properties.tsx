import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
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
  ChevronRight,
  Home
} from "lucide-react";
import { properties as seed, Property, findCustomer } from "@/data/admin";

const Properties = () => {
  const [items, setItems] = useState<Property[]>(() => seed.slice());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => `${p.address1} ${p.city} ${p.state} ${p.zip}`.toLowerCase().includes(q));
  }, [items, query]);

  const addProperty = (p: Omit<Property, "id">) => {
    const next: Property = { ...p, id: `p_${Math.floor(Math.random() * 1e6)}` };
    setItems((prev) => [next, ...prev]);
  };

  return (
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Inventory"
          title="Service Locations"
          description="Global directory of all customer addresses, acreage data, and property labels."
        />
        <Dialog>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-brand">
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Button>
          </DialogTrigger>
          <NewPropertyDialog onCreate={addProperty} />
        </Dialog>
      </div>

      <div className="relative max-w-md bg-muted/20 p-4 rounded-[24px] border border-border/40">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by address or city..."
          className="pl-10 rounded-xl bg-background border-border/60"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden mb-10">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-none">
                  <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Address</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Location</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Acreage</TableHead>
                  <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/20 transition-colors border-border/40 group">
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/5 text-primary flex items-center justify-center">
                          <Home className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{p.address1}</span>
                          <Badge variant="secondary" className="w-fit text-[9px] uppercase font-bold px-1.5 py-0 bg-muted border-none">
                            {p.label}
                          </Badge>
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
                        <span className="font-bold text-sm">{p.acreage}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">AC</span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium">{findCustomer(p.customerId).name}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const NewPropertyDialog = ({ onCreate }: { onCreate: (p: Omit<Property, "id">) => void }) => {
  const [customerId, setCustomerId] = useState("");
  const [label, setLabel] = useState("Home");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("CA");
  const [zip, setZip] = useState("");
  const [acreage, setAcreage] = useState(0.2);

  const valid = customerId && address1.trim() && city.trim() && zip.trim();

  return (
    <DialogContent className="max-w-xl rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
      <div className="bg-primary/5 p-8 border-b border-border/40">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-display font-bold text-primary flex items-center gap-2">
            <Home className="h-6 w-6" /> Register Property
          </DialogTitle>
          <DialogDescription className="text-base">
            Attach a new service location to an existing customer account.
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
            >
              <option value="">Select customer...</option>
              {Array.from(new Set(seed.map((p) => p.customerId))).map((cid) => (
                <option key={cid} value={cid}>
                  {findCustomer(cid).name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Property Label</label>
              <Input placeholder="e.g., Primary Residence" value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Acreage</label>
              <Input type="number" step="0.01" value={acreage} onChange={(e) => setAcreage(parseFloat(e.target.value))} className="rounded-xl h-12" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">Street Address</label>
            <Input placeholder="123 Main St" value={address1} onChange={(e) => setAddress1(e.target.value)} className="rounded-xl h-12" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">City</label>
              <Input placeholder="Newport Beach" value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">State</label>
              <Input placeholder="CA" value={state} onChange={(e) => setState(e.target.value)} className="rounded-xl h-12 uppercase" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground pl-1">ZIP</label>
              <Input placeholder="92660" value={zip} onChange={(e) => setZip(e.target.value)} className="rounded-xl h-12" />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="p-8 bg-muted/30 border-t border-border/40 flex gap-3">
        <Button
          className="rounded-xl h-12 flex-1 shadow-brand font-bold"
          disabled={!valid}
          onClick={() =>
            onCreate({ customerId, label: label.trim(), address1: address1.trim(), city: city.trim(), state: state.trim(), zip: zip.trim(), acreage, notes: "" })
          }
        >
          Create Property Record
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default Properties;
