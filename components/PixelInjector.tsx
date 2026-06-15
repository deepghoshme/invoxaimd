import Script from "next/script";

type Pixels = { meta_pixel_id?: string; google_id?: string };

/**
 * Injects per-page Meta (Facebook) + Google (GA4 or Ads) pixels into the public
 * page. IDs come from the page's JSONB `pixels`. Fires page-view on load.
 */
export default function PixelInjector({ pixels }: { pixels: Pixels }) {
  const meta = pixels?.meta_pixel_id?.trim();
  const google = pixels?.google_id?.trim();

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
            gtag('config', '${google}');`}
          </Script>
        </>
      )}
    </>
  );
}
