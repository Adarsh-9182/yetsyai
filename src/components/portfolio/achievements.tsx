"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const certificates = [
  {
    title: "Deep Learning Specialization",
    issuer: "Coursera — DeepLearning.AI",
    date: "2024",
    icon: "🧠",
    color: "from-indigo-500 to-purple-600",
    dot: "#6366f1",
    skills: ["Neural Networks", "CNNs", "RNNs", "Transformers"],
    credentialId: "DL-SPEC-2024",
  },
  {
    title: "TensorFlow Developer Certificate",
    issuer: "Google — TensorFlow",
    date: "2023",
    icon: "🤖",
    color: "from-orange-500 to-red-600",
    dot: "#f97316",
    skills: ["TensorFlow", "Keras", "Computer Vision", "NLP"],
    credentialId: "TF-DEV-2023",
  },
  {
    title: "AWS Certified Cloud Practitioner",
    issuer: "Amazon Web Services",
    date: "2023",
    icon: "☁️",
    color: "from-amber-500 to-orange-600",
    dot: "#f59e0b",
    skills: ["EC2", "S3", "Lambda", "Cloud Architecture"],
    credentialId: "AWS-CCP-2023",
  },
  {
    title: "Machine Learning with Python",
    issuer: "IBM — Coursera",
    date: "2023",
    icon: "📊",
    color: "from-blue-500 to-cyan-600",
    dot: "#3b82f6",
    skills: ["Scikit-learn", "Regression", "Clustering", "SVM"],
    credentialId: "IBM-ML-2023",
  },
  {
    title: "Full-Stack Web Development",
    issuer: "The Odin Project / freeCodeCamp",
    date: "2022",
    icon: "🌐",
    color: "from-emerald-500 to-teal-600",
    dot: "#10b981",
    skills: ["HTML", "CSS", "JavaScript", "React", "Node.js"],
    credentialId: "FCC-FSWD-2022",
  },
];

const achievements = [
  {
    icon: "🥇",
    title: "Smart India Hackathon 2023 — Finalist",
    desc: "Reached national finals with an AI-powered crop disease detection system using computer vision, competing among 5,000+ teams across India.",
    color: "from-yellow-500/20 to-orange-500/10",
    border: "rgba(234,179,8,0.3)",
  },
  {
    icon: "🏆",
    title: "Inter-College AI Hackathon — 1st Place",
    desc: "Won the university-level AI hackathon by building a real-time sign language recognition system using deep learning and MediaPipe.",
    color: "from-amber-500/20 to-red-500/10",
    border: "rgba(245,158,11,0.3)",
  },
  {
    icon: "⭐",
    title: "GitHub Star Contributor",
    desc: "Open-source NLP toolkit repo earned 200+ GitHub stars, recognized by the community for clean implementation of transformer fine-tuning utilities.",
    color: "from-indigo-500/20 to-purple-500/10",
    border: "rgba(99,102,241,0.3)",
  },
  {
    icon: "📝",
    title: "Research Paper — IEEE Conference",
    desc: "Co-authored a paper on 'Efficient Few-Shot Learning for Low-Resource NLP' presented at an IEEE student branch conference during final year BTech.",
    color: "from-cyan-500/20 to-blue-500/10",
    border: "rgba(6,182,212,0.3)",
  },
  {
    icon: "🎓",
    title: "University Gold Medalist — AI Elective",
    desc: "Achieved the highest GPA in the AI & Machine Learning elective course across the CSE department, recognized at the annual convocation.",
    color: "from-emerald-500/20 to-teal-500/10",
    border: "rgba(16,185,129,0.3)",
  },
];

export function Achievements() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const containerVar = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09 } },
  };
  const itemVar = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section id="achievements" className="relative py-32 overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full blur-3xl opacity-8"
        style={{ background: "radial-gradient(ellipse, #6366f1, transparent 70%)" }}
      />

      <div className="max-w-7xl mx-auto px-6" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="section-label">05 / Achievements & Certs</span>
            <div className="h-px flex-1 max-w-16 bg-indigo-500/30" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Wins &{" "}
            <span className="gradient-text">Credentials</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl">
            Recognition, milestones, and certifications earned through hard work and a passion for AI.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left: Achievements */}
          <div>
            <motion.h3
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-white font-semibold text-lg mb-8 flex items-center gap-2"
            >
              <span>🏅</span> Achievements
            </motion.h3>
            <motion.div
              variants={containerVar}
              initial="hidden"
              animate={inView ? "show" : "hidden"}
              className="space-y-4"
            >
              {achievements.map((a) => (
                <motion.div
                  key={a.title}
                  variants={itemVar}
                  whileHover={{ x: 4 }}
                  className="relative rounded-2xl p-5 glass transition-all duration-300 cursor-default"
                  style={{
                    background: `linear-gradient(135deg, ${a.color})`,
                    border: `1px solid ${a.border}`,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-2xl shrink-0 mt-0.5">{a.icon}</div>
                    <div>
                      <h4 className="text-white font-semibold text-sm mb-1">{a.title}</h4>
                      <p className="text-slate-400 text-xs leading-relaxed">{a.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right: Certificates */}
          <div>
            <motion.h3
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-white font-semibold text-lg mb-8 flex items-center gap-2"
            >
              <span>🎓</span> Certifications
            </motion.h3>
            <motion.div
              variants={containerVar}
              initial="hidden"
              animate={inView ? "show" : "hidden"}
              className="space-y-4"
            >
              {certificates.map((cert) => (
                <motion.div
                  key={cert.title}
                  variants={itemVar}
                  whileHover={{ y: -3, scale: 1.01 }}
                  className="gradient-border glass rounded-2xl p-5 transition-all duration-300 cursor-default"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cert.color} flex items-center justify-center text-lg shrink-0`}
                    >
                      {cert.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-white font-semibold text-sm leading-snug">{cert.title}</h4>
                        <span className="text-slate-500 text-xs font-mono shrink-0">{cert.date}</span>
                      </div>
                      <p className="text-slate-400 text-xs mb-3">{cert.issuer}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cert.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-slate-400 text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
