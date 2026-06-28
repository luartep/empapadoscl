import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Empapados | Menú Digital",
  description:
    "El verdadero sabor que te empapa. Pide tus papas, sandwiches y burgers favoritos directo por WhatsApp.",
};

// Fija el viewport para que la página se vea "tal cual cargó" en el celular:
// sin zoom inicial, y sin que iOS haga auto-zoom al tocar un input.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
