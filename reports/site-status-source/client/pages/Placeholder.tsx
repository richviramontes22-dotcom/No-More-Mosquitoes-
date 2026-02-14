import { Link } from "react-router-dom";

type PlaceholderPageProps = {
  title: string;
  description?: string;
  callToActionPath?: string;
  callToActionLabel?: string;
};

const PlaceholderPage = ({
  title,
  description = "We’re crafting this page to include pricing calculators, video walkthroughs, and proactive pest education tailored for Orange County homeowners.",
  callToActionLabel = "Schedule Service",
  callToActionPath = "/schedule",
}: PlaceholderPageProps) => {
  const isExternalCta =
    callToActionPath.startsWith("http") ||
    callToActionPath.startsWith("tel:") ||
    callToActionPath.startsWith("mailto:");

  return (
    <div className="bg-gradient-to-b from-background via-background/60 to-muted/50 py-20">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-4 text-center sm:px-6 lg:px-8">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
          Coming Soon
        </span>
        <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {description}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {isExternalCta ? (
            <a
              href={callToActionPath}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {callToActionLabel}
            </a>
          ) : (
            <Link
              to={callToActionPath}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {callToActionLabel}
            </Link>
          )}
          <Link
            to="/contact"
            className="rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Talk with a Specialist
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderPage;
