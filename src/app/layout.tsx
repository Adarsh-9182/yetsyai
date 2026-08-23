import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adarsh Bhardwaj — Software & AI Engineer",
  description:
    "Portfolio of Adarsh Bhardwaj — Software & AI Engineer building production-grade AI applications, autonomous agents, RAG pipelines, and AI products. Founder of Paisa AI CFO.",
  keywords: ["AI Engineer", "Software Engineer", "Machine Learning", "LangChain", "FastAPI", "React", "Python", "Adarsh Bhardwaj"],
  authors: [{ name: "Adarsh Bhardwaj" }],
  creator: "Adarsh Bhardwaj",
  openGraph: {
    type: "website",
    title: "Adarsh Bhardwaj — Software & AI Engineer",
    description: "Building production-grade AI applications, autonomous agents, and AI products.",
    siteName: "Adarsh Bhardwaj Portfolio",
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
