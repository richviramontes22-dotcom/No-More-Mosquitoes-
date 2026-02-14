import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/lib/translations";

export function useTranslation() {
  const { language } = useLanguage();

  const t = (key: string): any => {
    const keys = key.split(".");
    let value: any = translations[language];
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  };

  return { t, language };
}
