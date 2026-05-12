import React from "react";
import LogoCutout from "./LogoCutout";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { LogoStyle } from "@/contexts/LogoContext";

interface LogoBrandingProps {
  style: LogoStyle;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  taglineClassName?: string;
}

const LogoBranding: React.FC<LogoBrandingProps> = ({
  style,
  className,
  iconClassName,
  textClassName,
  taglineClassName,
}) => {
  const { t } = useTranslation();

  if (style === "circular") {
    return (
      <LogoCutout
        className={cn("h-14 w-14 sm:h-16 sm:w-16 md:h-[72px] md:w-[72px]", iconClassName)}
        alt="No More Mosquitoes logo icon"
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Icon: flex-shrink-0 so it never compresses when space is tight */}
      <LogoCutout
        className={cn("h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 flex-shrink-0", iconClassName)}
        alt="No More Mosquitoes icon"
      />
      {/* Text block: min-w-0 allows it to shrink and wrap on narrow viewports */}
      <div className="leading-tight min-w-0">
        <p className={cn("font-display font-semibold text-foreground text-lg sm:text-xl", textClassName)}>
          No More Mosquitoes
        </p>
        {style === "banner" && (
          <p className={cn("font-semibold uppercase tracking-[0.2em] text-muted-foreground text-[10px] sm:text-xs", taglineClassName)}>
            {t("footer.tagline")}
          </p>
        )}
      </div>
    </div>
  );
};

export default LogoBranding;
