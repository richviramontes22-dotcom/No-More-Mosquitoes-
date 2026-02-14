import { FormEvent, useMemo, useState } from "react";
import { calculatePricing, formatCurrency, ProgramType } from "@/lib/pricing";
import { frequencyOptions } from "@/data/site";
import { Check, ChevronRight, MapPin, Loader, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScheduleDialog } from "@/components/schedule/ScheduleDialogProvider";
import { useTranslation } from "@/hooks/use-translation";
import { useToast } from "@/hooks/use-toast";

const QuoteWidgetSection = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [acreage, setAcreage] = useState(0.2);
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState<boolean | null>(null);
  const [program, setProgram] = useState<ProgramType>("subscription");
  const [frequency, setFrequency] = useState<(typeof frequencyOptions)[number]>(21);
  const [submitted, setSubmitted] = useState(false);
  const { open } = useScheduleDialog();

  const programLabels: Record<ProgramType, string> = {
    subscription: t("pricing.subscription"),
    annual: t("pricing.annual"),
    one_time: "$179",
  };

  const pricing = useMemo(
    () => calculatePricing({ acreage, program, frequencyDays: frequency }),
    [acreage, program, frequency],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    open({ source: "quote-widget" });
  };

  const handleAddressSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!address || !zip) {
      toast({ title: "Missing details", description: "Please enter both address and ZIP code." });
      return;
    }

    setIsSearching(true);
    setSearchSuccess(null);
    try {
      const response = await fetch("/api/regrid/parcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, zip }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to find parcel data");
      }

      const data = await response.json();
      if (data.acreage) {
        setAcreage(data.acreage);
        setSearchSuccess(true);
        toast({
          title: "Address Found!",
          description: `We've estimated your property at ${data.acreage} acres. Pricing has been updated.`
        });
      }
    } catch (error) {
      console.error("Address search error:", error);
      setSearchSuccess(false);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "We couldn't locate that address. Please use the slider instead.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 py-24">
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-40" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
              {t("quote.instant")}
            </span>
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              {t("quote.calculateTitle")}
            </h2>
            <p className="text-base text-muted-foreground">
              {t("quote.calculateDesc")}
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                {t("quote.cadenceHint")}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                {t("quote.frequencyHint")}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                {t("quote.acreageHint")}
              </li>
            </ul>
          </div>
          <form
            onSubmit={handleSubmit}
            className="rounded-[32px] border border-primary/10 bg-card/90 p-6 shadow-soft backdrop-blur lg:p-8"
          >
            <div className="grid gap-8">
              {/* Address Search via Regrid */}
              <div className="space-y-4 rounded-2xl bg-primary/5 p-4 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold text-foreground uppercase tracking-wider">Search by Address</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_100px_auto]">
                  <input
                    placeholder="123 Coastal View"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="rounded-xl border border-border/70 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    placeholder="ZIP"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    maxLength={5}
                    className="rounded-xl border border-border/70 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <Button
                    type="button"
                    onClick={handleAddressSearch}
                    disabled={isSearching}
                    className="rounded-xl h-auto py-2"
                  >
                    {isSearching ? <Loader className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Powered by Regrid parcel data for accurate acreage estimation.
                </p>
              </div>

              <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                {t("quote.acreage")}
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0.05}
                    max={2.0}
                    step={0.01}
                    value={acreage}
                    onChange={(event) => setAcreage(Number(event.target.value))}
                    className="flex-1 accent-primary"
                    aria-label={t("quote.acreageLabel")}
                  />
                  <input
                    type="number"
                    min={0.05}
                    max={5}
                    step={0.01}
                    value={Number.isNaN(acreage) ? "" : acreage}
                    onChange={(event) => setAcreage(Number(event.target.value))}
                    className="w-28 rounded-2xl border border-border/70 bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("quote.needHelp")}
                </p>
              </label>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold text-foreground">{t("quote.program")}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(Object.keys(programLabels) as ProgramType[]).map((value) => {
                    const isActive = program === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setProgram(value)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          isActive
                            ? "border-primary bg-primary text-primary-foreground shadow-brand"
                            : "border-border/70 bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {programLabels[value]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold text-foreground">{t("quote.frequency")}</legend>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  {frequencyOptions.map((option) => {
                    const isActive = frequency === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFrequency(option)}
                        className={`rounded-2xl border px-4 py-3 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          isActive
                            ? "border-primary bg-primary/90 text-primary-foreground shadow-brand"
                            : "border-border/70 bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                        aria-pressed={isActive}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-3 rounded-3xl bg-muted/50 p-6">
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>{t("quote.perVisit")}</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.perVisit)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>{t("quote.monthlyEq")}</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.perMonth)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>{t("quote.annualTotal")}</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.annualTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("quote.visitsPerYear")}{pricing.visitsPerYear ?? "—"}
                </p>
                {pricing.message ? (
                  <p className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-primary">
                    {pricing.message}
                  </p>
                ) : null}
              </div>

              {pricing.isCustom ? (
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {t("quote.customWalkthrough")}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : (
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {t("quote.saveQuote")}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              )}

              {submitted && !pricing.isCustom ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                  {t("quote.quoteSaved")}
                </div>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default QuoteWidgetSection;
