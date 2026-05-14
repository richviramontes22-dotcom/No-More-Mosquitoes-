import { useEffect, useRef, useState } from "react";
import { Cloud, Wind, Droplets, Eye, Gauge, Sun, CloudRain, X } from "lucide-react";
import { fetchWeatherData, WeatherData } from "@/lib/weatherService";

/**
 * Compact weather indicator for the site header.
 * Desktop: clickable icon next to login/logout button.
 * Mobile: hidden to avoid header overflow.
 * Popover shows UVI, Wind, Precipitation, Humidity, Visibility, Pressure.
 */
export const HeaderWeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let mounted = true;
    fetchWeatherData().then((data) => {
      if (mounted) {
        setWeather(data);
        setIsLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Status color
  const statusColor =
    !weather ? "text-muted-foreground" :
    weather.serviceStatus === "good" ? "text-green-600" :
    weather.serviceStatus === "caution" ? "text-amber-500" :
    "text-red-500";

  const WeatherIcon = !weather ? Cloud :
    weather.condition === "Clear" ? Sun :
    weather.condition.includes("Rain") || weather.condition.includes("Drizzle") ? CloudRain :
    Cloud;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-full border border-border/60 p-2 text-muted-foreground opacity-50">
        <Cloud className="h-5 w-5 animate-pulse" aria-hidden />
        <span className="sr-only">Loading weather</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-border/60 px-3 py-2 text-sm font-medium transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${statusColor}`}
        aria-label={weather ? `Weather: ${weather.temperature}°F, ${weather.condition}` : "Weather unavailable"}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <WeatherIcon className="h-4 w-4" aria-hidden />
        {weather && (
          <span className="tabular-nums">{weather.temperature}°F</span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Weather forecast"
          className="absolute right-0 top-full mt-2 z-50 w-72 rounded-[20px] border border-border/70 bg-card/95 p-5 shadow-lg backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Weather Forecast
              </p>
              {weather && (
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {weather.temperature}°F · {weather.condition}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close weather panel"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {!weather ? (
            <p className="text-sm text-muted-foreground">Weather data unavailable.</p>
          ) : (
            <>
              {/* Service status */}
              <div className={`mb-4 rounded-xl px-3 py-2 text-xs font-semibold ${
                weather.serviceStatus === "good"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : weather.serviceStatus === "caution"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {weather.serviceStatus === "good" && "Service On Schedule — Optimal conditions"}
                {weather.serviceStatus === "caution" && "Weather Risk — Service may be adjusted"}
                {weather.serviceStatus === "reschedule" && "Reschedule Likely — Conditions not suitable"}
              </div>

              {/* Metrics grid */}
              <dl className="grid grid-cols-2 gap-3">
                {weather.uvi != null && (
                  <div className="flex items-start gap-2">
                    <Sun className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden />
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">UVI</dt>
                      <dd className="text-sm font-semibold text-foreground">{weather.uvi}</dd>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Wind className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" aria-hidden />
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Wind</dt>
                    <dd className="text-sm font-semibold text-foreground">{weather.windSpeed} mph</dd>
                  </div>
                </div>
                {weather.precipitation != null && (
                  <div className="flex items-start gap-2">
                    <CloudRain className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" aria-hidden />
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Precipitation</dt>
                      <dd className="text-sm font-semibold text-foreground">{weather.precipitation} mm</dd>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Droplets className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-500" aria-hidden />
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Humidity</dt>
                    <dd className="text-sm font-semibold text-foreground">{weather.humidity}%</dd>
                  </div>
                </div>
                {weather.visibility != null && (
                  <div className="flex items-start gap-2">
                    <Eye className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" aria-hidden />
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Visibility</dt>
                      <dd className="text-sm font-semibold text-foreground">{weather.visibility} km</dd>
                    </div>
                  </div>
                )}
                {weather.pressure != null && (
                  <div className="flex items-start gap-2">
                    <Gauge className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-500" aria-hidden />
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pressure</dt>
                      <dd className="text-sm font-semibold text-foreground">{weather.pressure} hPa</dd>
                    </div>
                  </div>
                )}
              </dl>

              <p className="mt-4 text-[10px] text-muted-foreground/70">
                Updated {weather.lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HeaderWeatherWidget;
