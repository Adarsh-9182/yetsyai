"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const traits = [
  { icon: "🧠", title: "AI-First Mindset", desc: "Every product I build has intelligence at its core — from autonomous agents to RAG pipelines." },
  { icon: "🚀", title: "Production-Grade", desc: "I ship things that scale. Cloud deployments, Docker, Kubernetes — built for real-world traffic." },
  { icon: "💡", title: "Founder Mentality", desc: "Currently building Paisa, an AI CFO that empowers businesses and individuals with financial intelligence." },
  { icon: "🔬", title: "Deep Research", desc: "Constantly exploring LLMs, multi-agent workflows, and cutting-edge AI architectures." },
];

export function About() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const containerVar = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
  };
  const itemVar = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section id="about" className="relative py-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-1/3 h-full opacity-5">
        <div className="absolute top-1/4 right-0 w-64 h-64 rounded-full bg-indigo-500 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6" ref={ref}>
        <motion.div
          variants={containerVar}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
        >
          {/* Section label */}
          <motion.div variants={itemVar} className="flex items-center gap-4 mb-4">
            <span className="section-label">01 / About</span>
            <div className="h-px flex-1 max-w-16 bg-indigo-500/30" />
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left: Text */}
            <div>
              <motion.h2 variants={itemVar} className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">
                Building the future with{" "}
                <span className="gradient-text">Artificial Intelligence</span>
              </motion.h2>

              <motion.p variants={itemVar} className="text-slate-400 text-lg leading-relaxed mb-6">
                I'm Adarsh Bhardwaj — a Software & AI Engineer obsessed with turning complex AI research into real products that solve real problems. My work spans autonomous AI agents, multi-agent orchestration, RAG pipelines, and cloud-native architectures.
              </motion.p>

              <motion.p variants={itemVar} className="text-slate-400 text-lg leading-relaxed mb-8">
                Right now, I'm founding <span className="text-indigo-300 font-semibold">Paisa</span> — an AI CFO that gives SMEs and individuals an intelligent financial operating system. I believe AI should empower people, not replace them.
              </motion.p>

              <motion.div variants={itemVar} className="flex flex-wrap gap-3">
                {["Python", "TypeScript", "FastAPI", "LangChain", "AWS", "Docker", "PyTorch", "React"].map((tech) => (
                  <span key={tech} className="px-3 py-1.5 rounded-full glass border border-white/10 text-slate-300 text-sm font-medium">
                    {tech}
                  </span>
                ))}
              </motion.div>

              <motion.div variants={itemVar} className="mt-8 flex items-center gap-4">
                <a
                  href="mailto:adarshbhardwaj9182@gmail.com"
                  className="btn-primary px-6 py-3 rounded-full text-white text-sm font-semibold relative z-10 inline-flex items-center gap-2"
                >
                  <span className="relative z-10">Let's Talk</span>
                </a>
                <a
                  href="#projects"
                  className="text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors underline underline-offset-4"
                >
                  See my projects →
                </a>
              </motion.div>
            </div>

            {/* Right: Trait cards */}
            <div className="grid sm:grid-cols-2 gap-4">
              {traits.map((t, i) => (
                <motion.div
                  key={t.title}
                  variants={itemVar}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="gradient-border p-5 rounded-2xl glass transition-all duration-300"
                >
                  <div className="text-3xl mb-3">{t.icon}</div>
                  <h3 className="text-white font-semibold text-base mb-2">{t.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{t.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Quick facts bar */}
          <motion.div variants={itemVar} className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { num: "JEE", sub: "Advanced Appeared", color: "from-indigo-500 to-purple-600" },
              { num: "MCPfy", sub: "AI Intern", color: "from-purple-500 to-pink-600" },
              { num: "NutriScan", sub: "AI Health Engineer", color: "from-cyan-500 to-blue-600" },
              { num: "Paisa", sub: "Founder & AI Engineer", color: "from-amber-500 to-orange-600" },
            ].map((f) => (
              <div key={f.sub} className="glass border border-white/8 rounded-2xl p-4 text-center group hover:border-indigo-500/30 transition-all">
                <div className={`text-lg font-black bg-gradient-to-r ${f.color} bg-clip-text text-transparent mb-1`}>{f.num}</div>
                <div className="text-xs text-slate-400">{f.sub}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
