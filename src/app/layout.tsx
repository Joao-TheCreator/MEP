import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, VT323 } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const display = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-display" });
const body = VT323({ subsets: ["latin"], weight: "400", variable: "--font-body" });

export const metadata: Metadata = {
  title: "Sítio Dae Han",
  description: "Cuide do sítio junto com os amigos — um jogo idle cooperativo.",
  appleWebApp: { capable: true, title: "Sítio", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#3b2630",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
