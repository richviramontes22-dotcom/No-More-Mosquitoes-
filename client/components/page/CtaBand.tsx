import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export type CtaBandProps = {
  title: string;
  href: string;
  description?: string;
  ctaLabel?: string;
  external?: boolean;
  className?: string;
};

const isExternal = (href: string) => href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");

const CtaBand = ({ title, href, description, ctaLabel, external, className }: CtaBandProps) => {
  const resolvedExternal = external ?? isExternal(href);
  const content = ctaLabel ?? title;
  const baseClassName =
    "inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <section className={cn("relative isolate overflow-hidden py-16", className)}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-4 rounded-[32px] border border-primary/30 bg-background/85 px-6 py-12 text-center shadow-soft backdrop-blur">
        {description ? <p className="text-sm uppercase tracking-[0.4em] text-primary/80">{description}</p> : null}
        <h2 className="font-display text-2xl text-foreground sm:text-3xl">{title}</h2>
        {resolvedExternal ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className={baseClassName}
          >
            {content}
          </a>
        ) : (
          <Link to={href} className={baseClassName}>
            {content}
          </Link>
        )}
      </div>
    </section>
  );
};

export default CtaBand;
