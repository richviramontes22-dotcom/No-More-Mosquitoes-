import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type PageHeroCta = {
  label: string;
  href: string;
  external?: boolean;
  icon?: ReactNode;
};

export type PageHeroVariant = "simple" | "centered" | "split";

export type PageHeroProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  primaryCta?: PageHeroCta;
  secondaryCta?: PageHeroCta;
  variant?: PageHeroVariant;
  children?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

const CTA_ICON = <ArrowRight className="h-4 w-4" aria-hidden />;

const isExternal = (href: string) => href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");

const CtaButton = ({ cta, priority }: { cta: PageHeroCta; priority: "primary" | "secondary" }) => {
  const { label, href, external, icon } = cta;
  const isLinkExternal = external ?? isExternal(href);
  const content = (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      {icon ?? CTA_ICON}
    </span>
  );

  const className = cn(
    "rounded-full px-6 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    priority === "primary"
      ? "bg-primary text-primary-foreground shadow-brand transition hover:bg-primary/90"
      : "border border-border/60 bg-background/60 text-foreground transition hover:border-primary/50 hover:text-primary",
  );

  if (isLinkExternal) {
    return (
      <a className={className} href={href} rel="noreferrer" target={href.startsWith("http") ? "_blank" : undefined}>
        {content}
      </a>
    );
  }

  return (
    <Link className={className} to={href}>
      {content}
    </Link>
  );
};

const PageHero = ({
  id,
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  variant = "simple",
  children,
  aside,
  className,
}: PageHeroProps) => {
  return (
    <section
      id={id}
      className={cn(
        "relative isolate overflow-hidden bg-hero-radial py-20 text-foreground",
        variant === "split" ? "lg:py-24" : "",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 sm:px-6 lg:px-8 lg:flex-row lg:items-center">
        <div
          className={cn(
            "flex flex-1 flex-col gap-6",
            variant === "centered" && "items-center text-center",
          )}
        >
          {eyebrow ? (
            <span className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-foreground/90 backdrop-blur lg:self-auto">
              {eyebrow}
            </span>
          ) : null}
          <h1
            className={cn(
              "font-display text-3xl leading-tight sm:text-4xl lg:text-5xl",
              variant === "centered" && "max-w-3xl",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "max-w-2xl text-base text-muted-foreground sm:text-lg",
                variant === "centered" && "lg:max-w-3xl",
              )}
            >
              {description}
            </p>
          ) : null}
          {children}
          {(primaryCta || secondaryCta) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {primaryCta ? <CtaButton cta={primaryCta} priority="primary" /> : null}
              {secondaryCta ? <CtaButton cta={secondaryCta} priority="secondary" /> : null}
            </div>
          )}
        </div>
        {variant === "split" ? (
          <div className="flex-1">
            <div className="rounded-[32px] border border-white/15 bg-white/8 p-6 shadow-soft backdrop-blur">
              {aside}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default PageHero;
