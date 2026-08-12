import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AppInit from "@/components/AppInit";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ทวน — Spaced Repetition",
  description: "ระบบทบทวนแบบเว้นระยะ เตรียมสอบ TGAT/TPAT และ A-Level",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png", // iOS ignores SVG manifest icons
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ทวน",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // prevent iOS zoom-on-input
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        <AppInit />
        <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 pb-24">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
