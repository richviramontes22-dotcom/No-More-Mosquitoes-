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
        className={cn("relative shrink-0", !size && "h-12 w-12", className)}
        style={size ? { width: dimension, height: dimension } : undefined}
      >
        <img
          src={img_logo_nomoremoss_black.src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
    );
  },
);

LogoCutout.displayName = "LogoCutout";

export default LogoCutout;
