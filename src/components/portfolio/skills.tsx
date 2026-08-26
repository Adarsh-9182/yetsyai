"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const categories = [
  {
    icon: "⚡",
    title: "Languages",
    color: "from-yellow-500 to-orange-500",
    glow: "rgba(234,179,8,0.15)",
    skills: ["Python", "JavaScript", "TypeScript", "C++", "Java", "SQL", "HTML", "CSS"],
  },
  {
    icon: "🔷",
    title: "Frameworks & Libraries",
    color: "from-blue-500 to-indigo-600",
    glow: "rgba(59,130,246,0.15)",
    skills: ["React", "Next.js", "FastAPI", "Flask", "Django", "Node.js", "Express", "Tailwind CSS"],
  },
  {
    icon: "🗄️",
    title: "Databases",
    color: "from-emerald-500 to-teal-600",
    glow: "rgba(16,185,129,0.15)",
    skills: ["PostgreSQL", "MongoDB", "MySQL", "Redis", "ChromaDB", "Pinecone"],
  },
  {
    icon: "🤖",
    title: "AI / ML",
    color: "from-purple-500 to-indigo-600",
    glow: "rgba(168,85,247,0.15)",
    skills: ["TensorFlow", "PyTorch", "Scikit-learn", "OpenAI API", "LangChain", "Hugging Face", "NumPy", "Pandas", "YOLO", "OpenCV"],
  },
  {
    icon: "☁️",
    title: "Cloud & DevOps",
    color: "from-cyan-500 to-blue-500",
    glow: "rgba(6,182,212,0.15)",
    skills: ["AWS", "GCP", "Docker", "GitHub Actions", "Vercel", "Netlify"],
  },
  {
    icon: "🛠️",
    title: "Tools & Concepts",
    color: "from-rose-500 to-pink-600",
    glow: "rgba(244,63,94,0.15)",
    skills: ["Git", "REST APIs", "Jupyter", "Postman", "Linux", "Agile", "VS Code", "Figma"],
  },
];

const coreSkills = [
  { label: "Python & AI/ML", pct: 92 },
  { label: "Deep Learning & NLP", pct: 88 },
  { label: "JavaScript / React", pct: 85 },
  { label: "Backend Development", pct: 83 },
  { label: "HTML & CSS / UI", pct: 80 },
];

export function Skills() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const containerVar = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const cardVar = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section id="skills" className="relative py-32 overflow-hidden">
      {/* BG glow */}
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-10"
        style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />

      <div className="max-w-7xl mx-auto px-6" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="section-label">02 / Skills</span>
            <div className="h-px flex-1 max-w-16 bg-indigo-500/30" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Tech Stack &{" "}
            <span className="gradient-text">Superpowers</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl">
            A full-stack AI engineer comfortable across the entire product lifecycle — from model training to cloud deployment.
          </p>
        </motion.div>

        {/* Proficiency bars */}
        <div className="grid lg:grid-cols-2 gap-16 mb-20">
          <div>
            <h3 className="text-white font-semibold mb-8 text-lg">Core Proficiencies</h3>
            <div className="space-y-6">
              {coreSkills.map((skill, i) => (
                <motion.div
                  key={skill.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: i * 0.1 + 0.2, duration: 0.5 }}
                >
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-300 text-sm font-medium">{skill.label}</span>
                    <span className="text-indigo-400 text-sm font-mono font-semibold">{skill.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #6366f1, #a855f7, #06b6d4)" }}
                      initial={{ width: 0 }}
                      animate={inView ? { width: `${skill.pct}%` } : { width: 0 }}
                      transition={{ duration: 1, delay: i * 0.1 + 0.4, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Decorative element */}
          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-500/20" style={{ animation: "spin-slow 20s linear infinite" }} />
              <div className="absolute inset-4 rounded-full border border-purple-500/20" style={{ animation: "spin-reverse 15s linear infinite" }} />
              <div className="absolute inset-8 rounded-full border border-cyan-500/20" style={{ animation: "spin-slow 10s linear infinite" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-black gradient-text">4+</div>
                  <div className="text-slate-400 text-xs mt-1">Years of</div>
                  <div className="text-slate-400 text-xs">Coding</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Skill category cards */}
        <motion.div
          variants={containerVar}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {categories.map((cat) => (
            <motion.div
              key={cat.title}
              variants={cardVar}
              whileHover={{ y: -6, scale: 1.02 }}
              className="gradient-border rounded-2xl p-6 glass group transition-all duration-300 cursor-default"
              style={{ boxShadow: `0 0 0px ${cat.glow}` }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 20px 40px ${cat.glow}, 0 0 0 1px ${cat.glow}`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0px ${cat.glow}`;
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-lg`}>
                  {cat.icon}
                </div>
                <h3 className="text-white font-semibold text-sm">{cat.title}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {cat.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-slate-300 border border-white/8 hover:border-indigo-500/40 hover:text-white transition-colors"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
