import { useEffect, useState } from "react";

export type CarouselImage = {
  src: string;
  alt: string;
};

export type ImageCarouselProps = {
  images: CarouselImage[];
  autoRotateInterval?: number; // in milliseconds
  className?: string;
};

const ImageCarousel = ({
  images,
  autoRotateInterval = 5000,
  className = "",
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

  const currentImage = images[currentIndex];

  return (
    <div
      className={`relative flex-1 overflow-hidden rounded-[36px] border border-primary/20 shadow-[0_30px_80px_-40px_rgba(10,45,66,0.6)] transition-colors duration-700 ${className}`}
      onMouseEnter={() => setIsAutoRotating(false)}
      onMouseLeave={() => setIsAutoRotating(true)}
      style={{ minHeight: "500px" }}
    >
      {/* Image Stack */}
      {images.map((image, index) => (
        <img
          key={index}
          src={image.src}
          alt={image.alt}
          loading={index === currentIndex ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent" aria-hidden />

      {/* Navigation Dots */}
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

      {/* Blur elements for visual depth */}
      <div className="absolute -bottom-10 -left-6 -z-10 h-[360px] w-[360px] rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="absolute -top-16 right-0 -z-10 h-[320px] w-[320px] rounded-full bg-secondary/20 blur-3xl" aria-hidden />
    </div>
  );
};

export default ImageCarousel;
