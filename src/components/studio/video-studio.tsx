"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Aperture, ArrowDownToLine, ArrowUpRight, AudioLines, Check, ChevronDown,
  CircleAlert, CircleHelp, Clapperboard, Clock3, Film, FolderOpen, Grid2X2,
  ImagePlus, Library, Menu, Play, Plus, RectangleHorizontal, RefreshCw,
  Search, Settings2, Sparkles, Square, WandSparkles, X, ArrowRight, Bookmark, Camera, ChevronRight, Trash2, LogIn,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ArrowUp, ArrowDown, Upload, Copy,
} from "lucide-react";
import { Generation, isActive, MAX_REFERENCE_BYTES, VIDEO_MODEL } from "@/lib/video/types";
import { useStudio } from "./use-studio";
import { AccountDialog } from "./account-dialog";
import { ProjectLibrary } from "./project-library";
import { cameraDirections, visualStyles, compileScene, sceneAdvice } from "@/lib/video/direction";
import { editableDraft, savedScene, storyboardFile, SavedScene } from "@/lib/video/drafts";

const looks = [
  { title: "After hours in Kyoto", image: "photo-1493976040374-85c8e12f0c0e", tag: "CINEMATIC", prompt: "A slow cinematic tracking shot through a quiet Kyoto street at blue hour. Warm lanterns glow along the wooden facades, a gentle breeze moves the curtains, soft film grain, anamorphic lens." },
  { title: "The perfect pour", image: "photo-1510812431401-41d2bd2722f3", tag: "PRODUCT", prompt: "A close-up product film of red wine pouring slowly into a crystal glass, rich reflections on a dark tabletop, warm studio lighting, shallow depth of field, slow motion." },
  { title: "Desert, at first light", image: "photo-1509316785289-025f5b846b35", tag: "NATURE", prompt: "A sweeping drone shot over sculpted desert dunes at sunrise. Long shadows reveal fine textures in the sand, warm golden light, a calm cinematic atmosphere, photorealistic." },
  { title: "Electric blue", image: "photo-1534528741775-53994a69daeb", tag: "PORTRAIT", prompt: "A cinematic fashion portrait in blue studio light. The subject gently turns toward the camera, a soft breeze moves their hair, dramatic rim lighting, editorial mood." },
];
const suggestions = ["A perfume ad in golden hour", "A quiet moment in Tokyo", "A sneaker landing in water"];
type LookCategory = "ALL" | "CINEMATIC" | "PRODUCT" | "NATURE" | "PORTRAIT";
type NavPage = "Create" | "Explore" | "My videos" | "Assets" | "Storyboard";
type Reference = { name: string; data: string; width: number; height: number; assetId?: string };
type Asset = { id: string; name: string; width: number; height: number; url: string };
type Scene = SavedScene;
const cameras = cameraDirections;

function sequenceTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Thumbnail({ image, title }: { image: string; title: string }) {
  return <div role="img" aria-label={title} className="thumb" style={{ backgroundImage: `linear-gradient(180deg, transparent 40%, rgba(8,8,11,.35)), url(https://images.unsplash.com/${image}?auto=format&fit=crop&w=1000&q=85)` }} />;
}

function RenderProgress({ job }: { job: Generation }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const elapsed = Math.max(0, Math.floor((now - Date.parse(job.createdAt)) / 1000));
  const stage = job.status === "submitting" ? 0 : job.status === "queued" ? 1 : 2;
  return <section className="render-progress" aria-label="Current render"><div className="render-progress-heading"><span><span className="spinner" />{["Confirming your scene", "Waiting for the GPU", "Creating your video"][stage]}</span><time>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} elapsed</time></div><ol>{["Submitted", "In queue", "Rendering", "Saved to library"].map((label, index) => <li key={label} className={index < stage ? "stage-complete" : index === stage ? "stage-current" : ""} aria-current={index === stage ? "step" : undefined}><span>{index < stage ? <Check size={11} /> : index + 1}</span>{label}</li>)}</ol><p>{job.error || "Your render stays in your account while you plan the next shot. Shared GPU queues can take a few minutes."}</p></section>;
}

function VideoPreview({ job, close, download }: { job: Generation; close: () => void; download: (job: Generation) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={dialogRef} className="preview-dialog" onCancel={close} aria-labelledby="preview-title">
      <div className="preview-heading"><h2 id="preview-title">Your video</h2><button className="icon-button" onClick={close} aria-label="Close preview"><X size={19} /></button></div>
      <video src={job.videoUrl!} controls autoPlay playsInline className="preview-video" />
      <p className="preview-prompt">{job.prompt}</p>
      <div className="preview-details"><span>{job.model} · {job.duration}s · {job.aspectRatio}</span><button className="generate-button" onClick={() => download(job)}><ArrowDownToLine size={15} /> Download MP4</button></div>
    </dialog>
  );
}

export function VideoStudio() {
  const studio = useStudio();
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"text" | "reference">("text");
  const [ratio, setRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [audio, setAudio] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("blur, distort, and low quality");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reference, setReference] = useState<Reference | null>(null);
  const [readingReference, setReadingReference] = useState(false);
  const [notice, setNotice] = useState("");
  const [fileError, setFileError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [navSide, setNavSide] = useState<"left" | "right">("left");
  const [navReady, setNavReady] = useState(false);
  const [activeNav, setActiveNav] = useState<NavPage>("Create");
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<Generation | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeLook, setActiveLook] = useState(0);
  const [lookCategory, setLookCategory] = useState<LookCategory>("ALL");
  const [camera, setCamera] = useState(0);
  const [style, setStyle] = useState(0);
  const [draftStatus, setDraftStatus] = useState("Loading draft");
  const boardFileRef = useRef<HTMLInputElement>(null);
  const [seed, setSeed] = useState(42);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [deletePending, setDeletePending] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const busy = studio.submitting || studio.jobs.some((job) => isActive(job.status));
  const readyPrompt = !studio.loading && !busy && !readingReference && prompt.trim().length >= 3 && (mode === "text" || Boolean(reference));
  const shotPrompt = compileScene(prompt, cameras[camera].id, visualStyles[style].id);
  const advice = sceneAdvice(prompt);
  const canGenerate = studio.configured && studio.capabilities.signedIn && readyPrompt && studio.usage.used < studio.usage.limit && (studio.usage.globalRemaining === null || studio.usage.globalRemaining > 0) && shotPrompt.length <= 2500;
  const filteredJobs = studio.jobs.filter((job) => job.prompt.toLowerCase().includes(search.toLowerCase()));
  const latestVideo = studio.jobs.find((job) => job.status === "completed" && job.videoUrl);
  const currentJob = studio.jobs.find((job) => isActive(job.status));
  const shotTimings: number[] = [];
  let plannedDuration = 0;
  for (const scene of scenes) {
    shotTimings.push(plannedDuration);
    plannedDuration += scene.duration;
  }

  useEffect(() => {
    try {
      const preferences = JSON.parse(localStorage.getItem("yetsyai-navigation-v1") || "null");
      if (typeof preferences?.collapsed === "boolean") setNavCollapsed(preferences.collapsed);
      if (preferences?.side === "left" || preferences?.side === "right") setNavSide(preferences.side);
    } catch { /* Navigation works even when browser storage is unavailable. */ }
    setNavReady(true);
    const viewport = window.matchMedia("(max-width: 620px)");
    const resize = () => { if (!viewport.matches) setMobileMenu(false); };
    viewport.addEventListener("change", resize);
    return () => viewport.removeEventListener("change", resize);
  }, []);

  useEffect(() => {
    if (!navReady) return;
    try { localStorage.setItem("yetsyai-navigation-v1", JSON.stringify({ collapsed: navCollapsed, side: navSide })); } catch { /* Optional preference persistence. */ }
  }, [navReady, navCollapsed, navSide]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const viewport = window.matchMedia("(max-width: 620px)");
    const update = () => { if (sidebar) sidebar.inert = viewport.matches && !mobileMenu; };
    update();
    viewport.addEventListener("change", update);
    return () => { viewport.removeEventListener("change", update); if (sidebar) sidebar.inert = false; };
  }, [mobileMenu]);

  useEffect(() => {
    if (!mobileMenu) return;
    const sidebar = sidebarRef.current;
    const content = mainRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (content) content.inert = true;
    sidebar?.querySelector<HTMLButtonElement>(".sidebar-mobile-close")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMobileMenu(false); return; }
      if (event.key !== "Tab" || !sidebar) return;
      const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']")).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = overflow;
      if (content) content.inert = false;
      document.removeEventListener("keydown", keyboard);
      menuRef.current?.focus({ preventScroll: true });
    };
  }, [mobileMenu]);

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem("yetsyai-draft-v1") || "null");
      const parsed = editableDraft.safeParse(draft);
      if (parsed.success) { const d = parsed.data; setPrompt(d.prompt); setRatio(d.ratio); setSeed(d.seed); setDuration(d.duration); setAudio(d.generateAudio); setNegativePrompt(d.negativePrompt); setCamera(cameras.findIndex((item) => item.id === d.camera)); setStyle(visualStyles.findIndex((item) => item.id === d.style)); }
      const board = JSON.parse(localStorage.getItem("yetsyai-board-v1") || "[]");
      if (Array.isArray(board)) setScenes(board.slice(0, 12).flatMap((item) => { const parsed = savedScene.safeParse(item); return parsed.success ? [parsed.data] : []; }));
    } catch { /* A disabled browser store should not prevent creation. */ }
    setDraftReady(true);
    if (new URLSearchParams(window.location.search).get("account") === "expired") setNotice("This account link has expired. Request a new confirmation or reset email.");
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    setDraftStatus("Saving draft…");
    const timer = setTimeout(() => {
      try { localStorage.setItem("yetsyai-draft-v1", JSON.stringify({ prompt, ratio, seed, camera: cameras[camera].id, style: visualStyles[style].id, duration, generateAudio: audio, negativePrompt })); localStorage.setItem("yetsyai-board-v1", JSON.stringify(scenes)); setDraftStatus("Draft saved on this device"); }
      catch { setDraftStatus("Storage unavailable · export your storyboard"); }
    }, 400);
    return () => clearTimeout(timer);
  }, [prompt, ratio, seed, camera, style, duration, audio, negativePrompt, scenes, draftReady]);
  useEffect(() => {
    setAssets([]);
    if (!studio.capabilities.signedIn) { setReference(null); setSelectedJob(null); return; }
    const controller = new AbortController();
    fetch("/api/assets", { signal: controller.signal }).then(async (response) => { if (response.ok) setAssets((await response.json()).assets); }).catch(() => {});
    return () => controller.abort();
  }, [studio.capabilities.signedIn]);
  useEffect(() => { if (studio.loading) return; if (!studio.capabilities.audio) setAudio(false); if (!studio.capabilities.durations.includes(duration)) setDuration(5); }, [studio.capabilities, duration, studio.loading]);
  useEffect(() => { setSelectedJob((current) => current ? studio.jobs.find((job) => job.id === current.id) || null : null); }, [studio.jobs]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const applyLook = (index: number) => {
    const look = looks[index];
    setPrompt(look.prompt); setActiveLook(index); setMode("text");
    setStyle(look.tag === "PRODUCT" ? 2 : look.tag === "CINEMATIC" || look.tag === "PORTRAIT" ? 1 : 0);
    setCamera(0); go("Create");
    setTimeout(() => document.getElementById("video-prompt")?.focus(), 50);
  };
  const go = (page: NavPage) => { setActiveNav(page); setMobileMenu(false); setSearch(""); };
  const openAccount = () => { setMobileMenu(false); setAccountOpen(true); };
  const openScene = (scene: Scene) => {
    setPrompt(scene.prompt); setRatio(scene.ratio); setSeed(scene.seed); setMode("text");
    setCamera(cameras.findIndex((item) => item.id === scene.camera)); setStyle(visualStyles.findIndex((item) => item.id === scene.style));
    setDuration(studio.capabilities.durations.includes(scene.duration) ? scene.duration : 5);
    setAudio(studio.capabilities.audio && scene.generateAudio); setNegativePrompt(scene.negativePrompt);
    go("Create");
  };
  const reuseScene = (job: Generation) => {
    openScene(savedScene.parse({ id: job.id, prompt: job.prompt, ratio: ["16:9", "9:16", "1:1"].includes(job.aspectRatio) ? job.aspectRatio : "16:9", seed: job.seed, duration: job.duration, ...job.settings }));
    if (job.aspectRatio === "Reference image") setNotice("Prompt restored. Choose the original reference again to reproduce this image clip.");
  };
  const moveScene = (index: number, direction: number) => {
    setScenes((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
    });
  };
  const duplicateScene = (id: string) => {
    if (scenes.length >= 12) { setNotice("Your storyboard holds 12 scenes. Remove one to make room."); return; }
    const copyId = crypto.randomUUID();
    setScenes((current) => {
      if (current.length >= 12) return current;
      const index = current.findIndex((scene) => scene.id === id);
      if (index < 0) return current;
      const source = current[index];
      const copy = { ...source, id: copyId, title: source.title ? `${source.title.slice(0, 73)} (copy)` : "" };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
    setNotice("Shot duplicated with its prompt and all settings.");
  };
  const exportBoard = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, scenes }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "yetsyai-storyboard.json"; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("Storyboard exported with all shot settings.");
  };
  const importBoard = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 128 * 1024) { setNotice("Choose a storyboard JSON file smaller than 128 KB."); return; }
    try {
      const parsed = storyboardFile.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error("Choose a valid Yetsyai storyboard with up to 12 scenes.");
      const ids = new Set(scenes.map((scene) => scene.id));
      const imported = parsed.data.scenes.filter((scene) => { if (ids.has(scene.id)) return false; ids.add(scene.id); return true; });
      if (scenes.length + imported.length > 12) { setNotice("Your combined storyboard exceeds 12 scenes. Remove a scene before importing."); return; }
      setScenes((current) => [...current, ...imported]); setNotice(`${imported.length} scenes added to your storyboard.`);
    } catch (error) { setNotice(error instanceof SyntaxError ? "This file is not valid storyboard JSON." : error instanceof Error ? error.message : "Couldn't import this storyboard."); }
  };
  const generate = async () => {
    if (!canGenerate) return;
    const submitted = await studio.generate({
      prompt: prompt.trim(), camera: cameras[camera].id, style: visualStyles[style].id, aspectRatio: ratio, duration, generateAudio: audio, seed,
      negativePrompt, ...(mode === "reference" && reference ? reference.assetId ? { assetId: reference.assetId } : { referenceImage: reference.data } : {}),
    });
    if (submitted) setNotice("Your scene is in the render queue. Your draft is kept for the next take.");
  };

  const chooseReference = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileError("");
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > MAX_REFERENCE_BYTES) {
      setFileError("Choose a JPG or PNG under 3 MB."); return;
    }
    const version = ++readVersion.current;
    setReadingReference(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Couldn't read this image. Try another file."));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("This image couldn't be opened. Choose a valid JPG or PNG."));
        img.src = data;
      });
      if (image.width < 300 || image.height < 300 || image.width / image.height > 2.5 || image.height / image.width > 2.5) {
        throw new Error("Use an image at least 300 × 300 px, with an aspect ratio between 2:5 and 5:2.");
      }
      if (version !== readVersion.current) return;
      setReference({ name: file.name, data, width: image.width, height: image.height });
      setMode("reference");
    } catch (error) { if (version === readVersion.current) setFileError(error instanceof Error ? error.message : "Couldn't load your image."); }
    finally { if (version === readVersion.current) setReadingReference(false); }
  };

  const removeReference = () => { readVersion.current++; setReadingReference(false); setReference(null); setMode("text"); setFileError(""); };
  const saveScene = () => {
    if (prompt.trim().length < 3) { setNotice("Describe your scene first."); return; }
    if (mode === "reference") { setNotice("Storyboard saves text shots. Save the image in Assets for your reference clip."); return; }
    if (scenes.length >= 12) { setNotice("Your storyboard holds 12 scenes. Remove one to make room."); return; }
    setScenes((current) => [...current, { id: crypto.randomUUID(), title: "", prompt: prompt.trim(), ratio, seed, camera: cameras[camera].id, style: visualStyles[style].id, duration, generateAudio: audio, negativePrompt }]);
    setNotice("Scene saved to your storyboard on this device.");
  };
  const saveReference = async () => {
    if (!reference || savingAsset) return;
    if (!studio.capabilities.signedIn) { setAccountOpen(true); return; }
    setSavingAsset(true);
    try {
      const response = await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: reference.name, data: reference.data }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setAssets((current) => [data.asset, ...current]); setReference((current) => current ? { ...current, assetId: data.asset.id } : current); setNotice("Reference saved to your account.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Couldn't save this reference."); }
    finally { setSavingAsset(false); }
  };
  const deleteAsset = async (id: string) => {
    try {
      const response = await fetch("/api/assets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setAssets((current) => current.filter((asset) => asset.id !== id)); if (reference?.assetId === id) removeReference();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Couldn't remove this reference."); }
  };
  const download = async (job: Generation) => {
    if (downloading) return;
    setDownloading(job.id);
    try {
      const response = await fetch(`/api/generations/${job.id}/download`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Couldn't download this video.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `yetsyai-${job.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice("Your video has been downloaded.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Couldn't download this video."); }
    finally { setDownloading(null); }
  };

  const nav = [
    { label: "Create" as const, icon: <Sparkles size={17} /> },
    { label: "Explore" as const, icon: <Grid2X2 size={17} /> },
    { label: "My videos" as const, icon: <Film size={17} /> },
    { label: "Assets" as const, icon: <FolderOpen size={17} /> },
    { label: "Storyboard" as const, icon: <Clapperboard size={17} /> },
  ];

  const jobCards = (jobs: Generation[]) => (
    <div className="creation-grid jobs-grid">
      {jobs.map((job) => (
        <article className="creation-card job-card" key={job.id}>
          <button className={`creation-image job-image job-${job.status}`} disabled={job.status !== "completed"} onClick={() => setSelectedJob(job)} aria-label={job.status === "completed" ? `Play ${job.prompt}` : `${job.status}: ${job.prompt}`}>
            {job.videoUrl ? <video src={job.videoUrl} muted playsInline preload="metadata" className="job-thumbnail" /> : <div className="job-placeholder">{isActive(job.status) ? <><span className="spinner" /><span>{job.status === "submitting" ? "Submitting your scene" : job.status === "queued" ? "Waiting in queue" : "Creating your video"}</span><small>This may take a few minutes</small></> : <><CircleAlert size={22} /><span>Render failed</span></>}</div>}
            <span className={`creation-tag status-${job.status}`}>{job.status.toUpperCase()}</span>
            {job.videoUrl && <span className="play-button"><Play size={15} fill="currentColor" /></span>}
            <span className="image-duration">{job.duration}s</span>
          </button>
          <div className="creation-info"><div><h3 title={job.prompt}>{job.prompt}</h3><p>{job.model} · {job.aspectRatio}</p></div>{job.videoUrl && <button className="card-more" disabled={Boolean(downloading)} aria-label="Download video" onClick={() => download(job)}>{downloading === job.id ? <span className="spinner" /> : <ArrowDownToLine size={17} />}</button>}</div>
          {job.error && <p className="job-error">{job.error}<button onClick={() => reuseScene(job)}>Edit prompt</button></p>}
          {!isActive(job.status) && <div className="job-actions">{deletePending === job.id ? <><button onClick={() => setDeletePending(null)}>Keep video</button><button className="delete-confirm" onClick={() => { void studio.remove(job.id); setDeletePending(null); }}><Trash2 size={12} /> Delete permanently</button></> : <><button onClick={() => reuseScene(job)}><RefreshCw size={12} /> Reuse scene</button><button onClick={() => setDeletePending(job.id)} aria-label={`Delete video: ${job.prompt}`}><Trash2 size={13} /></button></>}</div>}
        </article>
      ))}
    </div>
  );

  return (
    <main className={`studio-shell nav-${navSide} ${navCollapsed ? "nav-collapsed" : ""}`} id="home">
      {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" tabIndex={-1} onClick={() => setMobileMenu(false)} />}
      <aside ref={sidebarRef} id="studio-navigation" className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`} role={mobileMenu ? "dialog" : undefined} aria-modal={mobileMenu ? true : undefined} aria-label="Studio navigation">
        <div className="sidebar-heading"><a href="#home" className="brand" aria-label="Yetsyai home" onClick={() => go("Create")}><span className="brand-mark"><Aperture size={21} strokeWidth={2.2} /></span><span className="brand-wordmark">yetsyai<span className="brand-period">.</span></span><span className="brand-beta">BETA</span></a><button className="icon-button sidebar-mobile-close" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={19} /></button></div>
        <div className="sidebar-controls"><button className="sidebar-collapse" onClick={() => setNavCollapsed((value) => !value)} aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!navCollapsed} title={navCollapsed ? "Expand navigation" : "Collapse navigation"}>{navSide === "left" ? navCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} /> : navCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}<span>Collapse</span></button><button className="sidebar-position" onClick={() => setNavSide((value) => value === "left" ? "right" : "left")} aria-label={`Move navigation to the ${navSide === "left" ? "right" : "left"}`} title={`Move navigation to the ${navSide === "left" ? "right" : "left"}`}>{navSide === "left" ? <PanelRightOpen size={17} /> : <PanelLeftOpen size={17} />}</button></div>
        <div className="workspace-switch"><span className="workspace-avatar">Y</span><span className="workspace-copy"><strong>Your studio</strong><small>Personal workspace</small></span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map((item) => <button key={item.label} onClick={() => go(item.label)} className={`nav-item ${activeNav === item.label ? "nav-active" : ""}`} aria-label={item.label} title={item.label} aria-current={activeNav === item.label ? "page" : undefined}>{item.icon}<span>{item.label}</span>{item.label === "My videos" && <span className="nav-count">{studio.jobs.length}</span>}</button>)}
        </nav>
        <div className="sidebar-note"><span className="eyebrow">SMALL IDEAS. BIG FRAMES.</span><p>Your next great shot starts with a sentence.</p><button onClick={() => { go("Create"); applyLook(0); }}>Start a scene <ArrowUpRight size={14} /></button></div>
        <div className="sidebar-bottom">
          <div className="credit-card"><div className="credit-heading"><span>{studio.capabilities.provider === "fal" ? "Studio allowance" : "Free studio"}</span><span>{studio.configured ? `${Math.max(0, studio.usage.limit - studio.usage.used)} / ${studio.usage.limit} left` : "Preview"}</span></div><div className="credit-meter"><i style={{ width: `${Math.max(0, 100 - studio.usage.used / studio.usage.limit * 100)}%` }} /></div><p className="workspace-note">Short clips. Shared GPU. A little patience, a lot of possibility.{studio.configured && studio.usage.globalRemaining !== null && <small className="shared-quota">{studio.usage.globalRemaining} shared submissions left today · studio limits reset at 00:00 UTC</small>}</p><button onClick={() => void studio.reload()} className="upgrade-button"><RefreshCw size={13} /> Check availability</button></div>
          <button className="bottom-link" aria-label="A quick studio tour" title="A quick studio tour" onClick={() => setNotice("Describe one scene, pick a camera move and generate. Account videos are saved across devices. Free GPU capacity is shared and limited.")}><CircleHelp size={16} /><span>A quick studio tour</span></button>
          <button className="profile-row" aria-label={studio.capabilities.signedIn ? "Manage account" : "Sign in"} title={studio.capabilities.signedIn ? "Manage account" : "Sign in"} onClick={openAccount}><span className="profile-avatar">Y</span><span><strong>{studio.capabilities.signedIn ? "Your account" : "Make this space yours"}</strong><small>{studio.capabilities.signedIn ? "Manage account" : "Sign in to save your videos"}</small></span><ChevronRight size={16} /></button>
        </div>
      </aside>

      <section ref={mainRef} className="studio-main">
        <header className="topbar">
          <button ref={menuRef} className="mobile-menu-button icon-button" onClick={() => setMobileMenu(true)} aria-label="Open navigation" aria-expanded={mobileMenu} aria-controls="studio-navigation"><Menu size={19} /></button>
          <button className="desktop-menu-button icon-button" onClick={() => setNavCollapsed((value) => !value)} aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!navCollapsed} aria-controls="studio-navigation">{navSide === "left" ? <PanelLeftOpen size={18} /> : <PanelRightOpen size={18} />}</button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="top-actions"><span className={`top-credit ${studio.configured ? "provider-connected" : "provider-offline"}`}><span className="credit-dot" />{studio.loading ? "Connecting…" : studio.configured ? "Studio online" : "Preview access"}</span><button className="icon-button" aria-label="Search your videos" onClick={() => { go("My videos"); setTimeout(() => searchRef.current?.focus(), 0); }}><Search size={18} /></button><button className="account-trigger" onClick={() => setAccountOpen(true)}>{studio.capabilities.signedIn ? <span className="top-avatar">Y</span> : <><LogIn size={14} /> Sign in</>}</button></div>
        </header>

        <div className="content-wrap">
          {activeNav === "Create" ? <section className="studio-showcase" aria-labelledby="studio-title">
            <div className="cinema-hero">
              <div className="hero-photo" style={{ backgroundImage: `url(https://images.unsplash.com/${looks[0].image}?auto=format&fit=crop&w=1600&q=90)` }} />
              <div className="hero-grain" />
              <div className="hero-content"><div className="eyebrow"><span className="live-spark" />YOUR INDEPENDENT FILM STUDIO</div><h1 id="studio-title">Small idea.<br /><em>Big scene.</em></h1><p>A place to find your look, direct the shot and bring your next idea into motion.</p><button onClick={() => document.getElementById("video-prompt")?.focus()}>Start creating <ArrowUpRight size={17} /></button></div>
              <div className="hero-caption"><span>YETSYAI / CREATIVE STUDIO</span><span>PHOTO INSPIRATION <Aperture size={13} /></span></div>
            </div>
            <button className="showcase-feature" onClick={() => applyLook(2)} aria-label="Use Desert, at first light prompt">
              <Thumbnail image={looks[2].image} title="Desert dunes photo inspiration" />
              <span className="feature-topline"><span>THE LOCATION EDIT</span><ArrowUpRight size={19} /></span>
              <span className="feature-bottom"><span className="feature-kicker">01 / NATURAL LIGHT</span><strong>Chase the<br />first light.</strong><span>Make this look yours <ArrowRight size={15} /></span></span>
            </button>
          </section> : <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR CREATIVE STUDIO</div><h1>{activeNav === "Explore" ? <>Find your next <span>frame.</span></> : activeNav === "Assets" ? <>Every great scene<br />starts <span>somewhere.</span></> : activeNav === "Storyboard" ? <>One idea.<br /><span>A whole story.</span></> : <>Your ideas,<br /><span>in motion.</span></>}</h1><p>{activeNav === "Explore" ? "A collection of looks to make your own." : activeNav === "Assets" ? "Your references, ready for the next shot." : activeNav === "Storyboard" ? "Plan your sequence. Keep your scenes together. Saved on this device." : "Your scenes, all in one place."}</p></div><button className="library-button" onClick={() => go("Create")}><Plus size={16} /> New scene</button></section>}

          {studio.error && <div className="studio-message message-error" role="alert"><CircleAlert size={17} /><div>{studio.error}</div><button onClick={() => void studio.reload()}>Retry</button></div>}
          {currentJob && activeNav === "Create" && <RenderProgress job={currentJob} />}
          {studio.pollError && <div className="studio-message" role="status"><RefreshCw size={17} /><div>{studio.pollError} We&apos;ll keep checking.</div></div>}
          {!studio.loading && !studio.configured && !studio.error && activeNav === "Create" && <div className="studio-message setup-message"><Sparkles size={18} /><div><strong>Make a start. Keep your ideas.</strong><p>Rendering is opening soon. Explore a look, direct your shots and save a storyboard today.</p></div><span className="preview-chip">PREVIEW</span></div>}

          {activeNav === "Create" && <div className="studio-launchers" aria-label="Creative shortcuts">
            <button onClick={() => document.getElementById("video-prompt")?.focus()}><span className="launcher-icon"><Film size={19} /></span><span><strong>Direct a shot</strong><small>Start with your own scene</small></span><ArrowUpRight size={16} /></button>
            <button onClick={() => go("Explore")}><span className="launcher-icon"><Grid2X2 size={19} /></span><span><strong>Find your look</strong><small>A little inspiration goes a long way</small></span><ArrowUpRight size={16} /></button>
            <button onClick={() => go("Storyboard")}><span className="launcher-icon"><Clapperboard size={19} /></span><span><strong>Build a story</strong><small>{scenes.length ? `${scenes.length} shots in your sequence` : "Give every shot a place"}</small></span><ArrowUpRight size={16} /></button>
          </div>}

          {activeNav === "Create" && <><div className="section-heading composer-heading"><div><div className="eyebrow">THE DIRECTOR&apos;S DESK</div><h2>Let&apos;s set the scene.</h2></div><span className="draft-status"><span /> {draftStatus}</span></div><div className="director-layout"><section className="creator-card" aria-label="Create a video">
            <div className="creator-top"><div className="mode-tabs"><button className={mode === "text" ? "mode-selected" : ""} onClick={() => setMode("text")} aria-pressed={mode === "text"}><Film size={16} /> Text to video</button><button disabled={!studio.capabilities.image} title={studio.capabilities.image ? "Animate your image" : "The free model currently supports text prompts"} className={mode === "reference" ? "mode-selected" : ""} onClick={() => setMode("reference")} aria-pressed={mode === "reference"}><ImagePlus size={16} /> Image to video{!studio.capabilities.image && <span className="soon">SOON</span>}</button></div><button className="prompt-helper" aria-label="Try a random scene" onClick={() => { const index = Math.floor(Math.random() * looks.length); applyLook(index); }}><WandSparkles size={16} /></button></div>
            <label className="prompt-label" htmlFor="video-prompt">DESCRIBE YOUR SCENE</label>
            <textarea id="video-prompt" value={prompt} maxLength={2500} onChange={(event) => { setPrompt(event.target.value); studio.clearError(); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void generate(); } }} placeholder={mode === "text" ? "A cinematic shot of... Describe your scene, subject, movement, lighting, and mood" : "Describe how your image should move. Camera direction, lighting, and mood..."} rows={3} />
            <div className="suggestion-row"><span>TRY</span>{suggestions.map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
            {mode === "reference" && <div className="reference-area">{reference ? <><div className="reference-thumb" role="img" aria-label={reference.name} style={{ backgroundImage: `url(${reference.data})` }} /><div><strong>{reference.name}</strong><small>{reference.width} × {reference.height} · Video follows this image&apos;s aspect ratio</small></div><button className="icon-button" onClick={removeReference} aria-label="Remove reference"><X size={15} /></button></> : <button className="reference-upload" disabled={readingReference} onClick={() => fileRef.current?.click()}><ImagePlus size={20} /><span>{readingReference ? "Reading image…" : "Choose a starting image"}<small>JPG or PNG · Up to 3 MB · At least 300 × 300 px</small></span></button>}</div>}
            {fileError && <p className="inline-error" role="alert">{fileError}</p>}
            <div className="camera-heading"><span className="prompt-label">CAMERA MOVEMENT</span><span>One move per shot</span></div><div className="camera-presets">{cameras.map((item, index) => <button key={item.name} onClick={() => setCamera(index)} className={camera === index ? "camera-selected" : ""} aria-pressed={camera === index}><Camera size={15} />{item.name}</button>)}</div>
            <div className="camera-heading"><span className="prompt-label">VISUAL TREATMENT</span><span>Set your signature</span></div>
            <div className="style-presets">{visualStyles.map((item, index) => <button key={item.id} className={style === index ? "style-selected" : ""} aria-pressed={style === index} onClick={() => setStyle(index)}><span className={`style-swatch swatch-${item.id}`} />{item.name}</button>)}</div>
            <details className="shot-brief"><summary><WandSparkles size={14} /> Review your shot brief <ChevronDown size={14} /></summary><p>{shotPrompt || "Your scene, camera move and visual treatment will appear here."}</p><small>These are the exact directions sent to the video model. Presets guide the result; they cannot guarantee it.</small></details>
            {shotPrompt.length > 2500 && <p className="inline-error" role="alert">Shorten your scene: camera and style directions bring the total above 2500 characters.</p>}
            <div className="creator-divider" />
            <div className="control-row">
              <div className="control-select"><span className="model-glyph"><Sparkles size={14} /></span><div><span className="control-caption">GENERATION MODEL</span><strong>{studio.capabilities.model || VIDEO_MODEL}</strong></div><span className="model-pill">{studio.capabilities.provider === "fal" ? "CONNECTED" : "OPEN"}</span></div>
              <div className="control-separator" />
              <div className="ratio-control"><span className="control-caption">{mode === "reference" ? "IMAGE RATIO" : "ASPECT RATIO"}</span><div className="ratio-buttons">{(["16:9", "9:16", "1:1"] as const).map((value) => <button key={value} disabled={mode === "reference"} onClick={() => setRatio(value)} className={ratio === value && mode === "text" ? "ratio-active" : ""} aria-pressed={ratio === value && mode === "text"}>{value === "1:1" ? <Square size={13} /> : <RectangleHorizontal size={15} className={value === "9:16" ? "ratio-vertical" : ""} />}{value}</button>)}</div></div>
              <label className="duration-select"><Clock3 size={15} /><span className="control-caption">DURATION</span><select aria-label="Video duration" value={duration} onChange={(event) => setDuration(Number(event.target.value) as 5 | 10)}>{studio.capabilities.durations.map((value) => <option key={value} value={value}>{value} sec</option>)}</select><ChevronDown size={14} /></label>
              <button className="settings-button" aria-label="Generation settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={17} /></button>
              <button className="generate-button main-generate" disabled={studio.capabilities.signedIn ? !canGenerate : !readyPrompt || !studio.capabilities.authConfigured} onClick={() => studio.capabilities.signedIn ? void generate() : setAccountOpen(true)}>{studio.submitting ? <><span className="spinner" /> Submitting scene</> : busy ? <><span className="spinner" /> Creating your scene</> : <><Sparkles size={17} />{!studio.capabilities.signedIn && studio.capabilities.authConfigured ? "Sign in to generate" : !studio.configured ? "Generation opening soon" : studio.usage.globalRemaining === 0 ? "Shared allowance used" : studio.usage.used >= studio.usage.limit ? "Daily allowance used" : "Generate video"}<ArrowRight size={16} /></>}</button>
            </div>
            {settingsOpen && <div className="advanced-settings"><label className="audio-setting"><input type="checkbox" checked={audio} disabled={!studio.capabilities.audio} onChange={(event) => setAudio(event.target.checked)} /><span>Generate audio <small>{studio.capabilities.audio ? "Add sound to your scene" : "The free model creates silent clips"}</small></span></label><label htmlFor="negative-prompt">Avoid in the video</label><input id="negative-prompt" type="text" maxLength={500} value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} /><label htmlFor="render-seed">Seed · reuse to compare variations</label><input id="render-seed" type="number" min={0} max={2147483647} value={seed} onChange={(event) => setSeed(Math.max(0, Math.min(2147483647, Math.floor(Number(event.target.value)))))} /></div>}
            <div className="composer-foot"><button onClick={saveScene}><Bookmark size={14} />Save scene</button><span>{prompt.length}/2500 <kbd>⌘</kbd><kbd>↵</kbd></span></div>
          </section><aside className="scene-monitor"><div className="monitor-heading"><span><span className="monitor-dot" />{currentJob ? "RENDER IN PROGRESS" : latestVideo ? "LATEST TAKE" : "SCENE INSPIRATION"}</span><span>{ratio} <RectangleHorizontal size={13} /></span></div><div className={`monitor-canvas ${ratio === "9:16" ? "monitor-portrait" : ""}`}>{latestVideo && !currentJob ? <video src={latestVideo.videoUrl!} controls muted playsInline preload="metadata" /> : <><Thumbnail image={looks[activeLook].image} title={looks[activeLook].title} /><div className="monitor-shade" />{currentJob ? <div className="monitor-render"><span className="spinner" /><h3>{currentJob.status === "submitting" ? "Holding your place." : currentJob.status === "queued" ? "Your scene is in line." : "A little movie magic."}</h3><p>You can leave this page. We&apos;ll keep your render.</p></div> : <div className="monitor-overlay"><span>VISUAL MOODBOARD</span><h3>{looks[activeLook].title}</h3><p>Photo inspiration · Your generated video appears here.</p></div>}</>}<span className="frame-corner corner-tl" /><span className="frame-corner corner-tr" /><span className="frame-corner corner-bl" /><span className="frame-corner corner-br" /></div><div className="monitor-footer"><span><Film size={14} />{duration}s · {studio.capabilities.audio && audio ? "Sound on" : "Silent clip"}</span><span>TAKE {String(studio.jobs.length + 1).padStart(2, "0")}</span></div><div className="director-tip"><span>DIRECTOR&apos;S NOTES</span>{advice.length ? advice.map((tip) => <p key={tip}>{tip}</p>) : <p>Your scene has a lighting cue. Keep one subject, one action and one camera move for the first take.</p>}</div></aside></div></>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={(event) => void chooseReference(event)} />
          <input ref={boardFileRef} type="file" accept="application/json,.json" hidden aria-label="Import storyboard" onChange={(event) => void importBoard(event)} />

          {(activeNav === "My videos" || (activeNav === "Create" && studio.jobs.length > 0)) && <section className="inspiration-section library-section"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR CREATIONS</div><h2>{activeNav === "My videos" ? "Every scene, saved." : "From idea to motion."}</h2></div>{activeNav === "Create" && <button className="view-all" onClick={() => go("My videos")}>View library <ArrowUpRight size={15} /></button>}</div>{activeNav === "My videos" && <label className="library-search"><Search size={16} /><input ref={searchRef} type="search" placeholder="Search your videos by prompt..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>}{studio.loading ? <div className="empty-state"><span className="spinner" />Loading your library…</div> : filteredJobs.length ? jobCards(activeNav === "Create" ? filteredJobs.slice(0, 4) : filteredJobs) : <div className="empty-state"><Film size={28} /><h3>{search ? "No matching videos" : "Your first scene starts here"}</h3><p>{search ? "Try searching for a different part of your prompt." : "Create a video and it will appear in this workspace."}</p><button className="library-button" onClick={() => go("Create")}><Plus size={15} /> Create a video</button></div>}</section>}

          {(activeNav === "Create" || activeNav === "Explore") && <section className="inspiration-section">
            <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" />THE LOOKBOOK</div><h2>A world of <span>possibility.</span></h2><p className="section-description">Pick a starting point. Give it your point of view.</p></div>{activeNav === "Create" && <button className="view-all" onClick={() => go("Explore")}>Explore all looks <ArrowUpRight size={15} /></button>}</div>
            <div className="look-filters" aria-label="Filter photo looks">{(["ALL", "CINEMATIC", "PRODUCT", "NATURE", "PORTRAIT"] as LookCategory[]).map((category) => <button key={category} className={lookCategory === category ? "filter-selected" : ""} aria-pressed={lookCategory === category} onClick={() => setLookCategory(category)}>{category === "ALL" ? "All looks" : category.charAt(0) + category.slice(1).toLowerCase()}</button>)}<span>PHOTO INSPIRATION</span></div>
            <div className="creation-grid looks-grid">{looks.map((look, index) => ({ look, index })).filter(({ look }) => lookCategory === "ALL" || look.tag === lookCategory).map(({ look, index }) => <article className="creation-card look-card" key={look.title}><button className="creation-image" onClick={() => applyLook(index)} aria-label={`Use prompt: ${look.title}`}><Thumbnail image={look.image} title={look.title} /><span className="creation-tag">{look.tag}</span><span className="look-index">0{index + 1}</span><div className="look-caption"><h3>{look.title}</h3><span>Use this look <ArrowUpRight size={14} /></span></div></button><div className="look-footnote"><span>PHOTO MOODBOARD</span><span>{index % 2 ? "STUDIO LIGHT" : "NATURAL LIGHT"}</span></div></article>)}</div>
          </section>}


          {activeNav === "Assets" && <section className="asset-section">{!studio.capabilities.image && <div className="studio-message"><ImagePlus size={18} /><div>Collect references for your next scene. Image animation will open when a compatible backend is connected.</div></div>}{reference ? <div className="asset-card"><div role="img" aria-label={reference.name} className="asset-image" style={{ backgroundImage: `url(${reference.data})` }} /><h2>{reference.name}</h2><p>{reference.width} × {reference.height} · {reference.assetId ? "Saved to your account" : "Selected on this device"}</p><div>{studio.capabilities.image && <button className="generate-button" onClick={() => { setMode("reference"); go("Create"); }}><Film size={15} /> Animate image</button>}{!reference.assetId && <button className="generate-button" disabled={savingAsset || !studio.capabilities.mediaConfigured} onClick={() => void saveReference()}><Bookmark size={15} />{savingAsset ? "Saving…" : "Save reference"}</button>}<button className="library-button" onClick={removeReference}><X size={15} /> Clear selection</button></div></div> : <div className="empty-state"><ImagePlus size={30} /><h3>Your next starting point.</h3><p>Collect a face, a place or a product. Sign in to save references across devices.</p><button className="generate-button" disabled={readingReference} onClick={() => fileRef.current?.click()}><Plus size={15} />{readingReference ? "Reading…" : "Choose image"}</button>{fileError && <p className="inline-error" role="alert">{fileError}</p>}</div>}{assets.length > 0 && <div className="creation-grid assets-grid">{assets.map((asset) => <article className="creation-card" key={asset.id}><button className="creation-image" onClick={() => setReference({ name: asset.name, data: asset.url, width: asset.width, height: asset.height, assetId: asset.id })}><div className="thumb" role="img" aria-label={asset.name} style={{ backgroundImage: `url(${asset.url})` }} /></button><div className="creation-info"><div><h3>{asset.name}</h3><p>{asset.width} × {asset.height}</p></div><button className="icon-button" onClick={() => void deleteAsset(asset.id)} aria-label={`Remove ${asset.name}`}><Trash2 size={14} /></button></div></article>)}</div>}</section>}

          <ProjectLibrary scenes={scenes} replaceScenes={setScenes} enabled={studio.capabilities.signedIn && studio.capabilities.configuration.database} hidden={activeNav !== "Storyboard"} signIn={() => setAccountOpen(true)} />
          {activeNav === "Storyboard" && <section className="storyboard-section">
            <div className="storyboard-intro">
              <div><span className="eyebrow">{scenes.length} / 12 SCENES</span><p>A plan for your next film. Generate each shot separately when you&apos;re ready.</p></div>
              <div className="board-tools"><button className="library-button" onClick={() => boardFileRef.current?.click()}><Upload size={14} /> Import</button><button className="library-button" disabled={!scenes.length} onClick={exportBoard}><ArrowDownToLine size={14} /> Export</button><button className="library-button" onClick={() => go("Create")}><Plus size={15} /> Write a scene</button></div>
            </div>
            {scenes.length > 0 && <div className="sequence-summary" aria-label="Planned sequence duration"><span><Clock3 size={15} />{sequenceTime(plannedDuration)} planned runtime</span><p>Name your shots and arrange the sequence. This is a shot plan; clips are rendered separately.</p></div>}
            {scenes.length ? <div className="storyboard-grid">{scenes.map((scene, index) => <article className="storyboard-card" key={scene.id}>
              <div className="storyboard-card-heading">
                <span>SCENE {String(index + 1).padStart(2, "0")}</span>
                <div className="scene-order"><button className="icon-button" disabled={index === 0} onClick={() => moveScene(index, -1)} aria-label={`Move scene ${index + 1} up`}><ArrowUp size={13} /></button><button className="icon-button" disabled={index === scenes.length - 1} onClick={() => moveScene(index, 1)} aria-label={`Move scene ${index + 1} down`}><ArrowDown size={13} /></button></div>
                <button className="icon-button" onClick={() => setScenes((current) => current.filter((item) => item.id !== scene.id))} aria-label={`Remove scene ${index + 1}`}><Trash2 size={14} /></button>
              </div>
              <label className="shot-name"><span>SHOT NAME</span><input type="text" maxLength={80} value={scene.title} placeholder={`Scene ${String(index + 1).padStart(2, "0")}`} aria-label={`Name scene ${index + 1}`} onChange={(event) => { const title = event.target.value; setScenes((current) => current.map((item) => item.id === scene.id ? { ...item, title } : item)); }} /></label>
              <div className="shot-timing"><Clock3 size={12} /><span>{sequenceTime(shotTimings[index])} – {sequenceTime(shotTimings[index] + scene.duration)}</span><span>{scene.duration}s shot</span></div>
              <p>{scene.prompt}</p>
              <div className="storyboard-card-footer"><span>{scene.ratio} · {visualStyles.find((item) => item.id === scene.style)?.name} · Seed {scene.seed}</span><div className="shot-actions"><button disabled={scenes.length >= 12} onClick={() => duplicateScene(scene.id)} aria-label={`Duplicate scene ${index + 1}`}><Copy size={13} /> Duplicate</button><button onClick={() => openScene(scene)}>Open scene <ArrowUpRight size={15} /></button></div></div>
            </article>)}</div> : <div className="empty-state"><Clapperboard size={32} /><h3>Give your story a first scene.</h3><p>Write a prompt in Create, then choose Save scene. Save your project above to open its shots on another device.</p><button className="generate-button" onClick={() => go("Create")}>Start writing <ArrowRight size={16} /></button></div>}
          </section>}

          <footer className="studio-footer"><span>yetsyai. <span>Made for your next big idea.</span></span><span>INDEPENDENT SPIRIT. OPEN POSSIBILITIES. <Aperture size={15} /></span></footer>
        </div>
      </section>
      {selectedJob && <VideoPreview job={selectedJob} close={() => setSelectedJob(null)} download={(job) => void download(job)} />}
      {accountOpen && <AccountDialog close={() => setAccountOpen(false)} completed={() => void studio.reload()} configured={studio.capabilities.authConfigured} signedIn={studio.capabilities.signedIn} />}
      {notice && !mobileMenu && <div className="toast" role="status"><span className="toast-check"><Check size={13} /></span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
    </main>
  );
}
