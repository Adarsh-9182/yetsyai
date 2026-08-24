"use client";
import { useEffect, useRef } from "react";

export function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let x = -500, y = -500;
    let cx = -500, cy = -500;
    let raf: number;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
    };
    window.addEventListener("mousemove", onMove);

    const animate = () => {
      cx += (x - cx) * 0.08;
      cy += (y - cy) * 0.08;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${cx - 300}px, ${cy - 300}px)`;
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      className="fixed top-0 left-0 w-[600px] h-[600px] pointer-events-none z-0 rounded-full"
      style={{
        background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, rgba(168,85,247,0.04) 40%, transparent 70%)",
        willChange: "transform",
      }}
    />
  );
}
