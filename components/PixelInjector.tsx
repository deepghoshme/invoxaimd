import Script from "next/script";

/** Per-page pixel overrides (from pages.pixels JSONB column). */
type PagePixels = { meta_pixel_id?: string; google_id?: string };

/** Store-level pixel defaults (from stores columns added by the store_seo migration). */
type StorePixels = {
  meta_pixel_id?: string | null;
  google_analytics_id?: string | null;
  google_ads_id?: string | null;
};

/**
 * Injects Meta (Facebook) + Google (GA4 / Ads) pixels into a public page.
 *
 * Resolution order (most-specific wins):
 *   1. Per-page `pixels` JSONB (page-level override set in the page builder)
 *   2. Store-level defaults (`meta_pixel_id`, `google_analytics_id`,
 *      `google_ads_id` columns on `stores` — set in the SEO & Pixels dashboard)
 *
 * Safe to call with empty / undefined arguments — renders nothing.
 */
export default function PixelInjector({
  pixels,
  storePixels,
}: {
  pixels?: PagePixels;
  storePixels?: StorePixels;
}) {
  // Meta Pixel: page-level override wins; fall back to store-level.
  const meta =
    (pixels?.meta_pixel_id?.trim() || storePixels?.meta_pixel_id?.trim()) ?? "";

  // Google: page-level google_id (could be GA4 or Ads) wins; otherwise prefer
  // GA4 store column, then Ads store column.
  const google =
    (pixels?.google_id?.trim() ||
      storePixels?.google_analytics_id?.trim() ||
      storePixels?.google_ads_id?.trim()) ?? "";

  // Google Ads fires a *second* gtag config call when a dedicated ads ID exists
  // and is different from the main google ID already being loaded.
  const googleAds =
    storePixels?.google_ads_id?.trim() &&
    storePixels.google_ads_id.trim() !== google
      ? storePixels.google_ads_id.trim()
      : "";

  if (!meta && !google && !googleAds) return null;

  return (
    <>
      {meta && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${meta}'); fbq('track', 'PageView');`}
        </Script>
      )}

      {google && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${google}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${google}');${googleAds ? `\n            gtag('config', '${googleAds}');` : ""}`}
          </Script>
        </>
      )}

      {/* Ads-only path: no GA4 but a dedicated Google Ads ID. */}
      {!google && googleAds && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAds}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-ads-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${googleAds}');`}
          </Script>
        </>
      )}
    </>
  );
}
