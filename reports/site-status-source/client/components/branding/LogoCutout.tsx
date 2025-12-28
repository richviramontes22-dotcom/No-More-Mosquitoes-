import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type LogoCutoutProps = {
  className?: string;
  size?: number;
  alt?: string;
};

const LOGO_SRC =
  "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F637d887b9fb2441e96a15f40c8df1eca?format=webp&width=800";

export const LogoCutout = forwardRef<HTMLDivElement, LogoCutoutProps>(
  ({ className, size = 48, alt = "No More Mosquitoes icon" }, ref) => {
    const dimension = typeof size === "number" ? `${size}px` : size;

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 shadow-soft",
          className,
        )}
        style={{ width: dimension, height: dimension }}
      >
        <img
          src={LOGO_SRC}
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
