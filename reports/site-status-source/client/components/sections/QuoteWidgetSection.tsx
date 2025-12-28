import { FormEvent, useMemo, useState } from "react";
import { calculatePricing, formatCurrency, ProgramType } from "@/lib/pricing";
import { frequencyOptions } from "@/data/site";
import { Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const programLabels: Record<ProgramType, string> = {
  subscription: "Subscription",
  annual: "Annual (prepay)",
  one_time: "One-time application",
};

const QuoteWidgetSection = () => {
  const [acreage, setAcreage] = useState(0.2);
  const [program, setProgram] = useState<ProgramType>("subscription");
  const [frequency, setFrequency] = useState<(typeof frequencyOptions)[number]>(21);
  const [submitted, setSubmitted] = useState(false);

  const pricing = useMemo(
    () => calculatePricing({ acreage, program, frequencyDays: frequency }),
    [acreage, program, frequency],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 py-24">
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-40" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
              Instant quote
            </span>
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              Calculate pricing with acreage, cadence, and visit program.
            </h2>
            <p className="text-base text-muted-foreground">
              Adjust acreage and frequency to see the total investment. Pricing updates instantly. Ready to schedule? Use the quote summary to lock in your first visit and secure customer portal access.
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                14/21/30/42-day cadences tuned for Orange County climate.
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                Frequency automatically updates monthly and annual totals.
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                Acreage over 2.0 routes to a custom proposal with on-site measurements.
              </li>
            </ul>
          </div>
          <form
            onSubmit={handleSubmit}
            className="rounded-[32px] border border-primary/10 bg-card/90 p-6 shadow-soft backdrop-blur lg:p-8"
          >
            <div className="grid gap-6">
              <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                Acreage
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0.05}
                    max={2.0}
                    step={0.01}
                    value={acreage}
                    onChange={(event) => setAcreage(Number(event.target.value))}
                    className="flex-1 accent-primary"
                    aria-label="Property acreage slider"
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
                  Need help measuring? Address checker above can estimate using parcel data, or we confirm during the initial site walk.
                </p>
              </label>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold text-foreground">Program</legend>
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
                <legend className="text-sm font-semibold text-foreground">Frequency (days)</legend>
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
                  <span>Per visit</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.perVisit)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>Monthly equivalent</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.perMonth)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>Annual total</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.annualTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Visits per year: {pricing.visitsPerYear ?? "—"}
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
                  Book custom walkthrough
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : (
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Save quote & continue
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              )}

              {submitted && !pricing.isCustom ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                  Quote saved! We’ll pre-fill your scheduling flow with these selections and email a PDF summary shortly.
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
