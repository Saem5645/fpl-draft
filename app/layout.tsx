// app/layout.tsx
import './globals.css';
import Link from 'next/link';

export const metadata = { title: 'FPL Draft Tracker' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <div className="container" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link href="/" className="badge" style={{ fontWeight: 600 }}>Activity Feed</Link>
            <Link href="/draft" className="badge">Transfers</Link>
            <Link href="/my-team" className="badge">My Team</Link>
            <Link href="/account" className="badge">Account</Link>
          </div>
        </nav>
        <main className="container" style={{ paddingTop: 16 }}>{children}</main>
      </body>
    </html>
  );
}
