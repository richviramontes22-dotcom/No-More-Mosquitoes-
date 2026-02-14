import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/lib/translations";

export function useTranslation() {
  const { language } = useLanguage();

  const t = (key: string, replacements?: Record<string, string | number>): any => {
    const keys = key.split(".");
    let value: any = translations[language];
    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value === "string" && replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        value = value.split(`{${k}}`).join(String(v));
      });
    }

    return value;
  };

  return { t, language };
}
