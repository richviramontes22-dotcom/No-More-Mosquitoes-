import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { img_logo_nomoremoss_black } from "@/data/media";

type LogoCutoutProps = {
  className?: string;
  size?: number | string;
  alt?: string;
};

export const LogoCutout = forwardRef<HTMLDivElement, LogoCutoutProps>(
  ({ className, size, alt = "No More Mosquitoes icon" }, ref) => {
    const dimension = typeof size === "number" ? `${size}px` : size;

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 shadow-soft shrink-0",
          !size && "h-12 w-12", // Default size if none provided
          className,
        )}
        style={size ? { width: dimension, height: dimension } : undefined}
      >
        <img
          src={img_logo_nomoremoss_black.src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover object-top"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-0 rounded-full border border-white/20" aria-hidden />
      </div>
    );
  },
);

LogoCutout.displayName = "LogoCutout";

export default LogoCutout;
