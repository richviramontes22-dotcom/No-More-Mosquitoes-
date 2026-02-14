import { useMemo, useState } from "react";

import SectionHeading from "@/components/common/SectionHeading";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqs } from "@/data/site";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

export type FAQSectionProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  centered?: boolean;
  searchable?: boolean;
  ids?: string[];
  className?: string;
};

const filterFaqs = (ids?: string[]) => {
  if (!ids || ids.length === 0) return faqs;
  const set = new Set(ids);
  return faqs.filter((faq) => set.has(faq.id));
};

const FAQSection = ({
  eyebrow,
  title,
  description,
  centered = true,
  searchable = false,
  ids,
  className,
}: FAQSectionProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const defaultEyebrow = eyebrow || "FAQ";
  const defaultTitle = title || t("faq.defaultTitle");
  const defaultDescription = description || t("faq.defaultDesc");

  const filteredFaqs = useMemo(() => {
    const base = filterFaqs(ids);
    if (!query.trim()) return base;
    return base.filter((faq) => {
      const normalizedQuery = query.toLowerCase();
      return faq.question.toLowerCase().includes(normalizedQuery) || faq.answer.toLowerCase().includes(normalizedQuery);
    });
  }, [ids, query]);

  return (
    <section className={cn("bg-background py-24", className)}>
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={defaultEyebrow} title={defaultTitle} description={defaultDescription} centered={centered} />
        {searchable ? (
          <div className="mt-8">
            <label htmlFor="faq-search" className="sr-only">
              {t("faq.defaultTitle")}
            </label>
            <Input
              id="faq-search"
              type="search"
              autoComplete="off"
              placeholder={t("faq.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 rounded-full border border-border/70 bg-card/80 px-4 text-base shadow-soft focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        ) : null}
        <Accordion
          type="multiple"
          className="mt-12 divide-y divide-border/80 rounded-[28px] border border-border/70 bg-card/90 px-6"
        >
          {filteredFaqs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("faq.noAnswers")}</div>
          ) : (
            filteredFaqs.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id} className="border-none">
                <AccordionTrigger className="text-left text-base font-semibold text-foreground">
                  {t(`faq.${faq.id}.question`) || faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {t(`faq.${faq.id}.answer`) || faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))
          )}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
