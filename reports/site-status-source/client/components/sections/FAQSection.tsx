import SectionHeading from "@/components/common/SectionHeading";
import { faqs } from "@/data/site";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQSection = () => {
  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="FAQ"
          title="Answers to the questions families ask before their first service."
          description="From safety to scheduling, here’s everything you need to know before we treat your property."
          centered
        />
        <Accordion type="single" collapsible className="mt-12 divide-y divide-border/80 rounded-[28px] border border-border/70 bg-card/90 px-6">
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.question} value={`faq-${index}`} className="border-none">
              <AccordionTrigger className="text-left text-base font-semibold text-foreground">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
