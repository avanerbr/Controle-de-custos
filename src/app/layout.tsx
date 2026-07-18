import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contas Michael & Jamille",
  description: "Controle de despesas de casa e da empresa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
