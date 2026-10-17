import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TP Sécurité — Authentification et OWASP ASVS V6",
  description:
    "Projet pédagogique de mise en pratique des contrôles OWASP ASVS V6 liés à l’authentification. Réalisé par Bakouan et Ouedraogo.",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
