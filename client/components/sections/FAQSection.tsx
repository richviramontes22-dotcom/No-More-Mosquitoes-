import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import SectionHeading from "@/components/common/SectionHeading";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqs as staticFaqs } from "@/data/site";
import { supabase } from "@/lib/supabase";
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

  // Fetch FAQs from DB — fall back to static data if DB is empty or unreachable
  const { data: dbFaqs = [] } = useQuery({
    queryKey: ["faqs_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faqs")
        .select("id, question, answer, category, display_order")
        .eq("active", true)
        .order("display_order", { ascending: true });
      if (error || !data?.length) return [];
      return data as Array<{ id: string; question: string; answer: string; category?: string; display_order?: number }>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const allFaqs = dbFaqs.length > 0 ? dbFaqs : staticFaqs;

  const defaultEyebrow = eyebrow || "FAQ";
  const defaultTitle = title || t("faq.defaultTitle");
  const defaultDescription = description || t("faq.defaultDesc");

  const isSearching = searchable && query.trim().length > 0;

  const filteredFaqs = useMemo(() => {
    const base = ids?.length
      ? allFaqs.filter((faq) => ids.includes(faq.id))
      : allFaqs;
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter((faq) =>
      faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q)
    );
  }, [allFaqs, ids, query]);

  // Group by category when not in search mode
  const grouped = useMemo(() => {
    if (isSearching) return null;
    const base = ids?.length ? allFaqs.filter((faq) => ids.includes(faq.id)) : allFaqs;
    const map = new Map<string, typeof base>();
    for (const faq of base) {
      const cat = (faq as any).category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(faq);
    }
    return map;
  }, [allFaqs, ids, isSearching]);

  const renderAccordion = (items: typeof filteredFaqs) => (
    <Accordion type="multiple" className="divide-y divide-border/80 rounded-[28px] border border-border/70 bg-card/90 px-6">
      {items.map((faq) => (
        <AccordionItem key={faq.id} value={faq.id} className="border-none">
          <AccordionTrigger className="text-left text-base font-semibold text-foreground">
            {t(`faq.${faq.id}.question`) || faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            {t(`faq.${faq.id}.answer`) || faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

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

        {/* Grouped by category (default view) */}
        {!isSearching && grouped ? (
          <div className="mt-12 space-y-10">
            {Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-primary">
                  {category}
                </h2>
                {renderAccordion(items)}
              </div>
            ))}
          </div>
        ) : (
          /* Flat list during search */
          <div className="mt-12">
            {filteredFaqs.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{t("faq.noAnswers")}</div>
            ) : (
              renderAccordion(filteredFaqs)
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default FAQSection;
