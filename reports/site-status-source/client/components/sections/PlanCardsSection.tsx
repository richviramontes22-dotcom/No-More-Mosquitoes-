import { Link } from "react-router-dom";
import { CheckCircle2, Waves } from "lucide-react";

const plans = [
  {
    name: "One-Time Application",
    price: "$179",
    cadence: "Knockdown + barrier",
    features: [
      "Full-property mosquito treatment",
      "Completion video & technician notes",
      "Follow-up prevention checklist",
    ],
    ctaLabel: "Book one-time",
    ctaHref: "/schedule",
    accent: "bg-secondary/30 text-secondary-foreground",
  },
  {
    name: "Subscription",
    price: "Tiered by acreage",
    cadence: "14/21/30/42-day",
    features: [
      "Dedicated route technician",
      "Re-service promise between visits",
      "Portal access with ETA tracking",
    ],
    ctaLabel: "Start subscription",
    ctaHref: "/schedule",
    accent: "bg-primary text-primary-foreground",
  },
  {
    name: "Annual (Prepay)",
    price: "Best value",
    cadence: "Full-season coverage",
    features: [
      "Priority scheduling for peak weeks",
      "Seasonal tick, ant, and spider defense",
      "Complimentary event fogging add-on",
    ],
    ctaLabel: "Go annual",
    ctaHref: "/contact",
    accent: "bg-accent text-accent-foreground",
  },
];

const PlanCardsSection = () => {
  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-6 text-left lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
              Plans & programs
            </span>
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              Flexible programs built around your yard, cadence, and comfort.
            </h2>
            <p className="text-base text-muted-foreground">
              Pick the program that fits your lifestyle. Every option includes mosquito knockdown, barrier treatments, and pest prevention insights in your customer portal.
            </p>
          </div>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Compare full pricing
          </Link>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="relative overflow-hidden rounded-[32px] border border-border/80 bg-card/80 p-6 shadow-soft backdrop-blur"
            >
              <div className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${plan.accent}`}>
                {plan.cadence}
              </div>
              <h3 className="mt-6 font-display text-2xl font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{plan.price}</p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={plan.ctaHref}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {plan.ctaLabel}
                <Waves className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PlanCardsSection;
