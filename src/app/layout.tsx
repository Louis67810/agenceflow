import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgenceFlow - Gestion de projets créatifs",
  description:
    "Plateforme de gestion de projets pour agences créatives. Gérez vos clients, designers et projets en un seul endroit.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
