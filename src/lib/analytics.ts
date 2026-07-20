/**
 * Analytics GA4 opcional: só ativa se VITE_GA_MEASUREMENT_ID estiver definido
 * (ex.: G-XXXXXXXXXX em .env). Sem ID, todas as funções são no-op.
 */
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let loaded = false;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function initAnalytics() {
  if (!GA_ID || loaded) return;
  loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: false });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

export function trackPageView(path: string) {
  if (!GA_ID || !loaded) return;
  window.gtag('event', 'page_view', { page_path: path });
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!GA_ID || !loaded) return;
  window.gtag('event', name, params ?? {});
}
