import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kliments · Klientský portál",
  description: "Finanční řízení · Josef Kliment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="antialiased">{children}</body>
    </html>
  );
}