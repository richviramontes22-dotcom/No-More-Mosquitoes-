import { useState } from "react";
import { MessageSquare, Phone, Mail, X, Send } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CONTACT_PHONE_DISPLAY = "(949) 297-6225";
const CONTACT_PHONE_LINK = "tel:+19492976225";
const CONTACT_EMAIL = "richard@nomoremosquitoes.us";

declare global {
  interface Window {
    $crisp: any[];
  }
}

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const startLiveChat = () => {
    if (window.$crisp) {
      window.$crisp.push(["do", "chat:open"]);
      setIsOpen(false);
    } else {
      window.location.href = "/contact";
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {/* Chat Panel */}
      <div
        className={cn(
          "mb-4 w-72 transform overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-all duration-300 ease-in-out",
          isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-10 pointer-events-none"
        )}
      >
        <div className="bg-primary p-4 text-primary-foreground">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">{t("chat.title") || "Customer Support"}</h3>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs opacity-90">{t("chat.welcome") || "How can we help you today?"}</p>
        </div>

        <div className="p-4 space-y-3">
          <button
            onClick={startLiveChat}
            className="flex w-full items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition group text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("chat.liveChat") || "Live Chat"}</p>
              <p className="text-sm font-bold text-foreground">{t("chat.talkToAgent") || "Talk to an Agent"}</p>
            </div>
          </button>

          <a
            href={CONTACT_PHONE_LINK}
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("chat.callOrText") || "Call or Text"}</p>
              <p className="text-sm font-bold text-foreground">{CONTACT_PHONE_DISPLAY}</p>
            </div>
          </a>

          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("chat.emailUs") || "Email Us"}</p>
              <p className="text-sm font-bold text-foreground truncate w-40">{CONTACT_EMAIL}</p>
            </div>
          </a>

          <Button
            className="w-full rounded-xl gap-2"
            onClick={() => {
              window.location.href = "/contact";
              setIsOpen(false);
            }}
          >
            <Send className="h-4 w-4" />
            {t("chat.goToContact") || "Go to Contact Page"}
          </Button>
        </div>
        
        <div className="bg-muted/50 p-3 text-center">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
            {t("header.securityNotice")}
          </p>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95",
          isOpen ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
        )}
        aria-label={t("chat.toggleChat") || "Toggle chat widget"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </div>
  );
};

export default ChatWidget;
