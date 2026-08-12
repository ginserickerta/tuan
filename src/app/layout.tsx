import type { Metadata, Viewport } from "next";
import { Anuphan, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AppInit from "@/components/AppInit";

// Anuphan carries Thai and Latin in one contemporary humanist face; JetBrains
// Mono exists purely so columns of minutes and day-counts stay aligned.
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFB" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0D12" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${anuphan.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppInit />
        <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-5 pb-28">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
