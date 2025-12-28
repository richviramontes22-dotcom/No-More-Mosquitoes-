export function navUrl(lat: number, lng: number) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isApple = /iPad|iPhone|Macintosh/.test(ua);
  return isApple
    ? `http://maps.apple.com/?daddr=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
