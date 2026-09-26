import { GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY } from "@/lib/google-analytics-consent";

export const GOOGLE_ANALYTICS_READY_EVENT = "rosagiro:analytics-ready";

export function googleTagBootstrap(adsId: string, measurementId: string) {
  const destinations = [
    /^AW-\d+$/.test(adsId) ? adsId : "",
    /^G-[A-Z0-9]+$/.test(measurementId) ? measurementId : ""
  ].filter(Boolean);
  if (!destinations.length) return "";
  return `
    (function () {
      var loaded = false;
      function start() {
      var dnt = navigator.doNotTrack || navigator.msDoNotTrack || window.doNotTrack;
      if (dnt === '1' || dnt === 'yes' || navigator.globalPrivacyControl === true) return;
      if (/^\\/(admin|api|pagamento-simulado)(\\/|$)/.test(location.pathname)) return;
      try { if (localStorage.getItem('rosagiro:google-consent') !== 'granted') return; } catch (_) { return; }
      if (loaded) return;
      loaded = true;
      var destinations = ${JSON.stringify(destinations)};
      var path = location.pathname.replace(/^\\/pedido\\/[^/]+.*$/, '/pedido');
      var referrer = '';
      try { referrer = document.referrer ? new URL(document.referrer).origin + '/' : ''; } catch (_) {}
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      destinations.forEach(function (id) {
        window.gtag('config', id, {
          send_page_view: false,
          page_location: location.origin + path,
          page_referrer: referrer,
          page_title: path === '/pedido' ? 'Pedido RosaGiro' : document.title
        });
      });
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(destinations[0]);
      document.head.appendChild(script);
      window.dispatchEvent(new Event(${JSON.stringify(GOOGLE_ANALYTICS_READY_EVENT)}));
      }
      function onStorage(event) {
        if (!event || event.key !== ${JSON.stringify(GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY)}) return;
        if (event.newValue === 'granted') {
          start();
          return;
        }
        if (loaded && (event.newValue === 'denied' || event.newValue === null)) location.reload();
      }
      window.addEventListener('rosagiro:consent-change', start);
      window.addEventListener('storage', onStorage);
      start();
    })();
  `;
}

export function analyticsPageContext(location: { origin: string; pathname: string }, title: string, referrer: string) {
  if (/^\/(admin|api|pagamento-simulado)(\/|$)/.test(location.pathname)) return null;
  const path = location.pathname.replace(/^\/pedido\/[^/]+.*$/, "/pedido");
  let referrerOrigin = "";
  try { referrerOrigin = referrer ? `${new URL(referrer).origin}/` : ""; } catch { /* Invalid referrers are omitted. */ }
  return {
    page_location: `${location.origin}${path}`,
    page_referrer: referrerOrigin,
    page_title: path === "/pedido" ? "Pedido RosaGiro" : title
  };
}
