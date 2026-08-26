"use client";
import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const projects = [
  {
    title: "SmartDoc AI",
    subtitle: "Intelligent Document Q&A System",
    desc: "Full-stack RAG-powered document intelligence platform. Upload PDFs, research papers, or legal docs and ask questions in natural language. Combines vector search with GPT-4 for precise, cited answers.",
    tags: ["Python", "FastAPI", "LangChain", "ChromaDB", "React", "OpenAI API"],
    gradient: "from-amber-500/20 via-orange-600/10 to-transparent",
    border: "rgba(245,158,11,0.25)",
    glow: "rgba(245,158,11,0.15)",
    icon: "📄",
    status: "Live",
    statusColor: "#10b981",
    featured: true,
    links: { github: "https://github.com/chandan1909kumarck-dotcom", live: "#" },
  },
  {
    title: "VisionGuard",
    subtitle: "Real-Time Object Detection & Alert System",
    desc: "Computer vision security system using YOLOv8 for real-time object and intrusion detection. Sends instant alerts via email and SMS. Deployed on edge devices with a React dashboard for live monitoring.",
    tags: ["Python", "PyTorch", "YOLO", "OpenCV", "React", "FastAPI", "Docker"],
    gradient: "from-cyan-500/20 via-blue-600/10 to-transparent",
    border: "rgba(6,182,212,0.25)",
    glow: "rgba(6,182,212,0.15)",
    icon: "👁️",
    status: "Live",
    statusColor: "#10b981",
    featured: true,
    links: { github: "https://github.com/chandan1909kumarck-dotcom", live: null },
  },
  {
    title: "SentimentScope",
    subtitle: "NLP Sentiment Analysis Dashboard",
    desc: "Fine-tuned BERT model for multi-class sentiment analysis on product reviews and social media. Features an interactive React dashboard with real-time predictions and confidence scores.",
    tags: ["Python", "Hugging Face", "TensorFlow", "React", "JavaScript", "CSS"],
    gradient: "from-purple-500/20 via-indigo-600/10 to-transparent",
    border: "rgba(168,85,247,0.25)",
    glow: "rgba(168,85,247,0.15)",
    icon: "💬",
    status: "Open Source",
    statusColor: "#6366f1",
    featured: false,
    links: { github: "https://github.com/chandan1909kumarck-dotcom", live: null },
  },
  {
    title: "DevPortal",
    subtitle: "Full-Stack Developer Collaboration Hub",
    desc: "A GitHub-integrated developer portfolio and project showcase platform. Built with Next.js and a Node.js backend, with real-time collaboration features, markdown rendering, and project analytics.",
    tags: ["Next.js", "JavaScript", "Node.js", "MongoDB", "HTML", "Tailwind CSS"],
    gradient: "from-emerald-500/20 via-teal-600/10 to-transparent",
    border: "rgba(16,185,129,0.25)",
    glow: "rgba(16,185,129,0.15)",
    icon: "🌐",
    status: "Live",
    statusColor: "#10b981",
    featured: false,
    links: { github: "https://github.com/chandan1909kumarck-dotcom", live: "#" },
  },
];

function ProjectCard({ project, i }: { project: typeof projects[0]; i: number }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -12;
    setTilt({ x, y });
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{
        transform: `perspective(800px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
        transition: "transform 0.15s ease, box-shadow 0.3s ease",
        boxShadow: tilt.x || tilt.y
          ? `0 30px 60px ${project.glow}, 0 0 0 1px ${project.border}`
          : `0 4px 24px rgba(0,0,0,0.2)`,
      }}
      className="relative glass rounded-2xl overflow-hidden group cursor-default"
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${project.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-500`} />

      {/* Shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 shimmer" />
      </div>

      {/* Border */}
      <div
        className="absolute inset-0 rounded-2xl border transition-all duration-300"
        style={{ borderColor: project.border, opacity: 0.4 }}
      />
      <div
        className="absolute inset-0 rounded-2xl border opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ borderColor: project.border }}
      />

      <div className="relative z-10 p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{project.icon}</div>
            <div>
              <h3 className="text-white font-bold text-lg">{project.title}</h3>
              <p className="text-slate-400 text-xs">{project.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: project.statusColor }} />
            <span className="text-xs font-medium" style={{ color: project.statusColor }}>{project.status}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-slate-300 text-sm leading-relaxed mb-6">{project.desc}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {project.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-slate-400 text-xs">
              {tag}
            </span>
          ))}
        </div>

        {/* Links */}
        <div className="flex items-center gap-3">
          {project.links.github && (
            <a
              href={project.links.github}
              className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10 text-slate-300 text-xs font-medium hover:text-white hover:border-indigo-500/50 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          )}
          {project.links.live && (
            <a
              href={project.links.live}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold btn-primary text-white relative z-10"
            >
              <span className="relative z-10">View Live</span>
              <svg className="w-3.5 h-3.5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function Projects() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="projects" className="relative py-32 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-5"
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
            <span className="section-label">04 / Projects</span>
            <div className="h-px flex-1 max-w-16 bg-indigo-500/30" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Things I've{" "}
            <span className="gradient-text">Built</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl">
            AI-powered systems solving real problems — from document intelligence to computer vision and NLP.
          </p>
        </motion.div>

        {/* Featured projects — big grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {projects.filter((p) => p.featured).map((p, i) => (
            <ProjectCard key={p.title} project={p} i={i} />
          ))}
        </div>

        {/* Other projects */}
        <div className="grid sm:grid-cols-2 gap-6">
          {projects.filter((p) => !p.featured).map((p, i) => (
            <ProjectCard key={p.title} project={p} i={i + 2} />
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <a
            href="https://github.com/chandan1909kumarck-dotcom"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            See all projects on GitHub
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
