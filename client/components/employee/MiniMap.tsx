export default function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="grid h-48 w-full place-items-center rounded-xl bg-[repeating-linear-gradient(45deg,#f3f3f3,#f3f3f3_10px,#ececec_10px,#ececec_20px)] text-xs text-muted-foreground">
      Map preview ({lat.toFixed(3)}, {lng.toFixed(3)})
    </div>
  );
}
