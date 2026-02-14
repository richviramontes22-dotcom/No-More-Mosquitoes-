import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { FormStatus, isValidEmail, postJson } from "@/lib/forms";
import { cn } from "@/lib/utils";

export type WaitlistFormProps = {
  endpoint: string;
  className?: string;
};

const WaitlistForm = ({ endpoint, className }: WaitlistFormProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [status, setStatus] = useState<FormStatus>("idle");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidEmail(email)) {
      toast({ title: t("waitlist.emailError"), description: t("waitlist.emailErrorDesc") });
      return;
    }

    if (!/^\d{5}$/.test(zip)) {
      toast({ title: t("waitlist.zipError"), description: t("waitlist.zipErrorDesc") });
      return;
    }

    try {
      setStatus("submitting");
      await postJson(endpoint, { email, zip });
      setStatus("success");
      setEmail("");
      setZip("");
      toast({ title: t("waitlist.successTitle"), description: t("waitlist.successDesc") });
    } catch (error) {
      setStatus("error");
      toast({
        title: t("waitlist.errorTitle"),
        description: error instanceof Error ? error.message : t("waitlist.errorDesc"),
      });
    } finally {
      setStatus("idle");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("rounded-[28px] border border-border/70 bg-card/90 p-8 shadow-soft", className)}>
      <fieldset disabled={status === "submitting"} className="space-y-6">
        <legend className="sr-only">{t("waitlist.legend")}</legend>
        <div className="grid gap-2">
          <Label htmlFor="waitlist-email">{t("waitlist.email")}</Label>
          <Input
            id="waitlist-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("waitlist.emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="waitlist-zip">{t("waitlist.zip")}</Label>
          <Input
            id="waitlist-zip"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder={t("waitlist.zipPlaceholder")}
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            required
            maxLength={5}
          />
        </div>
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          {status === "submitting" ? t("waitlist.joining") : t("waitlist.joinBtn")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("waitlist.notice")}
        </p>
      </fieldset>
    </form>
  );
};

export default WaitlistForm;
