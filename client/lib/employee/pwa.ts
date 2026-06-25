// PWA registration scoped strictly to the technician portal. Called from
// EmployeeLayout.tsx's mount effect — never from the app root — so public,
// customer, and admin pages never load a manifest link or register a
// service worker, and are completely unaffected by any of this.
const MANIFEST_HREF = "/employee-manifest.webmanifest";
const SW_URL = "/employee-sw.js";
// No trailing slash: the technician dashboard's own route is the bare
// "/employee" (see EmployeeLayout's nav, `to: "/employee"`), not
// "/employee/". Service worker scope matching is a plain string prefix on
// the URL path — a scope of "/employee/" would cover "/employee/route" and
// "/employee/profile" but NOT the bare "/employee" dashboard itself, since
// that URL is shorter than the scope string. "/employee" as the scope
// covers all of them, including the dashboard.
const SW_SCOPE = "/employee";

let manifestLink: HTMLLinkElement | null = null;
let appleCapableMeta: HTMLMetaElement | null = null;
let appleStatusBarMeta: HTMLMetaElement | null = null;

export function enableEmployeePwa() {
  if (!manifestLink) {
    manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.href = MANIFEST_HREF;
    document.head.appendChild(manifestLink);
  }

  // iOS Safari ignores the manifest's `display` field for "Add to Home
  // Screen" — these meta tags are what actually make it launch standalone
  // there. Harmless no-ops on browsers that don't read them.
  if (!appleCapableMeta) {
    appleCapableMeta = document.createElement("meta");
    appleCapableMeta.name = "apple-mobile-web-app-capable";
    appleCapableMeta.content = "yes";
    document.head.appendChild(appleCapableMeta);
  }
  if (!appleStatusBarMeta) {
    appleStatusBarMeta = document.createElement("meta");
    appleStatusBarMeta.name = "apple-mobile-web-app-status-bar-style";
    appleStatusBarMeta.content = "black-translucent";
    document.head.appendChild(appleStatusBarMeta);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).catch((err) => {
      // Registration failure (e.g. unsupported browser context, dev-mode
      // quirks) should never break the page — the portal works identically
      // without a service worker, just without offline shell caching.
      console.warn("[employee-pwa] service worker registration failed:", err);
    });
  }
}

export function disableEmployeePwa() {
  if (manifestLink) {
    manifestLink.remove();
    manifestLink = null;
  }
  if (appleCapableMeta) {
    appleCapableMeta.remove();
    appleCapableMeta = null;
  }
  if (appleStatusBarMeta) {
    appleStatusBarMeta.remove();
    appleStatusBarMeta = null;
  }
  // Deliberately does not unregister the service worker on navigating away
  // — an installed/standalone PWA instance may still be running against
  // this scope, and unregistering would break it for no benefit (the
  // worker only ever acts on /employee/* requests regardless of whether
  // the manifest link is currently present in some other tab's DOM).
}
