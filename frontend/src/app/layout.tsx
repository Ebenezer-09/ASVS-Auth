import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASVS Auth — Sécurité de l'authentification",
  description: "Tableau de suivi des critères ASVS liés à l'authentification.",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
