type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  centered?: boolean;
  highlight?: string;
};

const SectionHeading = ({ eyebrow, title, description, centered, highlight }: SectionHeadingProps) => {
  return (
    <div className={`flex flex-col gap-4 ${centered ? "text-center" : "text-left"}`}>
      {eyebrow ? (
        <span className="self-start rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className={`font-display text-3xl font-semibold text-foreground sm:text-4xl lg:text-5xl ${centered ? "mx-auto max-w-3xl" : "max-w-2xl"}`}>
        {highlight ? (
          <>
            {title.split(highlight)[0]}
            <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              {highlight}
            </span>
            {title.split(highlight)[1] ?? ""}
          </>
        ) : (
          title
        )}
      </h2>
      {description ? (
        <p className={`${centered ? "mx-auto max-w-3xl" : "max-w-2xl"} text-lg text-muted-foreground`}>{description}</p>
      ) : null}
    </div>
  );
};

export default SectionHeading;
