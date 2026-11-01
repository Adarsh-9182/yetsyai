"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => { setTheme(document.documentElement.dataset.theme || "dark"); }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#f5f5ef" : "#0b0c0e");
    try { localStorage.setItem("yetsyai-theme", next); } catch { /* Works without persistence. */ }
    setTheme(next);
  }
  return <button className="icon-button theme-toggle" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>;
}
