import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgenceFlow - Gestion de projets créatifs",
  description:
    "Plateforme de gestion de projets pour agences créatives. Gérez vos clients, designers et projets en un seul endroit.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AgenceFlow",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0147ff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
