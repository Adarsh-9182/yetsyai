import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sprite } from "@/components/Icons";

export const metadata: Metadata = {
  title: "NutritiScan — Your AI Doctor",
  description:
    "An AI doctor and personal health intelligence platform. Understand symptoms, reports, medications and test results through a calm, trustworthy conversation — grounded in medical research.",
};

export const viewport: Viewport = {
  themeColor: "#f3f2ec",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Sprite />
        <main className="__root">{children}</main>
      </body>
    </html>
  );
}
