import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yetsyai — Make something unreal",
  description: "An AI video studio for turning your ideas into cinematic videos.",
  keywords: ["AI video", "video generation", "creative studio", "Yetsyai"],
  applicationName: "Yetsyai",
  creator: "Yetsyai",
  openGraph: {
    type: "website",
    title: "Yetsyai — Make something unreal",
    description: "Dream it up. Direct every detail. Make it yours.",
    siteName: "Yetsyai",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0c0e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
