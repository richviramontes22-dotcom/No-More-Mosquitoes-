import { useState } from "react";

export function ClockWidget({ onClockIn, onClockOut }: { onClockIn: (geo?: GeolocationPosition) => void; onClockOut: (geo?: GeolocationPosition) => void; }) {
  const [onDuty, setOnDuty] = useState(false);

  const requestGeo = () => new Promise<GeolocationPosition | undefined>((resolve) => {
    if (!("geolocation" in navigator)) return resolve(undefined);
    navigator.geolocation.getCurrentPosition((pos) => resolve(pos), () => resolve(undefined), { enableHighAccuracy: true });
  });

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/95 p-4">
      <div>
        <div className="text-sm text-muted-foreground">Shift status</div>
        <div className="text-lg font-semibold">{onDuty ? "On Duty" : "Off Duty"}</div>
      </div>
      {onDuty ? (
        <button className="rounded-full bg-destructive px-4 py-2 text-destructive-foreground" onClick={async () => { const geo = await requestGeo(); onClockOut(geo); setOnDuty(false); }}>
          Clock Out
        </button>
      ) : (
        <button className="rounded-full bg-emerald-600 px-4 py-2 text-white" onClick={async () => { const geo = await requestGeo(); onClockIn(geo); setOnDuty(true); }}>
          Clock In
        </button>
      )}
    </div>
  );
}
