import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { SwRegister } from "@/components/SwRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brutality TCG",
  description: "Deathcore artist card collection for the Brutality community.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Brutality <span>TCG</span>
          </Link>
          <nav className="nav">
            <Link href="/binder">My Binder</Link>
            <Link href="/global">Global</Link>
            {session ? (
              <a href="/api/auth/logout">Sign out ({session.username})</a>
            ) : (
              <a href="/api/auth/login">Sign in</a>
            )}
          </nav>
        </header>
        <main>{children}</main>
        <SwRegister />
      </body>
    </html>
  );
}
