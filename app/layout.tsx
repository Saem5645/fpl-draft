// app/layout.tsx
import "./globals.css";
import Script from "next/script";
import Link from "next/link";
import type { ReactNode } from "react";
import EnablePushButton from "@/components/EnablePushButton";

export const metadata = {
  title: "Activity feed",
  description: "FPL draft activity and transfers",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const oneSignalAppId =
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "5756f280-0e71-4d6c-865d-33c15f515901";

  return (
    <html lang="en">
      <head>
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
                  serviceWorkerPath: "/OneSignalSDKWorker.js",
                  serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
                  allowLocalhostAsSecureOrigin: true
                });

                const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
                if (perm === 'default') {
                  if (OneSignal.Slidedown?.promptPush) {
                    await OneSignal.Slidedown.promptPush();
                  } else if (OneSignal.Notifications?.requestPermission) {
                    await OneSignal.Notifications.requestPermission();
                  }
                }
              } catch (e) {
                console.error('OneSignal init error:', e);
              }

              // Exposed for the client button
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

          {/* Client-side button (no handler in layout) */}
          <EnablePushButton />
        </nav>

        <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
