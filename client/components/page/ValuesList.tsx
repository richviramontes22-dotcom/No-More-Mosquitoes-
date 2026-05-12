import SectionHeading from "@/components/common/SectionHeading";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

export type ValueItem = {
  title: string;
  description: string;
};

export type ValuesListProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  items: ValueItem[];
  className?: string;
};

const ValuesList = ({ eyebrow, title, description, items, className }: ValuesListProps) => {
  const { t } = useTranslation();
  const finalEyebrow = eyebrow || t("valuesList.defaultEyebrow");
  return (
    <section className={cn("bg-muted/40 py-24", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={finalEyebrow} title={title} description={description} centered />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.title}
              className="flex h-full flex-col gap-4 rounded-[28px] border border-border/60 bg-card/90 p-6 text-left shadow-soft"
            >
              <h3 className="font-display text-xl text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ValuesList;
