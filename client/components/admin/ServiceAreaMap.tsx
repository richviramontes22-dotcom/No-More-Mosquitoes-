import { useEffect, useRef, useState } from "react";
import { useGoogleMapsScript } from "@/lib/googleMapsLoader";
import { Loader2, Map as MapIcon } from "lucide-react";

interface ServiceArea {
  id: string;
  zip: string;
  county: string | null;
  is_active: boolean;
}

interface CountyStat {
  total: number;
  active: number;
  pct: number;
}

interface Props {
  areasByCounty: Record<string, ServiceArea[]>;
  onCountyClick: (county: string) => void;
}

const FIPS_TO_COUNTY: Record<string, string> = {
  "037": "Los Angeles",
  "059": "Orange",
  "065": "Riverside",
  "071": "San Bernardino",
  "073": "San Diego",
};

function coverageColor(pct: number): string {
  if (pct >= 1.0) return "#16a34a";
  if (pct >= 0.75) return "#22c55e";
  if (pct >= 0.5) return "#86efac";
  if (pct >= 0.25) return "#fbbf24";
  if (pct > 0) return "#d1d5db";
  return "#9ca3af";
}

const POLYGON_STYLE = { strokeColor: "#ffffff", strokeWeight: 2, strokeOpacity: 0.9 };

let cachedGeoJson: unknown = null;

async function fetchCountyBoundaries(): Promise<unknown> {
  if (cachedGeoJson) return cachedGeoJson;
  const fips = Object.keys(FIPS_TO_COUNTY).map(f => `'${f}'`).join(",");
  const where = encodeURIComponent(`STATE='06' AND COUNTY IN (${fips})`);
  const url =
    `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query` +
    `?where=${where}&outFields=NAME,COUNTY&outSR=4326&f=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Census API ${res.status}`);
  cachedGeoJson = await res.json();
  return cachedGeoJson;
}

export default function ServiceAreaMap({ areasByCounty, onCountyClick }: Props) {
  const mapsStatus = useGoogleMapsScript();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindow | null>(null);
  const geoLoadedRef = useRef(false);
  const [geoError, setGeoError] = useState(false);

  // Compute county stats; keep a ref so event handlers always see latest values
  const countyStats: Record<string, CountyStat> = {};
  for (const [county, areas] of Object.entries(areasByCounty)) {
    const total = areas.length;
    const active = areas.filter(a => a.is_active).length;
    countyStats[county] = { total, active, pct: total > 0 ? active / total : 0 };
  }
  const countyStatsRef = useRef(countyStats);
  countyStatsRef.current = countyStats;
  const onCountyClickRef = useRef(onCountyClick);
  onCountyClickRef.current = onCountyClick;

  // Effect 1: Initialize map once Google Maps is ready
  useEffect(() => {
    if (mapsStatus !== "ready" || !mapRef.current || mapInstanceRef.current) return;
    if (!window.google?.maps?.Map) return;

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 34.1, lng: -117.3 },
      zoom: 7,
      disableDefaultUI: true,
      gestureHandling: "cooperative",
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
  }, [mapsStatus]);

  // Effect 2: Load GeoJSON and wire event listeners — runs once after map is ready
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || geoLoadedRef.current) return;
    geoLoadedRef.current = true;

    fetchCountyBoundaries()
      .then((geoJson) => {
        map.data.addGeoJson(geoJson);

        // Style function reads from ref — always current
        map.data.setStyle((feature) => {
          const fips = feature.getProperty("COUNTY") as string;
          const county = FIPS_TO_COUNTY[fips] ?? "";
          const stat = countyStatsRef.current[county] ?? { pct: 0 };
          return { ...POLYGON_STYLE, fillColor: coverageColor(stat.pct), fillOpacity: 0.55 };
        });

        map.data.addListener("mouseover", (e: GoogleDataMouseEvent) => {
          map.data.overrideStyle(e.feature, { fillOpacity: 0.82, strokeWeight: 3 });
          const fips = e.feature.getProperty("COUNTY") as string;
          const county = FIPS_TO_COUNTY[fips] ?? "Unknown";
          const stat = countyStatsRef.current[county] ?? { active: 0, total: 0, pct: 0 };
          const pctStr = stat.total > 0 ? `${Math.round(stat.pct * 100)}%` : "—";
          infoWindowRef.current?.setContent(
            `<div style="font-family:sans-serif;padding:4px 2px;min-width:140px">
              <div style="font-weight:600;margin-bottom:2px">${county} County</div>
              <div style="color:#555;font-size:13px">${stat.active}/${stat.total} ZIPs active (${pctStr})</div>
            </div>`
          );
          infoWindowRef.current?.setPosition(e.latLng);
          infoWindowRef.current?.open(map);
        });

        map.data.addListener("mouseout", () => {
          map.data.revertStyle();
          infoWindowRef.current?.close();
        });

        map.data.addListener("click", (e: GoogleDataMouseEvent) => {
          const fips = e.feature.getProperty("COUNTY") as string;
          const county = FIPS_TO_COUNTY[fips];
          if (county) onCountyClickRef.current(county);
        });
      })
      .catch(() => setGeoError(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstanceRef.current]);

  // Effect 3: Re-style features when coverage stats change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoLoadedRef.current) return;
    (map.data as any).forEach((feature: GoogleDataFeature) => {
      const fips = feature.getProperty("COUNTY") as string;
      const county = FIPS_TO_COUNTY[fips] ?? "";
      const stat = countyStats[county] ?? { pct: 0 };
      map.data.overrideStyle(feature, { ...POLYGON_STYLE, fillColor: coverageColor(stat.pct), fillOpacity: 0.55 });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(countyStats)]);

  if (mapsStatus === "idle") {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm bg-muted/20 rounded-xl">
        <MapIcon className="h-8 w-8 opacity-30" />
        <span className="text-center px-4">Set VITE_GOOGLE_MAPS_BROWSER_KEY to enable the coverage map</span>
      </div>
    );
  }

  if (mapsStatus === "error") {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm bg-muted/20 rounded-xl">
        <MapIcon className="h-8 w-8 opacity-30" />
        <span>Map failed to load</span>
      </div>
    );
  }

  return (
    <div className="relative h-72 rounded-xl overflow-hidden border border-border/40">
      {mapsStatus === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
      {geoError && (
        <div className="absolute bottom-2 left-2 right-2 bg-background/90 text-xs text-muted-foreground text-center rounded-lg py-1 px-2">
          County outlines unavailable
        </div>
      )}
      <div className="absolute bottom-3 right-3 bg-background/90 rounded-lg px-3 py-2 text-[10px] space-y-1 shadow pointer-events-none">
        {[
          { label: "100%", color: "#16a34a" },
          { label: "75%+", color: "#22c55e" },
          { label: "50%+", color: "#86efac" },
          { label: "25%+", color: "#fbbf24" },
          { label: "<25%", color: "#9ca3af" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
