"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Aperture, ArrowDownToLine, ArrowUpRight, AudioLines, Check, ChevronDown,
  CircleAlert, CircleHelp, Clapperboard, Clock3, Film, FolderOpen, Grid2X2,
  ImagePlus, Library, Menu, Play, Plus, RectangleHorizontal, RefreshCw,
  Search, Settings2, Sparkles, Square, WandSparkles, X, ArrowRight, Bookmark, Camera, ChevronRight, Trash2, LogIn,
} from "lucide-react";
import { Generation, isActive, MAX_REFERENCE_BYTES, VIDEO_MODEL } from "@/lib/video/types";
import { useStudio } from "./use-studio";
import { AccountDialog } from "./account-dialog";

const looks = [
  { title: "After hours in Kyoto", image: "photo-1493976040374-85c8e12f0c0e", tag: "CINEMATIC", prompt: "A slow cinematic tracking shot through a quiet Kyoto street at blue hour. Warm lanterns glow along the wooden facades, a gentle breeze moves the curtains, soft film grain, anamorphic lens." },
  { title: "The perfect pour", image: "photo-1510812431401-41d2bd2722f3", tag: "PRODUCT", prompt: "A close-up product film of red wine pouring slowly into a crystal glass, rich reflections on a dark tabletop, warm studio lighting, shallow depth of field, slow motion." },
  { title: "Desert, at first light", image: "photo-1509316785289-025f5b846b35", tag: "NATURE", prompt: "A sweeping drone shot over sculpted desert dunes at sunrise. Long shadows reveal fine textures in the sand, warm golden light, a calm cinematic atmosphere, photorealistic." },
  { title: "Electric blue", image: "photo-1534528741775-53994a69daeb", tag: "PORTRAIT", prompt: "A cinematic fashion portrait in blue studio light. The subject gently turns toward the camera, a soft breeze moves their hair, dramatic rim lighting, editorial mood." },
];
const suggestions = ["A perfume ad in golden hour", "A quiet moment in Tokyo", "A sneaker landing in water"];
type NavPage = "Create" | "Explore" | "My videos" | "Assets" | "Storyboard";
type Reference = { name: string; data: string; width: number; height: number; assetId?: string };
type Asset = { id: string; name: string; width: number; height: number; url: string };
type Scene = { id: string; prompt: string; ratio: "16:9" | "9:16" | "1:1"; seed: number };
const cameras = [
  { name: "Static", detail: "Locked-off camera, subtle natural motion, one continuous shot." },
  { name: "Push in", detail: "A slow, smooth camera push in toward the subject, one continuous shot." },
  { name: "Orbit", detail: "A gentle camera orbit around the subject, steady movement, one continuous shot." },
  { name: "Handheld", detail: "Intimate handheld camera with subtle drift, documentary feel, one continuous shot." },
];

function Thumbnail({ image, title }: { image: string; title: string }) {
  return <div role="img" aria-label={title} className="thumb" style={{ backgroundImage: `linear-gradient(180deg, transparent 40%, rgba(8,8,11,.35)), url(https://images.unsplash.com/${image}?auto=format&fit=crop&w=1000&q=85)` }} />;
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
  const [activeNav, setActiveNav] = useState<NavPage>("Create");
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<Generation | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeLook, setActiveLook] = useState(0);
  const [camera, setCamera] = useState(0);
  const [seed, setSeed] = useState(42);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [deletePending, setDeletePending] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const busy = studio.submitting || studio.jobs.some((job) => isActive(job.status));
  const readyPrompt = !studio.loading && !busy && !readingReference && prompt.trim().length >= 3 && (mode === "text" || Boolean(reference));
  const canGenerate = studio.configured && studio.capabilities.signedIn && readyPrompt && studio.usage.used < studio.usage.limit;
  const filteredJobs = studio.jobs.filter((job) => job.prompt.toLowerCase().includes(search.toLowerCase()));
  const latestVideo = studio.jobs.find((job) => job.status === "completed" && job.videoUrl);
  const currentJob = studio.jobs.find((job) => isActive(job.status));

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem("yetsyai-draft-v1") || "null");
      if (draft && typeof draft.prompt === "string") { setPrompt(draft.prompt.slice(0, 2500)); if (["16:9", "9:16", "1:1"].includes(draft.ratio)) setRatio(draft.ratio); if (Number.isInteger(draft.seed) && draft.seed >= 0 && draft.seed <= 2147483647) setSeed(draft.seed); }
      const board = JSON.parse(localStorage.getItem("yetsyai-board-v1") || "[]");
      if (Array.isArray(board)) setScenes(board.filter((item) => typeof item.id === "string" && typeof item.prompt === "string" && ["16:9", "9:16", "1:1"].includes(item.ratio) && Number.isInteger(item.seed)).slice(0, 12));
    } catch { /* A disabled browser store should not prevent creation. */ }
    setDraftReady(true);
    if (new URLSearchParams(window.location.search).get("account") === "expired") setNotice("This account link has expired. Request a new confirmation or reset email.");
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    try { localStorage.setItem("yetsyai-draft-v1", JSON.stringify({ prompt, ratio, seed })); localStorage.setItem("yetsyai-board-v1", JSON.stringify(scenes)); } catch { /* Draft storage may be full or disabled. */ }
  }, [prompt, ratio, seed, scenes, draftReady]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/assets", { signal: controller.signal }).then(async (response) => { if (response.ok) setAssets((await response.json()).assets); }).catch(() => {});
    return () => controller.abort();
  }, [studio.capabilities.signedIn]);
  useEffect(() => { if (!studio.capabilities.audio) setAudio(false); if (!studio.capabilities.durations.includes(duration)) setDuration(5); }, [studio.capabilities, duration]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const go = (page: NavPage) => { setActiveNav(page); setMobileMenu(false); setSearch(""); };
  const generate = async () => {
    if (!canGenerate) return;
    const submitted = await studio.generate({
      prompt: `${prompt.trim()} ${cameras[camera].detail}`.slice(0, 2500), aspectRatio: ratio, duration, generateAudio: audio, seed,
      negativePrompt, ...(mode === "reference" && reference ? reference.assetId ? { assetId: reference.assetId } : { referenceImage: reference.data } : {}),
    });
    if (submitted) { setPrompt(""); setNotice("Your scene is in the render queue. You can safely refresh this page."); }
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
    if (scenes.length >= 12) { setNotice("Your storyboard holds 12 scenes. Remove one to make room."); return; }
    setScenes((current) => [...current, { id: crypto.randomUUID(), prompt: prompt.trim(), ratio, seed }]);
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
          {job.error && <p className="job-error">{job.error}<button onClick={() => { setPrompt(job.prompt); go("Create"); }}>Edit prompt</button></p>}
          {!isActive(job.status) && <div className="job-actions">{deletePending === job.id ? <><button onClick={() => setDeletePending(null)}>Keep video</button><button className="delete-confirm" onClick={() => { void studio.remove(job.id); setDeletePending(null); }}><Trash2 size={12} /> Delete permanently</button></> : <><button onClick={() => { setPrompt(job.prompt); setSeed(job.seed); go("Create"); }}><RefreshCw size={12} /> Reuse scene</button><button onClick={() => setDeletePending(job.id)} aria-label={`Delete video: ${job.prompt}`}><Trash2 size={13} /></button></>}</div>}
        </article>
      ))}
    </div>
  );

  return (
    <main className="studio-shell" id="home">
      {mobileMenu && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a href="#home" className="brand" onClick={() => go("Create")}><span className="brand-mark"><Aperture size={21} strokeWidth={2.2} /></span><span>yetsyai<span className="brand-period">.</span></span><span className="brand-beta">BETA</span></a>
        <div className="workspace-switch"><span className="workspace-avatar">Y</span><span className="workspace-copy"><strong>Your studio</strong><small>Personal workspace</small></span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map((item) => <button key={item.label} onClick={() => go(item.label)} className={`nav-item ${activeNav === item.label ? "nav-active" : ""}`} aria-current={activeNav === item.label ? "page" : undefined}>{item.icon}<span>{item.label}</span>{item.label === "My videos" && <span className="nav-count">{studio.jobs.length}</span>}</button>)}
        </nav>
        <div className="sidebar-note"><span className="eyebrow">SMALL IDEAS. BIG FRAMES.</span><p>Your next great shot starts with a sentence.</p><button onClick={() => { go("Create"); setPrompt(looks[0].prompt); }}>Start a scene <ArrowUpRight size={14} /></button></div>
        <div className="sidebar-bottom">
          <div className="credit-card"><div className="credit-heading"><span>{studio.capabilities.provider === "fal" ? "Studio allowance" : "Free studio"}</span><span>{Math.max(0, studio.usage.limit - studio.usage.used)} / {studio.usage.limit} left</span></div><div className="credit-meter"><i style={{ width: `${Math.max(0, 100 - studio.usage.used / studio.usage.limit * 100)}%` }} /></div><p className="workspace-note">Short clips. Shared GPU. A little patience, a lot of possibility.</p><button onClick={() => void studio.reload()} className="upgrade-button"><RefreshCw size={13} /> Check availability</button></div>
          <button className="bottom-link" onClick={() => setNotice("Describe one scene, pick a camera move and generate. Account videos are saved across devices. Free GPU capacity is shared and limited.")}><CircleHelp size={16} /> A quick studio tour</button>
          <button className="profile-row" onClick={() => setAccountOpen(true)}><span className="profile-avatar">Y</span><span><strong>{studio.capabilities.signedIn ? "Your account" : "Make this space yours"}</strong><small>{studio.capabilities.signedIn ? "Manage account" : "Sign in to save your videos"}</small></span><ChevronRight size={16} /></button>
        </div>
      </aside>

      <section className="studio-main">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="top-actions"><span className={`top-credit ${studio.configured ? "provider-connected" : "provider-offline"}`}><span className="credit-dot" />{studio.loading ? "Connecting…" : studio.configured ? "Studio online" : "Preview access"}</span><button className="icon-button" aria-label="Search your videos" onClick={() => { go("My videos"); setTimeout(() => searchRef.current?.focus(), 0); }}><Search size={18} /></button><button className="account-trigger" onClick={() => setAccountOpen(true)}>{studio.capabilities.signedIn ? <span className="top-avatar">Y</span> : <><LogIn size={14} /> Sign in</>}</button></div>
        </header>

        <div className="content-wrap">
          {activeNav === "Create" ? <section className="cinema-hero" aria-labelledby="studio-title"><div className="hero-photo" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1800&q=90)" }} /><div className="hero-grain" /><div className="hero-content"><div className="eyebrow"><span className="live-spark" />THE WORLD IS YOUR SET</div><h1 id="studio-title">You imagine.<br />We make it <em>move.</em></h1><p>Turn the scene in your head into a frame worth watching.</p><button onClick={() => document.getElementById("video-prompt")?.focus()}>Direct your first scene <ArrowUpRight size={17} /></button></div><div className="hero-caption"><span>01 / THE CREATIVE STUDIO</span><span>FROM A SENTENCE TO A SCENE <ArrowDownToLine size={12} /></span></div><div className="hero-label">NO BIG BUDGET.<br /><strong>JUST BIG IDEAS.</strong></div></section> : <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR CREATIVE STUDIO</div><h1>{activeNav === "Explore" ? <>Find your next <span>frame.</span></> : activeNav === "Assets" ? <>Every great scene<br />starts <span>somewhere.</span></> : activeNav === "Storyboard" ? <>One idea.<br /><span>A whole story.</span></> : <>Your ideas,<br /><span>in motion.</span></>}</h1><p>{activeNav === "Explore" ? "A collection of looks to make your own." : activeNav === "Assets" ? "Your references, ready for the next shot." : activeNav === "Storyboard" ? "Plan your sequence. Keep your scenes together. Saved on this device." : "Your scenes, all in one place."}</p></div><button className="library-button" onClick={() => go("Create")}><Plus size={16} /> New scene</button></section>}

          {studio.error && <div className="studio-message message-error" role="alert"><CircleAlert size={17} /><div>{studio.error}</div><button onClick={() => void studio.reload()}>Retry</button></div>}
          {studio.pollError && <div className="studio-message" role="status"><RefreshCw size={17} /><div>{studio.pollError} We&apos;ll keep checking.</div></div>}
          {!studio.loading && !studio.configured && !studio.error && activeNav === "Create" && <div className="studio-message setup-message"><Sparkles size={18} /><div><strong>Your next scene starts here.</strong><p>We&apos;re connecting free video generation. Explore a look, write a prompt and save your storyboard while the studio gets ready.</p></div><span className="preview-chip">PREVIEW</span></div>}

          {activeNav === "Create" && <><div className="section-heading composer-heading"><div><div className="eyebrow">THE DIRECTOR&apos;S DESK</div><h2>Let&apos;s set the scene.</h2></div><span className="draft-status"><span /> Draft saved on this device</span></div><div className="director-layout"><section className="creator-card" aria-label="Create a video">
            <div className="creator-top"><div className="mode-tabs"><button className={mode === "text" ? "mode-selected" : ""} onClick={() => setMode("text")} aria-pressed={mode === "text"}><Film size={16} /> Text to video</button><button disabled={!studio.capabilities.image} title={studio.capabilities.image ? "Animate your image" : "The free model currently supports text prompts"} className={mode === "reference" ? "mode-selected" : ""} onClick={() => setMode("reference")} aria-pressed={mode === "reference"}><ImagePlus size={16} /> Image to video{!studio.capabilities.image && <span className="soon">SOON</span>}</button></div><button className="prompt-helper" aria-label="Try a random scene" onClick={() => { const index = Math.floor(Math.random() * looks.length); setActiveLook(index); setPrompt(looks[index].prompt); }}><WandSparkles size={16} /></button></div>
            <label className="prompt-label" htmlFor="video-prompt">DESCRIBE YOUR SCENE</label>
            <textarea id="video-prompt" value={prompt} maxLength={2500} onChange={(event) => { setPrompt(event.target.value); studio.clearError(); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void generate(); } }} placeholder={mode === "text" ? "A cinematic shot of... Describe your scene, subject, movement, lighting, and mood" : "Describe how your image should move. Camera direction, lighting, and mood..."} rows={3} />
            <div className="suggestion-row"><span>TRY</span>{suggestions.map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
            {mode === "reference" && <div className="reference-area">{reference ? <><div className="reference-thumb" role="img" aria-label={reference.name} style={{ backgroundImage: `url(${reference.data})` }} /><div><strong>{reference.name}</strong><small>{reference.width} × {reference.height} · Video follows this image&apos;s aspect ratio</small></div><button className="icon-button" onClick={removeReference} aria-label="Remove reference"><X size={15} /></button></> : <button className="reference-upload" disabled={readingReference} onClick={() => fileRef.current?.click()}><ImagePlus size={20} /><span>{readingReference ? "Reading image…" : "Choose a starting image"}<small>JPG or PNG · Up to 3 MB · At least 300 × 300 px</small></span></button>}</div>}
            {fileError && <p className="inline-error" role="alert">{fileError}</p>}
            <div className="camera-heading"><span className="prompt-label">CAMERA MOVEMENT</span><span>Direct the feel</span></div><div className="camera-presets">{cameras.map((item, index) => <button key={item.name} onClick={() => setCamera(index)} className={camera === index ? "camera-selected" : ""} aria-pressed={camera === index}><Camera size={15} />{item.name}</button>)}</div>
            <div className="creator-divider" />
            <div className="control-row">
              <div className="control-select"><span className="model-glyph"><Sparkles size={14} /></span><div><span className="control-caption">GENERATION MODEL</span><strong>{studio.capabilities.model || VIDEO_MODEL}</strong></div><span className="model-pill">{studio.capabilities.provider === "fal" ? "CONNECTED" : "OPEN"}</span></div>
              <div className="control-separator" />
              <div className="ratio-control"><span className="control-caption">{mode === "reference" ? "IMAGE RATIO" : "ASPECT RATIO"}</span><div className="ratio-buttons">{(["16:9", "9:16", "1:1"] as const).map((value) => <button key={value} disabled={mode === "reference"} onClick={() => setRatio(value)} className={ratio === value && mode === "text" ? "ratio-active" : ""} aria-pressed={ratio === value && mode === "text"}>{value === "1:1" ? <Square size={13} /> : <RectangleHorizontal size={15} className={value === "9:16" ? "ratio-vertical" : ""} />}{value}</button>)}</div></div>
              <label className="duration-select"><Clock3 size={15} /><span className="control-caption">DURATION</span><select aria-label="Video duration" value={duration} onChange={(event) => setDuration(Number(event.target.value) as 5 | 10)}>{studio.capabilities.durations.map((value) => <option key={value} value={value}>{value} sec</option>)}</select><ChevronDown size={14} /></label>
              <button className="settings-button" aria-label="Generation settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={17} /></button>
              <button className="generate-button main-generate" disabled={studio.capabilities.signedIn ? !canGenerate : !readyPrompt || !studio.capabilities.authConfigured} onClick={() => studio.capabilities.signedIn ? void generate() : setAccountOpen(true)}>{studio.submitting ? <><span className="spinner" /> Submitting scene</> : busy ? <><span className="spinner" /> Creating your scene</> : <><Sparkles size={17} />{!studio.capabilities.signedIn && studio.capabilities.authConfigured ? "Sign in to generate" : !studio.configured ? "Generation opening soon" : studio.usage.used >= studio.usage.limit ? "Daily allowance used" : "Generate video"}<ArrowRight size={16} /></>}</button>
            </div>
            {settingsOpen && <div className="advanced-settings"><label className="audio-setting"><input type="checkbox" checked={audio} disabled={!studio.capabilities.audio} onChange={(event) => setAudio(event.target.checked)} /><span>Generate audio <small>{studio.capabilities.audio ? "Add sound to your scene" : "The free model creates silent clips"}</small></span></label><label htmlFor="negative-prompt">Avoid in the video</label><input id="negative-prompt" type="text" maxLength={500} value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} /><label htmlFor="render-seed">Seed · reuse to compare variations</label><input id="render-seed" type="number" min={0} max={2147483647} value={seed} onChange={(event) => setSeed(Math.max(0, Math.min(2147483647, Math.floor(Number(event.target.value)))))} /></div>}
            <div className="composer-foot"><button onClick={saveScene}><Bookmark size={14} />Save scene</button><span>{prompt.length}/2500 <kbd>⌘</kbd><kbd>↵</kbd></span></div>
          </section><aside className="scene-monitor"><div className="monitor-heading"><span><span className="monitor-dot" />{currentJob ? "RENDER IN PROGRESS" : latestVideo ? "LATEST TAKE" : "SCENE INSPIRATION"}</span><span>{ratio} <RectangleHorizontal size={13} /></span></div><div className={`monitor-canvas ${ratio === "9:16" ? "monitor-portrait" : ""}`}>{latestVideo && !currentJob ? <video src={latestVideo.videoUrl!} controls muted playsInline preload="metadata" /> : <><Thumbnail image={looks[activeLook].image} title={looks[activeLook].title} /><div className="monitor-shade" />{currentJob ? <div className="monitor-render"><span className="spinner" /><h3>{currentJob.status === "submitting" ? "Holding your place." : currentJob.status === "queued" ? "Your scene is in line." : "A little movie magic."}</h3><p>You can leave this page. We&apos;ll keep your render.</p></div> : <div className="monitor-overlay"><span>VISUAL MOODBOARD</span><h3>{looks[activeLook].title}</h3><p>Photo inspiration · Your generated video appears here.</p></div>}</>}<span className="frame-corner corner-tl" /><span className="frame-corner corner-tr" /><span className="frame-corner corner-bl" /><span className="frame-corner corner-br" /></div><div className="monitor-footer"><span><Film size={14} />{duration}s · {studio.capabilities.audio && audio ? "Sound on" : "Silent clip"}</span><span>TAKE {String(studio.jobs.length + 1).padStart(2, "0")}</span></div><div className="director-tip"><span>DIRECTOR&apos;S NOTE</span><p>One subject. One action. One camera move. Simple prompts make stronger first takes.</p></div></aside></div></>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={(event) => void chooseReference(event)} />

          {(activeNav === "My videos" || (activeNav === "Create" && studio.jobs.length > 0)) && <section className="inspiration-section library-section"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR CREATIONS</div><h2>{activeNav === "My videos" ? "Every scene, saved." : "From idea to motion."}</h2></div>{activeNav === "Create" && <button className="view-all" onClick={() => go("My videos")}>View library <ArrowUpRight size={15} /></button>}</div>{activeNav === "My videos" && <label className="library-search"><Search size={16} /><input ref={searchRef} type="search" placeholder="Search your videos by prompt..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>}{studio.loading ? <div className="empty-state"><span className="spinner" />Loading your library…</div> : filteredJobs.length ? jobCards(activeNav === "Create" ? filteredJobs.slice(0, 4) : filteredJobs) : <div className="empty-state"><Film size={28} /><h3>{search ? "No matching videos" : "Your first scene starts here"}</h3><p>{search ? "Try searching for a different part of your prompt." : "Create a video and it will appear in this workspace."}</p><button className="library-button" onClick={() => go("Create")}><Plus size={15} /> Create a video</button></div>}</section>}

          {(activeNav === "Create" || activeNav === "Explore") && <section className="inspiration-section"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" />A LITTLE INSPIRATION</div><h2>A look for every <span>idea.</span></h2><p className="section-description">Start with a mood. Make the story yours.</p></div>{activeNav === "Create" && <button className="view-all" onClick={() => go("Explore")}>All looks <ArrowUpRight size={15} /></button>}</div><div className="creation-grid looks-grid">{looks.map((look, index) => <article className="creation-card look-card" key={look.title}><button className="creation-image" onClick={() => { setPrompt(look.prompt); setActiveLook(index); setMode("text"); go("Create"); setTimeout(() => document.getElementById("video-prompt")?.focus(), 50); }} aria-label={`Use prompt: ${look.title}`}><Thumbnail image={look.image} title={look.title} /><span className="creation-tag">{look.tag}</span><span className="look-index">0{index + 1}</span><div className="look-caption"><h3>{look.title}</h3><span>Try this scene <ArrowUpRight size={14} /></span></div></button><div className="look-footnote"><span>PHOTO MOODBOARD</span><span>{index % 2 ? "STUDIO LIGHT" : "NATURAL LIGHT"}</span></div></article>)}</div></section>}

          {activeNav === "Assets" && <section className="asset-section">{!studio.capabilities.image && <div className="studio-message"><ImagePlus size={18} /><div>Collect references for your next scene. Image animation will open when a compatible backend is connected.</div></div>}{reference ? <div className="asset-card"><div role="img" aria-label={reference.name} className="asset-image" style={{ backgroundImage: `url(${reference.data})` }} /><h2>{reference.name}</h2><p>{reference.width} × {reference.height} · {reference.assetId ? "Saved to your account" : "Selected on this device"}</p><div>{studio.capabilities.image && <button className="generate-button" onClick={() => { setMode("reference"); go("Create"); }}><Film size={15} /> Animate image</button>}{!reference.assetId && <button className="generate-button" disabled={savingAsset || !studio.capabilities.mediaConfigured} onClick={() => void saveReference()}><Bookmark size={15} />{savingAsset ? "Saving…" : "Save reference"}</button>}<button className="library-button" onClick={removeReference}><X size={15} /> Clear selection</button></div></div> : <div className="empty-state"><ImagePlus size={30} /><h3>Your next starting point.</h3><p>Collect a face, a place or a product. Sign in to save references across devices.</p><button className="generate-button" disabled={readingReference} onClick={() => fileRef.current?.click()}><Plus size={15} />{readingReference ? "Reading…" : "Choose image"}</button>{fileError && <p className="inline-error" role="alert">{fileError}</p>}</div>}{assets.length > 0 && <div className="creation-grid assets-grid">{assets.map((asset) => <article className="creation-card" key={asset.id}><button className="creation-image" onClick={() => setReference({ name: asset.name, data: asset.url, width: asset.width, height: asset.height, assetId: asset.id })}><div className="thumb" role="img" aria-label={asset.name} style={{ backgroundImage: `url(${asset.url})` }} /></button><div className="creation-info"><div><h3>{asset.name}</h3><p>{asset.width} × {asset.height}</p></div><button className="icon-button" onClick={() => void deleteAsset(asset.id)} aria-label={`Remove ${asset.name}`}><Trash2 size={14} /></button></div></article>)}</div>}</section>}

          {activeNav === "Storyboard" && <section className="storyboard-section"><div className="storyboard-intro"><div><span className="eyebrow">{scenes.length} / 12 SCENES</span><p>A plan for your next film. Generate each shot separately when you&apos;re ready.</p></div><button className="library-button" onClick={() => go("Create")}><Plus size={15} /> Write a scene</button></div>{scenes.length ? <div className="storyboard-grid">{scenes.map((scene, index) => <article className="storyboard-card" key={scene.id}><div className="storyboard-card-heading"><span>SCENE {String(index + 1).padStart(2, "0")}</span><button className="icon-button" onClick={() => setScenes((current) => current.filter((item) => item.id !== scene.id))} aria-label={`Remove scene ${index + 1}`}><Trash2 size={14} /></button></div><p>{scene.prompt}</p><div className="storyboard-card-footer"><span>{scene.ratio} · Seed {scene.seed}</span><button onClick={() => { setPrompt(scene.prompt); setRatio(scene.ratio); setSeed(scene.seed); go("Create"); }}>Open scene <ArrowUpRight size={15} /></button></div></article>)}</div> : <div className="empty-state"><Clapperboard size={32} /><h3>Give your story a first scene.</h3><p>Write a prompt in Create, then choose Save scene. Your storyboard stays on this device.</p><button className="generate-button" onClick={() => go("Create")}>Start writing <ArrowRight size={16} /></button></div>}</section>}

          <footer className="studio-footer"><span>yetsyai. <span>Made for your next big idea.</span></span><span>INDEPENDENT SPIRIT. OPEN POSSIBILITIES. <Aperture size={15} /></span></footer>
        </div>
      </section>
      {selectedJob && <VideoPreview job={selectedJob} close={() => setSelectedJob(null)} download={(job) => void download(job)} />}
      {accountOpen && <AccountDialog close={() => setAccountOpen(false)} completed={() => void studio.reload()} configured={studio.capabilities.authConfigured} signedIn={studio.capabilities.signedIn} />}
      {notice && <div className="toast" role="status"><span className="toast-check"><Check size={13} /></span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
    </main>
  );
}
