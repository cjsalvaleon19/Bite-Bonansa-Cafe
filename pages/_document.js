import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {/* Theme colour — used by mobile browsers for the browser chrome. */}
          <meta name="theme-color" content="#0a0a0a" />
          {/* Favicon — served from /public so browsers don't 404 on resource requests */}
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

          {/* Google Fonts — preconnect first to reduce latency, then load stylesheets.
              These domains are already allowed by the CSP in next.config.js. */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Poppins:wght@400;600;700&display=swap"
            rel="stylesheet"
          />
          
          {/* Leaflet CSS */}
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossOrigin=""
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
