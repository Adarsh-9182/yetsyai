import { NeuralBackground } from "@/components/portfolio/neural-bg";
import { CursorGlow } from "@/components/portfolio/cursor";
import { Nav } from "@/components/portfolio/nav";
import { Hero } from "@/components/portfolio/hero";
import { About } from "@/components/portfolio/about";
import { Skills } from "@/components/portfolio/skills";
import { Experience } from "@/components/portfolio/experience";
import { Projects } from "@/components/portfolio/projects";
import { Achievements } from "@/components/portfolio/achievements";
import { Contact } from "@/components/portfolio/contact";
import { Footer } from "@/components/portfolio/footer";

export default function PortfolioPage() {
  return (
    <>
      {/* Fixed background layers */}
      <NeuralBackground />
      <CursorGlow />

      {/* Navigation */}
      <Nav />

      {/* Page content */}
      <main className="relative z-10">
        <Hero />
        <About />
        <Skills />
        <Experience />
        <Projects />
        <Achievements />
        <Contact />
      </main>

      <Footer />
    </>
  );
}
