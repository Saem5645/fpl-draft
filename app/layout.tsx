// app/layout.tsx
import "./globals.css";
import Script from "next/script";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Activity feed",
  description: "FPL draft activity and transfers",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // You can hard-code your App ID here, but reading from env is safer:
  const oneSignalAppId =
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "PUT_YOUR_APP_ID_HERE";

  return (
    <html lang="en">
      <head>
        {/* OneSignal Web SDK */}
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          strategy="afterInteractive"
        />
        <Script id="onesignal-init" strategy="afterInteractive">
          {`
            // Defer initialization until the SDK is loaded
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function(OneSignal) {
              await OneSignal.init({
                appId: "${oneSignalAppId}",
                allowLocalhostAsSecureOrigin: true
              });
            });
          `}
        </Script>
      </head>

      <body>
        {/* (Optional) your top navigation */}
        <nav style={{ display: "flex", gap: 16, padding: "12px 16px" }}>
          <Link href="/">Activity feed</Link>
          <Link href="/draft">Transfers</Link>
          <Link href="/my-team">My Team</Link>
          <Link href="/account">Account</Link>
        </nav>

        <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
