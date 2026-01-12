import SectionHeading from "@/components/common/SectionHeading";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import type { TeamMember } from "@/data/team";

export type TeamGridProps = {
  members: TeamMember[];
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
};

const TeamGrid = ({ members, eyebrow, title, description, className }: TeamGridProps) => {
  const { t } = useTranslation();
  const finalEyebrow = eyebrow || t("teamGrid.defaultEyebrow");
  const finalTitle = title || t("teamGrid.defaultTitle");
  return (
    <section className={cn("bg-background py-24", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={finalEyebrow} title={finalTitle} description={description} centered />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <article
              key={member.name}
              className="flex h-full flex-col rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-soft"
            >
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-xl text-foreground">{member.name}</h3>
                <span className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/80">{member.role}</span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{member.bio}</p>
              <span className="sr-only">{member.imageAlt}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeamGrid;
