import SectionHeading from "@/components/common/SectionHeading";
import { Link } from "react-router-dom";
import { Mail, PhoneCall } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

const CONTACT_EMAIL = "richard@nomoremosquitoes.us";
const CONTACT_PHONE_DISPLAY = "(949) 763-0492";
const CONTACT_PHONE_LINK = "tel:+19497630492";

const ContactSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-border/70 bg-card/90 p-10 text-center shadow-soft">
          <SectionHeading
            eyebrow={t("contact.getStarted")}
            title={t("contact.readyQuestion")}
            description={t("contact.callText")}
            centered
          />
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={CONTACT_PHONE_LINK}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <PhoneCall className="h-4 w-4" aria-hidden />
              {t("contact.callOrText")}{CONTACT_PHONE_DISPLAY}
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Mail className="h-4 w-4" aria-hidden />
              {CONTACT_EMAIL}
            </a>
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("contact.bookOnline")}
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            {t("contact.afterBooking")}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
