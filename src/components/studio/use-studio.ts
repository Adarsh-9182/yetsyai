"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Generation, GenerationInput, isActive } from "@/lib/video/types";

export function useStudio() {
  const [jobs, setJobs] = useState<Generation[]>([]);
  const [configured, setConfigured] = useState(false);
  const [storageConfigured, setStorageConfigured] = useState(true);
  const [capabilities, setCapabilities] = useState({ model: "Wan 2.2 · Open model", provider: "huggingface", durations: [5], audio: false, image: false, authConfigured: false, signedIn: false, mediaConfigured: false, configuration: { accounts: false, database: false, media: false, generation: false } });
  const [usage, setUsage] = useState<{ used: number; limit: number; globalRemaining: number | null; resetsAt: string | null }>({ used: 0, limit: 2, globalRemaining: null, resetsAt: null });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const submitLock = useRef(false);
  const loadVersion = useRef(0);
  const lastLoaded = useRef(0);
  const pendingRequest = useRef<{ signature: string; id: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal, quiet = false) => {
    const version = ++loadVersion.current;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/generations", { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't load your studio.");
      if (signal?.aborted || version !== loadVersion.current) return;
      lastLoaded.current = Date.now();
      setJobs(data.generations);
      setConfigured(data.configured);
      setStorageConfigured(data.storageConfigured !== false);
      setCapabilities({ model: data.model, provider: data.provider, durations: data.durations || [5], audio: Boolean(data.audio), image: Boolean(data.image), authConfigured: Boolean(data.authConfigured), signedIn: Boolean(data.signedIn), mediaConfigured: Boolean(data.mediaConfigured), configuration: data.configuration || { accounts: false, database: false, media: false, generation: false } });
      setUsage({ used: 0, limit: 2, globalRemaining: null, resetsAt: null, ...data.usage });
      setError("");
    } catch (reason) {
      if (!signal?.aborted && version === loadVersion.current) setError(reason instanceof Error ? reason.message : "Couldn't load your studio.");
    } finally { if (!signal?.aborted && version === loadVersion.current) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    // Renew signed media URLs and account state after a long-lived or suspended tab.
    const refresh = () => { if (lastLoaded.current && document.visibilityState !== "hidden" && Date.now() - lastLoaded.current > 60000) void load(controller.signal, true); };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh); document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 45 * 60 * 1000);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  const activeIds = jobs.filter((job) => isActive(job.status)).map((job) => job.id).join(",");
  useEffect(() => {
    if (!activeIds) { setPollError(""); return; }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let retries = 0;
    const poll = async () => {
      if (document.visibilityState === "hidden") { timer = setTimeout(poll, 5000); return; }
      try {
        const results = await Promise.all(activeIds.split(",").map(async (id) => {
          const response = await fetch(`/api/generations/${id}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Couldn't check your video yet.");
          return data.generation as Generation;
        }));
        if (controller.signal.aborted) return;
        setJobs((current) => current.map((job) => results.find((item) => item.id === job.id) || job));
        retries = 0;
        setPollError("");
      } catch (reason) {
        if (controller.signal.aborted) return;
        retries++;
        setPollError(reason instanceof Error ? reason.message : "Connection interrupted. We'll keep checking your video.");
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, Math.min(5000 * 2 ** retries, 30000));
    };
    timer = setTimeout(poll, 1200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [activeIds]);

  const generate = async (input: Omit<GenerationInput, "requestId">) => {
    if (submitLock.current) return false;
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    const signature = JSON.stringify(input);
    if (pendingRequest.current?.signature !== signature) pendingRequest.current = { signature, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/generations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, requestId: pendingRequest.current.id }),
        signal: AbortSignal.timeout(65000),
      });
      const data = await response.json();
      if (data.generation) { loadVersion.current++; setLoading(false); setJobs((current) => [data.generation, ...current.filter((job) => job.id !== data.generation.id)]); }
      if (data.generation?.status === "failed") {
        pendingRequest.current = null;
        throw new Error(data.generation.error || "This render failed. Edit the prompt and try again.");
      }
      if (!response.ok) {
        if (data.generation) pendingRequest.current = null;
        throw new Error(data.error || "Couldn't submit your video.");
      }
      pendingRequest.current = null;
      if (data.usage) setUsage((current) => ({ ...current, ...data.usage }));
      else void load(undefined, true);
      return true;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Couldn't reach the studio. Check your library before trying again.";
      // Reload in case the server accepted a request but its response was lost.
      await load();
      setError(message);
      return false;
    } finally { submitLock.current = false; setSubmitting(false); }
  };

  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/generations/${id}`, { method: "DELETE", signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't delete this video.");
      loadVersion.current++;
      setLoading(false);
      setJobs((current) => current.filter((job) => job.id !== id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't delete this video."); }
  };
  return { jobs, configured, storageConfigured, capabilities, usage, loading, submitting, error, pollError, generate, remove, reload: load, clearError: () => setError("") };
}
