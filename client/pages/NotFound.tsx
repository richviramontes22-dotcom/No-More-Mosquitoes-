import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "@/hooks/use-translation";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-background via-background/60 to-muted/60 py-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-4 text-center sm:px-6 lg:px-8">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
          {t("notFound.code")}
        </span>
        <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
          {t("notFound.title")}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {t("notFound.description")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/"
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("notFound.backHome")}
          </Link>
          <Link
            to="/contact"
            className="rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("notFound.contactSupport")}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default NotFound;
