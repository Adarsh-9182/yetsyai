"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const roles = [
  "Software & AI Engineer",
  "AI Product Builder",
  "Founder of Paisa AI",
  "Multi-Agent Systems Architect",
  "RAG Pipeline Engineer",
];

const techOrbit = [
  { label: "Python", color: "#3b82f6", delay: "0s", speed: "18s", radius: 130 },
  { label: "LangChain", color: "#a855f7", delay: "2s", speed: "22s", radius: 130 },
  { label: "FastAPI", color: "#06b6d4", delay: "4s", speed: "20s", radius: 130 },
  { label: "React", color: "#6366f1", delay: "6s", speed: "16s", radius: 130 },
  { label: "PyTorch", color: "#f59e0b", delay: "8s", speed: "24s", radius: 130 },
  { label: "Docker", color: "#22d3ee", delay: "1s", speed: "19s", radius: 130 },
];

export function Hero() {
  const [roleIdx, setRoleIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    const current = roles[roleIdx];
    if (typing) {
      if (displayed.length < current.length) {
        const t = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 55);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setTyping(false), 2200);
        return () => clearTimeout(t);
      }
    } else {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 28);
        return () => clearTimeout(t);
      } else {
        setRoleIdx((i) => (i + 1) % roles.length);
        setTyping(true);
      }
    }
  }, [displayed, typing, roleIdx]);

  const containerVar = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
  };
  const itemVar = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 z-0">
        <div className="animated-gradient absolute inset-0 grid-bg" />
        {/* Gradient orbs */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #a855f7, transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-16 flex flex-col lg:flex-row items-center gap-16 w-full">
        {/* Left: Text content */}
        <motion.div
          variants={containerVar}
          initial="hidden"
          animate="show"
          className="flex-1 text-center lg:text-left"
        >
          <motion.div variants={itemVar} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Available for opportunities
          </motion.div>

          <motion.div variants={itemVar}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-none mb-3">
              <span className="text-white">Hi, I'm</span>
            </h1>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-none mb-6 gradient-text text-glow">
              Adarsh
            </h1>
          </motion.div>

          <motion.div variants={itemVar} className="h-10 mb-6">
            <p className="text-lg sm:text-xl lg:text-2xl text-slate-300 font-medium font-mono">
              {displayed}
              <span className="cursor text-indigo-400 ml-0.5">|</span>
            </p>
          </motion.div>

          <motion.p variants={itemVar} className="text-slate-400 text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0">
            Building production-grade AI applications, autonomous agents, and end-to-end AI product systems.
            Currently founding <span className="text-indigo-300 font-semibold">Paisa</span> — an AI CFO & Financial OS.
          </motion.p>

          <motion.div variants={itemVar} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <a
              href="#projects"
              className="btn-primary px-8 py-4 rounded-full text-white font-semibold text-sm relative z-10 inline-flex items-center gap-2 justify-center"
            >
              <span className="relative z-10">View My Work</span>
              <svg className="w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="#contact"
              className="btn-outline px-8 py-4 rounded-full text-slate-200 font-semibold text-sm inline-flex items-center gap-2 justify-center"
            >
              Get In Touch
            </a>
          </motion.div>

          {/* Social links */}
          <motion.div variants={itemVar} className="flex items-center gap-4 mt-10 justify-center lg:justify-start">
            <span className="text-slate-500 text-xs uppercase tracking-widest">Follow</span>
            <div className="h-px flex-1 max-w-12 bg-white/10" />
            {[
              { icon: "github", href: "https://github.com/adarsh-9182", label: "GitHub" },
              { icon: "linkedin", href: "https://linkedin.com/in/adarshbhardwaj", label: "LinkedIn" },
              { icon: "mail", href: "mailto:adarshbhardwaj9182@gmail.com", label: "Email" },
            ].map((s) => (
              <a
                key={s.icon}
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all duration-200 hover:scale-110 hover:glow-primary"
              >
                {s.icon === "github" && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                )}
                {s.icon === "linkedin" && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                )}
                {s.icon === "mail" && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </a>
            ))}
          </motion.div>
        </motion.div>

        {/* Right: 3D Orbital Sphere */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 flex items-center justify-center"
        >
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96">
            {/* Central glow */}
            <div className="absolute inset-0 rounded-full blur-3xl opacity-30"
              style={{ background: "radial-gradient(circle, #6366f1, #a855f7, transparent)" }}
            />

            {/* 3D Orbital rings */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "800px" }}>
              {/* Ring 1 */}
              <div
                className="absolute w-full h-full rounded-full border border-indigo-500/20"
                style={{
                  transform: "rotateX(70deg)",
                  animation: "spin-slow 20s linear infinite",
                }}
              />
              {/* Ring 2 */}
              <div
                className="absolute w-[80%] h-[80%] rounded-full border border-purple-500/25"
                style={{
                  transform: "rotateX(70deg) rotateZ(60deg)",
                  animation: "spin-reverse 15s linear infinite",
                }}
              />
              {/* Ring 3 */}
              <div
                className="absolute w-[60%] h-[60%] rounded-full border border-cyan-500/20"
                style={{
                  transform: "rotateX(70deg) rotateZ(120deg)",
                  animation: "spin-slow 25s linear infinite",
                }}
              />

              {/* Center core */}
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 opacity-80 blur-xl" />
                <div className="absolute inset-2 rounded-full glass-strong border border-white/20 flex items-center justify-center">
                  <span className="text-2xl font-black gradient-text">AI</span>
                </div>
                {/* Pulse rings */}
                <div
                  className="absolute inset-0 rounded-full border border-indigo-500/40"
                  style={{ animation: "pulse-ring 2s ease-out infinite" }}
                />
                <div
                  className="absolute inset-0 rounded-full border border-purple-500/30"
                  style={{ animation: "pulse-ring 2s ease-out 0.7s infinite" }}
                />
              </div>
            </div>

            {/* Orbiting tech chips */}
            <div className="absolute inset-0 flex items-center justify-center">
              {techOrbit.map((tech, i) => {
                const angle = (i / techOrbit.length) * 360;
                return (
                  <div
                    key={tech.label}
                    className="absolute"
                    style={{
                      animation: `orbit ${tech.speed} linear ${tech.delay} infinite`,
                      animationDelay: `${-i * (parseFloat(tech.speed) / techOrbit.length)}s`,
                    }}
                  >
                    <div
                      className="glass border border-white/10 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
                      style={{ color: tech.color, borderColor: tech.color + "40" }}
                    >
                      {tech.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-10 left-0 right-0 flex justify-center px-6"
      >
        <div className="glass border border-white/8 rounded-2xl px-6 py-4 flex flex-wrap gap-8 items-center justify-center">
          {[
            { value: "4+", label: "Projects Built" },
            { value: "3+", label: "AI Products" },
            { value: "5+", label: "Tech Stacks" },
            { value: "∞", label: "Lines of Code" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-black gradient-text">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-10 right-8 hidden lg:flex flex-col items-center gap-2 text-slate-600"
      >
        <span className="text-xs tracking-widest uppercase" style={{ writingMode: "vertical-rl" }}>Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-indigo-500 to-transparent" />
      </motion.div>
    </section>
  );
}
