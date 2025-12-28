import { Link } from "react-router-dom";
import { heroHighlights } from "@/data/site";
import { heroImage } from "@/data/media";
import { ArrowRight, CheckCircle2, Phone } from "lucide-react";

const CONTACT_PHONE_DISPLAY = "(949) 763-0492";
const CONTACT_PHONE_LINK = "tel:+19497630492";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-hero-radial">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/8 via-background to-secondary/10" aria-hidden />
      <div className="absolute inset-y-0 right-0 -z-10 hidden lg:block">
        <div className="h-full w-[520px] bg-mesh-overlay opacity-80" />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20 pt-24 sm:px-6 lg:flex-row lg:items-center lg:gap-20 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="flex-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
            Premium Mosquito & Pest Control
          </span>
          <h1 className="mt-6 font-display text-4xl font-semibold text-foreground sm:text-5xl lg:text-6xl">
            Bugs Don’t Belong in Your Home.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Safe, fast, reliable mosquito and pest control in Orange County—backed by our 100% satisfaction guarantee. We combine precise formulations with HD completion videos so you see exactly what we treat on every visit.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/schedule"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Schedule Service
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
            </Link>
            <a
              href="#address-checker"
              className="inline-flex items-center gap-2 rounded-full border border-border/80 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Check Pricing by Address
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={CONTACT_PHONE_LINK}
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-secondary/80 px-6 py-3 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Phone className="h-4 w-4" aria-hidden />
              Call or Text {CONTACT_PHONE_DISPLAY}
            </a>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {heroHighlights.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-soft backdrop-blur"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {item.value}
                </p>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex-1">
          <div className="relative z-10 overflow-hidden rounded-[36px] border border-primary/20 bg-white/90 shadow-[0_30px_80px_-40px_rgba(10,45,66,0.6)] backdrop-blur">
            <img
              src={heroImage.src}
              alt={heroImage.alt}
              loading="lazy"
              className="h-full w-full object-cover opacity-95"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/20 to-transparent" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 space-y-4 p-6 text-primary-foreground">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-primary-foreground">
                  <CheckCircle2 className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em]">Every visit includes</p>
                  <p className="text-lg font-semibold">HD completion video + technician notes</p>
                </div>
              </div>
              <ul className="grid gap-3 text-sm">
                <li className="rounded-2xl bg-white/15 p-4">
                  <p className="font-semibold">Smart weather adjustments</p>
                  <p>We reroute automatically around wind and rain so treatments stay effective.</p>
                </li>
                <li className="rounded-2xl bg-white/15 p-4">
                  <p className="font-semibold">Customer portal access</p>
                  <p>Track ETA, pay invoices, review technician notes, and reschedule in one place.</p>
                </li>
                <li className="rounded-2xl bg-white/15 p-4">
                  <p className="font-semibold">Re-service promise</p>
                  <p>If mosquitoes return between visits, we treat again at no charge.</p>
                </li>
              </ul>
              <p className="text-xs text-white/80">
                Licensed • Insured • Employee-based technicians • Serving Orange County since 2016
              </p>
            </div>
          </div>
          <div className="absolute -bottom-10 -left-6 -z-10 h-[360px] w-[360px] rounded-full bg-primary/15 blur-3xl" aria-hidden />
          <div className="absolute -top-16 right-0 -z-10 h-[320px] w-[320px] rounded-full bg-secondary/20 blur-3xl" aria-hidden />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
