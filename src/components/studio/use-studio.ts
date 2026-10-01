"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Generation, GenerationInput, isActive } from "@/lib/video/types";

export function useStudio() {
  const [jobs, setJobs] = useState<Generation[]>([]);
  const [configured, setConfigured] = useState(false);
  const [storageConfigured, setStorageConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const submitLock = useRef(false);
  const pendingRequest = useRef<{ signature: string; id: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/generations", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't load your studio.");
      if (signal?.aborted) return;
      setJobs(data.generations);
      setConfigured(data.configured);
      setStorageConfigured(data.storageConfigured !== false);
      setError("");
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "Couldn't load your studio.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
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
          const response = await fetch(`/api/generations/${id}`, { cache: "no-store", signal: controller.signal });
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
      });
      const data = await response.json();
      if (data.generation) setJobs((current) => [data.generation, ...current.filter((job) => job.id !== data.generation.id)]);
      if (data.generation?.status === "failed") {
        pendingRequest.current = null;
        throw new Error(data.generation.error || "This render failed. Edit the prompt and try again.");
      }
      if (!response.ok) {
        if (data.generation) pendingRequest.current = null;
        throw new Error(data.error || "Couldn't submit your video.");
      }
      pendingRequest.current = null;
      return true;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Couldn't reach the studio. Check your library before trying again.";
      // Reload in case the server accepted a request but its response was lost.
      await load();
      setError(message);
      return false;
    } finally { submitLock.current = false; setSubmitting(false); }
  };

  return { jobs, configured, storageConfigured, loading, submitting, error, pollError, generate, reload: load, clearError: () => setError("") };
}
