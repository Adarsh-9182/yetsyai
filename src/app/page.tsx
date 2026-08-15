import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { NutritionBand } from "@/components/landing/nutrition-band";
import { SiteFooter } from "@/components/landing/site-footer";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <FeatureGrid />
        <NutritionBand />
      </main>
      <SiteFooter />
    </>
  );
}
