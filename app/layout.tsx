import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Empapados | Menú Digital",
  description:
    "El verdadero sabor que te empapa. Pide tus papas, sandwiches y burgers favoritos directo por WhatsApp.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
