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
  const oneSignalAppId =
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "PUT_YOUR_APP_ID_HERE";

  return (
    <html lang="en">
      <head>
        {/* OneSignal SDK */}
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          strategy="afterInteractive"
        />
        <Script id="onesignal-init" strategy="afterInteractive">
          {`
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function(OneSignal) {
              try {
                await OneSignal.init({
                  appId: "${oneSignalAppId}",
                  // ensure SW paths if you host at root /public
                  serviceWorkerPath: "/OneSignalSDKWorker.js",
                  serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
                  allowLocalhostAsSecureOrigin: true
                });

                // Actively prompt if permission is 'default' (not granted/denied)
                const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
                if (perm === 'default') {
                  // Use OneSignal's slidedown UI. If unavailable, fall back to native prompt.
                  if (OneSignal.Slidedown && OneSignal.Slidedown.promptPush) {
                    await OneSignal.Slidedown.promptPush();
                  } else if (OneSignal.Notifications?.requestPermission) {
                    await OneSignal.Notifications.requestPermission();
                  }
                }
              } catch (e) {
                console.error('OneSignal init error:', e);
              }

              // Expose a manual enable function (used by the button below)
              window.enablePushManually = async () => {
                try {
                  if (OneSignal.Slidedown?.promptPush) {
                    await OneSignal.Slidedown.promptPush();
                  } else if (OneSignal.Notifications?.requestPermission) {
                    await OneSignal.Notifications.requestPermission();
                  }
                } catch (e) {
                  console.error('Manual push enable failed:', e);
                }
              };
            });
          `}
        </Script>
      </head>
      <body>
        <nav style={{ display: "flex", gap: 16, padding: "12px 16px" }}>
          <Link href="/">Activity feed</Link>
          <Link href="/draft">Transfers</Link>
          <Link href="/my-team">My Team</Link>
          <Link href="/account">Account</Link>
          {/* Manual enable (shows if still blocked/default) */}
          <button
            onClick={() => (window as any).enablePushManually?.()}
            style={{ marginLeft: "auto", fontSize: 12 }}
            className="btn secondary"
            title="Enable notifications"
          >
            Enable notifications
          </button>
        </nav>

        <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
