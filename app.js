/* ═══════════════════════════════════════════
   YetsyAI — hero particle field, typed prompts,
   scroll reveals, nav state
   ═══════════════════════════════════════════ */

/* ── 1. Nav: frost the bar once the user scrolls ── */
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 24);
}, { passive: true });

/* ── 2. Scroll reveals: fade sections in as they enter view ── */
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

/* ── 3. Typed prompt loop in the hero bar ── */
const prompts = [
  "A samurai walking through neon-soaked Tokyo rain…",
  "Crash zoom on a lighthouse as the storm breaks…",
  "FPV drone diving through a glass cathedral at dawn…",
  "Bullet time around a dancer mid-leap, embers everywhere…",
  "Slow orbit of a monk crossing a salt flat, red robes in wind…",
];
const promptText = document.getElementById("promptText");
let promptIndex = 0;

function typePrompt(text, i = 0) {
  if (i <= text.length) {
    promptText.textContent = text.slice(0, i);
    setTimeout(() => typePrompt(text, i + 1), 34);
  } else {
    setTimeout(() => erasePrompt(text.length), 2200);
  }
}
function erasePrompt(i) {
  if (i >= 0) {
    promptText.textContent = promptText.textContent.slice(0, i);
    setTimeout(() => erasePrompt(i - 1), 12);
  } else {
    promptIndex = (promptIndex + 1) % prompts.length;
    typePrompt(prompts[promptIndex]);
  }
}
typePrompt(prompts[0]);

document.getElementById("generateBtn").addEventListener("click", () => {
  document.getElementById("pricing").scrollIntoView({ behavior: "smooth" });
});

/* ── 4. Hero canvas: drifting ember particle field ── */
const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
let particles = [];

function resize() {
  canvas.width = canvas.offsetWidth * devicePixelRatio;
  canvas.height = canvas.offsetHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
}
resize();
window.addEventListener("resize", resize);

function spawnParticles() {
  const count = Math.min(90, Math.floor(canvas.offsetWidth / 14));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.offsetWidth,
    y: Math.random() * canvas.offsetHeight,
    r: Math.random() * 1.8 + 0.4,
    vx: (Math.random() - 0.5) * 0.25,
    vy: -(Math.random() * 0.35 + 0.08),
    hue: Math.random() < 0.7 ? 16 : 40, // embers + gold sparks
    alpha: Math.random() * 0.5 + 0.15,
    flicker: Math.random() * 0.02 + 0.005,
  }));
}
spawnParticles();

function tick() {
  ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha += (Math.random() - 0.5) * p.flicker * 10;
    p.alpha = Math.max(0.05, Math.min(0.7, p.alpha));

    if (p.y < -10) { p.y = canvas.offsetHeight + 10; p.x = Math.random() * canvas.offsetWidth; }
    if (p.x < -10) p.x = canvas.offsetWidth + 10;
    if (p.x > canvas.offsetWidth + 10) p.x = -10;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 90%, 62%, ${p.alpha})`;
    ctx.shadowColor = `hsla(${p.hue}, 90%, 60%, 0.8)`;
    ctx.shadowBlur = 8;
    ctx.fill();
  }
  requestAnimationFrame(tick);
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduceMotion) tick();
