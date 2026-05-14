/**
 * Non-blocking weather service for dashboard and header widget.
 * Falls back gracefully if API fails.
 */

export interface WeatherData {
  temperature: number;
  condition: string;
  windSpeed: number;
  humidity: number;
  serviceStatus: "good" | "caution" | "reschedule";
  lastUpdated: Date;
  // Extended fields for header widget
  uvi?: number;
  precipitation?: number;
  visibility?: number;
  pressure?: number;
  airQualityIndex?: number;
}

export interface WeatherError {
  message: string;
  fallbackReady: boolean;
}

/**
 * Get user's geolocation using browser Geolocation API
 * Falls back to Anaheim, CA if permission denied or unavailable
 */
const getUserLocation = (): Promise<{ lat: number; lon: number }> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log("[Weather] Geolocation not available, using default location");
      resolve({ lat: 33.8353, lon: -117.9129 }); // Anaheim, CA
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`[Weather] User location obtained: ${latitude}, ${longitude}`);
        resolve({ lat: latitude, lon: longitude });
      },
      (error) => {
        console.log(`[Weather] Geolocation permission denied or error: ${error.message}, using default location`);
        resolve({ lat: 33.8353, lon: -117.9129 }); // Anaheim, CA fallback
      }
    );
  });
};

/**
 * Get local weather data from Open-Meteo (free, no auth required)
 * Attempts to use browser geolocation, falls back to Anaheim, CA
 * Falls back gracefully if service fails
 */
export const fetchWeatherData = async (
  latitude?: number,
  longitude?: number
): Promise<WeatherData | null> => {
  try {
    // If no coordinates provided, attempt to get user's location
    let lat = latitude;
    let lon = longitude;

    if (lat === undefined || lon === undefined) {
      const location = await getUserLocation();
      lat = location.lat;
      lon = location.lon;
    }

    console.log(`[Weather] Fetching weather data for coordinates: ${lat}, ${lon}`);

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,surface_pressure,visibility,uv_index&temperature_unit=fahrenheit`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      console.warn(`[Weather] API error status ${response.status}, falling back to default`);
      return null;
    }

    const data = await response.json();
    const current = data.current;

    if (!current) {
      console.warn("[Weather] No current data in API response, falling back");
      return null;
    }

    // Determine service status based on weather
    let serviceStatus: "good" | "caution" | "reschedule" = "good";

    if (current.wind_speed_10m > 20) {
      serviceStatus = "reschedule"; // High wind
    } else if (current.weather_code !== 0 || current.wind_speed_10m > 15) {
      serviceStatus = "caution"; // Rain or moderate wind
    }

    const weatherData: WeatherData = {
      temperature: Math.round(current.temperature_2m),
      condition: getWeatherCondition(current.weather_code),
      windSpeed: Math.round(current.wind_speed_10m),
      humidity: current.relative_humidity_2m,
      serviceStatus,
      lastUpdated: new Date(),
      uvi: current.uv_index != null ? Math.round(current.uv_index * 10) / 10 : undefined,
      precipitation: current.precipitation != null ? Math.round(current.precipitation * 100) / 100 : undefined,
      visibility: current.visibility != null ? Math.round(current.visibility / 1000 * 10) / 10 : undefined,
      pressure: current.surface_pressure != null ? Math.round(current.surface_pressure) : undefined,
    };

    console.log(
      `[Weather] ✓ Fetched successfully - Temp: ${weatherData.temperature}°F, ` +
        `Condition: ${weatherData.condition}, Wind: ${weatherData.windSpeed} mph, ` +
        `Status: ${serviceStatus}`
    );

    return weatherData;
  } catch (err) {
    console.error("[Weather] Fetch failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
};

function getWeatherCondition(code: number): string {
  // WMO Weather interpretation codes
  if (code === 0) return "Clear";
  if (code === 1 || code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 67) return "Drizzle";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain";
  if (code === 85 || code === 86) return "Heavy Snow";
  if (code >= 90 && code <= 99) return "Thunderstorm";
  return "Unknown";
}
