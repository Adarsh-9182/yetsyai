"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const experiences = [
  {
    role: "AI Engineer",
    company: "TechVision AI — Intelligent Automation Platform",
    type: "Full-Time",
    period: "2024 – Present",
    color: "from-amber-500 to-orange-600",
    dot: "#f59e0b",
    highlights: [
      "Designed and deployed NLP pipelines for document understanding and entity extraction using BERT and GPT-4",
      "Built end-to-end MLOps workflows with automated training, evaluation, and deployment on AWS",
      "Reduced model inference latency by 40% through quantization and ONNX optimization",
      "Developed REST APIs in FastAPI serving 100K+ daily predictions with 99.9% uptime",
    ],
    stack: ["Python", "PyTorch", "FastAPI", "AWS", "Docker", "PostgreSQL"],
  },
  {
    role: "Machine Learning Intern",
    company: "DataSense Labs — ML Research & Products",
    type: "Internship",
    period: "2023",
    color: "from-purple-500 to-indigo-600",
    dot: "#a855f7",
    highlights: [
      "Trained and fine-tuned transformer models for sentiment analysis and text classification",
      "Implemented computer vision pipeline for defect detection achieving 94% accuracy",
      "Collaborated on research paper on few-shot learning for low-resource NLP tasks",
      "Built interactive dashboards with Streamlit to visualize model performance metrics",
    ],
    stack: ["Python", "TensorFlow", "Scikit-learn", "OpenCV", "Streamlit", "Pandas"],
  },
  {
    role: "Full-Stack Developer Intern",
    company: "StartupHub — SaaS Product Studio",
    type: "Internship",
    period: "2022",
    color: "from-cyan-500 to-blue-600",
    dot: "#06b6d4",
    highlights: [
      "Built responsive React.js frontend with Tailwind CSS for a project management SaaS",
      "Developed RESTful APIs with Node.js and Express, integrated with MongoDB",
      "Implemented JWT authentication and role-based access control",
      "Improved page load performance by 35% through code splitting and lazy loading",
    ],
    stack: ["React", "JavaScript", "Node.js", "MongoDB", "CSS", "HTML", "Git"],
  },
  {
    role: "Open Source Contributor",
    company: "GitHub — AI/ML & Web Projects",
    type: "Open Source",
    period: "Ongoing",
    color: "from-emerald-500 to-teal-600",
    dot: "#10b981",
    highlights: [
      "Contributed ML utilities and bug fixes to popular Python AI libraries on GitHub",
      "Developed open-source projects in computer vision, NLP, and web development",
      "Active contributor to Hugging Face community with model uploads and datasets",
    ],
    stack: ["Python", "JavaScript", "HTML/CSS", "Open Source"],
  },
];

export function Experience() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="experience" className="relative py-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/3 right-0 w-72 h-72 rounded-full blur-3xl opacity-8"
        style={{ background: "radial-gradient(circle, #a855f7, transparent)" }} />

      <div className="max-w-6xl mx-auto px-6" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="section-label">03 / Experience</span>
            <div className="h-px flex-1 max-w-16 bg-indigo-500/30" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Where I've{" "}
            <span className="gradient-text">Built & Shipped</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl">
            From internships at AI product companies to full-time engineering — here's my journey.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 lg:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500 via-purple-500 to-transparent" />

          <div className="space-y-12">
            {experiences.map((exp, i) => (
              <motion.div
                key={exp.role}
                initial={{ opacity: 0, x: -30 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.15 + 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative pl-14 lg:pl-20"
              >
                {/* Timeline dot */}
                <div
                  className="absolute left-2 lg:left-6 top-6 w-5 h-5 rounded-full border-2 border-[var(--bg)] flex items-center justify-center"
                  style={{ background: exp.dot, boxShadow: `0 0 12px ${exp.dot}` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>

                {/* Card */}
                <motion.div
                  whileHover={{ x: 4 }}
                  className="gradient-border glass rounded-2xl p-6 lg:p-8 group transition-all duration-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-white font-bold text-lg">{exp.role}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r ${exp.color} text-white`}>
                          {exp.type}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm font-medium">{exp.company}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: exp.dot }} />
                      <span className="text-slate-400 text-sm font-mono">{exp.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-5">
                    {exp.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-3 text-slate-300 text-sm">
                        <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: exp.dot }} />
                        {h}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-2">
                    {exp.stack.map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-slate-400 text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
