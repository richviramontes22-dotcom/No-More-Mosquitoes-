import { useEffect, useState } from "react";

export type CarouselImage = {
  src: string;
  mobileSrc?: string;
  alt: string;
  objectPosition?: string;
  animationKey?: string;
};

export type ImageCarouselProps = {
  images: CarouselImage[];
  autoRotateInterval?: number; // in milliseconds
  className?: string;
  fullscreen?: boolean;
  objectFit?: "cover" | "contain" | "fill";
};

const ImageCarousel = ({
  images,
  autoRotateInterval = 5000,
  className = "",
  fullscreen = false,
  objectFit = "cover",
}: ImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  // Auto-rotate effect
  useEffect(() => {
    if (!isAutoRotating || images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, autoRotateInterval);

    return () => clearInterval(interval);
  }, [isAutoRotating, autoRotateInterval, images.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoRotating(false);
    // Resume auto-rotation after 10 seconds of inactivity
    const timeout = setTimeout(() => setIsAutoRotating(true), 10000);
    return () => clearTimeout(timeout);
  };

  if (images.length === 0) return null;

  return (
    <div
      className={`${fullscreen ? "absolute inset-0 overflow-hidden" : "relative flex-1 overflow-hidden rounded-[36px] border border-primary/20 shadow-[0_30px_80px_-40px_rgba(10,45,66,0.6)]"} transition-colors duration-700 ${className}`}
      onMouseEnter={() => setIsAutoRotating(false)}
      onMouseLeave={() => setIsAutoRotating(true)}
      style={fullscreen ? { display: "block" } : { minHeight: "500px" }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes panFamily {
          0% { transform: scale(1.15) translateX(-6.5%); }
          100% { transform: scale(1.15) translateX(-1.5%); }
        }
        @keyframes panFoggerWide {
          0% { transform: scale(1.15) translateX(1.5%); }
          100% { transform: scale(1.15) translateX(6.5%); }
        }
        @keyframes panFoggerClose {
          0% { transform: scale(1.15) translateX(-6.5%); }
          100% { transform: scale(1.15) translateX(-1.5%); }
        }
        @keyframes panPatio {
          0% { transform: scale(1.15) translateX(-3%); }
          100% { transform: scale(1.15) translateX(3%); }
        }
        @keyframes panPortraitVertical {
          0% { transform: scale(1.15) translateY(-3%); }
          100% { transform: scale(1.15) translateY(3%); }
        }
        @keyframes panRight {
          0% { transform: scale(1.15) translateX(-5%); }
          100% { transform: scale(1.15) translateX(5%); }
        }
        .animate-pan-family { animation: panFamily 12s linear infinite; }
        .animate-pan-fogger-wide { animation: panFoggerWide 12s linear infinite; }
        .animate-pan-fogger-close { animation: panFoggerClose 12s linear infinite; }
        .animate-pan-patio { animation: panPatio 12s linear infinite; }
        .animate-pan-portrait-vertical { animation: panPortraitVertical 12s linear infinite; }
        .animate-pan-slow { animation: panRight 12s linear infinite; }
      ` }} />
      {/* Image Stack */}
      {images.map((image, index) => {
        const getAnimationClass = (key?: string) => {
          if (!key) return "animate-pan-slow";
          switch (key) {
            case "family": return "animate-pan-family";
            case "fogger-wide": return "animate-pan-fogger-wide";
            case "fogger-close": return "animate-pan-fogger-close";
            case "patio": return "animate-pan-patio";
            case "portrait-vertical": return "animate-pan-portrait-vertical";
            default: return "animate-pan-slow";
          }
        };

        return (
          <picture key={index}>
            {image.mobileSrc && (
              <source
                media="(max-width: 640px)"
                srcSet={image.mobileSrc}
              />
            )}
            {/* Blurred background layer for 'contain' mode to fill gaps professionally */}
            {objectFit === "contain" && (
              <img
                src={image.mobileSrc || image.src}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 h-full w-full object-cover blur-3xl opacity-30 transition-opacity duration-1000 scale-110 ${
                  index === currentIndex ? "opacity-30" : "opacity-0"
                }`}
              />
            )}
            <img
              src={image.src}
              alt={image.alt}
              loading={fullscreen || index === currentIndex ? "eager" : "lazy"}
              className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${
                index === currentIndex ? `opacity-100 ${getAnimationClass(image.animationKey)}` : "opacity-0"
              }`}
              style={{
                objectPosition: image.objectPosition || "center",
                objectFit: objectFit,
                transform: "scale(1.15)", // Maintain scale during fade transitions to prevent "zoom out" jump
              }}
            />
          </picture>
        );
      })}

      {/* Overlay Gradient - only for card mode */}
      {!fullscreen && <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent" aria-hidden />}

      {/* Navigation Dots - only for card mode */}
      {!fullscreen && (
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-3 w-3 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? "w-8 bg-white"
                  : "bg-white/50 hover:bg-white/75"
              }`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === currentIndex ? "true" : "false"}
            />
          ))}
        </div>
      )}

      {/* Blur elements for visual depth - only for card mode */}
      {!fullscreen && (
        <>
          <div className="absolute -bottom-10 -left-6 -z-10 h-[360px] w-[360px] rounded-full bg-primary/15 blur-3xl" aria-hidden />
          <div className="absolute -top-16 right-0 -z-10 h-[320px] w-[320px] rounded-full bg-secondary/20 blur-3xl" aria-hidden />
        </>
      )}
    </div>
  );
};

export default ImageCarousel;
