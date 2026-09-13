import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./redesign.css";
import "./electric.css";
import "./pwa.css";
import CYIShell from "./cyi-shell";
import { PWAProvider } from "./pwa-manager";
import { siteDescription, siteMetadata, siteUrl } from "@/lib/site-metadata";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  ...siteMetadata("CYI | Alive with Purpose.", "/", siteDescription),
  title: { default: "CYI | Alive with Purpose.", template: "%s | CYI" },
  applicationName: "CYI",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CYI", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#110921",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PWAProvider><CYIShell>{children}</CYIShell></PWAProvider></body></html>;
}
