import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chandan Kumar — AI Engineer",
  description:
    "Portfolio of Chandan Kumar — AI Engineer & BTech CSE graduate building intelligent applications, ML pipelines, and full-stack AI products.",
  keywords: ["AI Engineer", "Machine Learning", "Python", "JavaScript", "React", "Deep Learning", "Chandan Kumar", "BTech CSE"],
  authors: [{ name: "Chandan Kumar" }],
  creator: "Chandan Kumar",
  openGraph: {
    type: "website",
    title: "Chandan Kumar — AI Engineer",
    description: "Building intelligent AI applications, ML pipelines, and full-stack products.",
    siteName: "Chandan Kumar Portfolio",
  },
};

export const viewport: Viewport = {
  themeColor: "#050508",
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
