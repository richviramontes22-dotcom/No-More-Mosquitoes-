import { useMemo } from "react";

import { frequencyOptions, pricingTiers } from "@/data/site";
import { calculatePricing, formatCurrency } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

export type PricingTierTableProps = {
  frequencies?: Array<(typeof frequencyOptions)[number]>;
  className?: string;
};

type FrequencyPricing = ReturnType<typeof calculatePricing>;

type TierRow = {
  label: string;
  perVisit: string;
  frequencies: Record<number, string>;
  annual: string;
};

const getSampleAcreage = (min: number, max: number) => {
  if (!Number.isFinite(max)) return Math.max(min, 0.5);
  return Math.max((min + max) / 2, min + 0.01);
};

const formatValue = (value: number | null) => {
  if (value === null) return "Custom";
  return formatCurrency(value);
};

const PricingTierTable = ({ frequencies, className }: PricingTierTableProps) => {
  const { t } = useTranslation();
  
  const resolvedFrequencies = useMemo<Array<(typeof frequencyOptions)[number]>>(() => {
    if (frequencies && frequencies.length > 0) {
      return Array.from(new Set(frequencies));
    }
    return Array.from(frequencyOptions);
  }, [frequencies]);

  const rows = useMemo(() => {
    return pricingTiers
      .filter((tier) => Number.isFinite(tier.max) && tier.max <= 2)
      .map((tier) => {
        const acreage = getSampleAcreage(tier.min, tier.max);
        const subscriptionPricingByFrequency = resolvedFrequencies.reduce<Record<number, FrequencyPricing>>(
          (accumulator, frequency) => {
            accumulator[frequency] = calculatePricing({ acreage, program: "subscription", frequencyDays: frequency });
            return accumulator;
          },
          {},
        );

        const firstFrequency = resolvedFrequencies[0] ?? frequencyOptions[0];
        const perVisitValue = subscriptionPricingByFrequency[firstFrequency]?.perVisit ?? null;
        const fallbackPerVisit = typeof tier.subscription === "number" ? tier.subscription : null;
        const perVisit = perVisitValue ?? fallbackPerVisit;
        const annual = typeof tier.annual === "number" ? formatCurrency(tier.annual) : "Custom";

        return {
          label: tier.label,
          perVisit: perVisit !== null ? formatCurrency(perVisit) : "Custom",
          frequencies: Object.fromEntries(
            resolvedFrequencies.map((frequency) => [frequency, formatValue(subscriptionPricingByFrequency[frequency]?.perMonth ?? null)]),
          ),
          annual,
        } satisfies TierRow;
      });
  }, [resolvedFrequencies]);

  return (
    <section className={cn("bg-background py-16", className)}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[28px] border border-border/60 bg-card/90 shadow-soft">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Mosquito & pest control subscription pricing by acreage tier and visit frequency</caption>
            <thead className="bg-muted/60 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold text-foreground">
                  {t("pricing.acreageTier")}
                </th>
                <th scope="col" className="px-6 py-4 font-semibold text-foreground">
                  {t("pricing.perVisit")}
                </th>
                {resolvedFrequencies.map((frequency) => (
                  <th key={frequency} scope="col" className="px-6 py-4 font-semibold text-foreground">
                    {frequency}-{t("pricing.cadence")}
                  </th>
                ))}
                <th scope="col" className="px-6 py-4 font-semibold text-foreground">
                  {t("pricing.annualPrepay")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.label} className={cn(index % 2 === 0 ? "bg-background" : "bg-muted/30")}>
                  <th scope="row" className="px-6 py-5 text-sm font-semibold text-foreground">
                    {row.label}
                  </th>
                  <td className="px-6 py-5 text-sm text-muted-foreground">{row.perVisit}</td>
                  {resolvedFrequencies.map((frequency) => (
                    <td key={frequency} className="px-6 py-5 text-sm text-muted-foreground">
                      {row.frequencies[frequency]}
                    </td>
                  ))}
                  <td className="px-6 py-5 text-sm text-muted-foreground">{row.annual}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border/60 bg-muted/30 px-6 py-4 text-sm text-muted-foreground">
            {t("pricing.acreageNote")}{formatCurrency(179)} {t("pricing.perVisit")}.
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingTierTable;
