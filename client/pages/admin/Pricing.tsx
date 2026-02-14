import { useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { pricingTiers as seedTiers } from "@/data/site";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Pricing = () => {
  const [tiers, setTiers] = useState(() => seedTiers.map((t) => ({ ...t })));

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Pricing & Plans"
        title="Plans, cadence, and rules"
        description="Manage plans, acreage/ZIP multipliers, and promotions."
      />

      <div className="rounded-2xl border border-border/70 bg-card/95 p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tier</TableHead>
              <TableHead>Subscription (per visit)</TableHead>
              <TableHead>Annual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((t, idx) => (
              <TableRow key={t.label}>
                <TableCell className="font-medium">{t.label}</TableCell>
                <TableCell>
                  {t.subscription === "custom" ? (
                    <span className="text-muted-foreground">custom</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        className="w-24"
                        type="number"
                        min={0}
                        step={1}
                        value={t.subscription}
                        onChange={(e) =>
                          setTiers((prev) => prev.map((x, i) => (i === idx ? { ...x, subscription: Number(e.target.value) } : x)))
                        }
                      />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {t.annual === "custom" ? (
                    <span className="text-muted-foreground">custom</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        className="w-28"
                        type="number"
                        min={0}
                        step={1}
                        value={t.annual}
                        onChange={(e) =>
                          setTiers((prev) => prev.map((x, i) => (i === idx ? { ...x, annual: Number(e.target.value) } : x)))
                        }
                      />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setTiers(seedTiers.map((t) => ({ ...t })))}>
          Reset
        </Button>
        <Button onClick={() => alert("Saved pricing changes for current session.")}>Save</Button>
      </div>
    </div>
  );
};

export default Pricing;
