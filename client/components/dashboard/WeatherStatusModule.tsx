import { useEffect, useState } from "react";
import { Cloud, AlertTriangle, CheckCircle2, CloudRain } from "lucide-react";
import { fetchWeatherData, WeatherData } from "@/lib/weatherService";

export const WeatherStatusModule = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadWeather = async () => {
      try {
        const data = await fetchWeatherData();
        if (isMounted) {
          setWeather(data);
        }
      } catch (err) {
        console.error("[Weather Module] Error:", err);
        if (isMounted) {
          setWeather(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Start loading immediately but don't block rendering
    loadWeather();

    return () => {
      isMounted = false;
    };
  }, []);

  // If still loading, show minimal placeholder
  if (isLoading) {
    return (
      <div className="rounded-[24px] border border-border/40 bg-card/50 p-6 backdrop-blur-sm mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="h-5 w-5 text-muted-foreground animate-pulse" />
            <span className="text-sm text-muted-foreground">Loading weather...</span>
          </div>
        </div>
      </div>
    );
  }

  // If no weather data, show fallback message
  if (!weather) {
    return (
      <div className="rounded-[24px] border border-border/40 bg-card/50 p-6 backdrop-blur-sm mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Weather data unavailable</p>
              <p className="text-xs text-muted-foreground">Service status will be confirmed upon scheduling.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine status icon and colors
  const statusConfig = {
    good: {
      icon: <CheckCircle2 className="h-6 w-6 text-green-600" />,
      title: "✅ Service On Schedule",
      description: "Optimal conditions for treatment",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    caution: {
      icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
      title: "⚠️ Weather Risk — May Delay",
      description: "Service may be rescheduled due to weather conditions",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
    },
    reschedule: {
      icon: <CloudRain className="h-6 w-6 text-red-600" />,
      title: "⛔ Reschedule Likely",
      description: "Current conditions not suitable for service",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
  };

  const config = statusConfig[weather.serviceStatus];

  return (
    <div
      className={`rounded-[24px] border ${config.borderColor} ${config.bgColor} p-6 mb-6 backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {config.icon}
          <div>
            <p className="text-sm font-semibold text-foreground">{config.title}</p>
            <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
              <span>{weather.temperature}°F • {weather.condition}</span>
              <span>Wind: {weather.windSpeed} mph</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{config.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherStatusModule;
