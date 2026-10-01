"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Aperture, ArrowDownToLine, ArrowUpRight, AudioLines, Check, ChevronDown,
  CircleAlert, CircleHelp, Clapperboard, Clock3, Film, FolderOpen, Grid2X2,
  ImagePlus, Library, Menu, Play, Plus, RectangleHorizontal, RefreshCw,
  Search, Settings2, Sparkles, Square, WandSparkles, X,
} from "lucide-react";
import { Generation, isActive, MAX_REFERENCE_BYTES, VIDEO_MODEL } from "@/lib/video/types";
import { useStudio } from "./use-studio";

const looks = [
  { title: "After hours in Kyoto", image: "photo-1493976040374-85c8e12f0c0e", tag: "CINEMATIC", prompt: "A slow cinematic tracking shot through a quiet Kyoto street at blue hour. Warm lanterns glow along the wooden facades, a gentle breeze moves the curtains, soft film grain, anamorphic lens." },
  { title: "The perfect pour", image: "photo-1510812431401-41d2bd2722f3", tag: "PRODUCT", prompt: "A close-up product film of red wine pouring slowly into a crystal glass, rich reflections on a dark tabletop, warm studio lighting, shallow depth of field, slow motion." },
  { title: "Desert, at first light", image: "photo-1509316785289-025f5b846b35", tag: "NATURE", prompt: "A sweeping drone shot over sculpted desert dunes at sunrise. Long shadows reveal fine textures in the sand, warm golden light, a calm cinematic atmosphere, photorealistic." },
  { title: "Electric blue", image: "photo-1534528741775-53994a69daeb", tag: "PORTRAIT", prompt: "A cinematic fashion portrait in blue studio light. The subject gently turns toward the camera, a soft breeze moves their hair, dramatic rim lighting, editorial mood." },
];
const suggestions = ["A perfume ad in golden hour", "A quiet moment in Tokyo", "A sneaker landing in water"];
type NavPage = "Create" | "Explore" | "My videos" | "Assets";
type Reference = { name: string; data: string; width: number; height: number };

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
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const busy = studio.submitting || studio.jobs.some((job) => isActive(job.status));
  const canGenerate = studio.configured && !studio.loading && !busy && !readingReference && prompt.trim().length >= 3 && (mode === "text" || Boolean(reference));
  const filteredJobs = studio.jobs.filter((job) => job.prompt.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const go = (page: NavPage) => { setActiveNav(page); setMobileMenu(false); setSearch(""); };
  const generate = async () => {
    if (!canGenerate) return;
    const submitted = await studio.generate({
      prompt: prompt.trim(), aspectRatio: ratio, duration, generateAudio: audio,
      negativePrompt, ...(mode === "reference" && reference ? { referenceImage: reference.data } : {}),
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
        <div className="nav-label tools-label">NEXT IN THE STUDIO</div>
        <div className="nav-item muted-nav"><Clapperboard size={17} /><span>Storyboard</span><span className="soon">SOON</span></div>
        <div className="sidebar-bottom">
          <div className="credit-card"><div className="credit-heading"><span>Video generation</span><span>{studio.loading ? "Checking" : studio.configured ? "Connected" : "Setup needed"}</span></div><p className="workspace-note">{studio.configured ? "Create videos with your connected provider account." : "Connect your provider to start creating videos."}</p><button onClick={() => { go("Create"); void studio.reload(); }} className="upgrade-button"><RefreshCw size={13} /> Refresh connection</button></div>
          <button className="bottom-link" onClick={() => setNotice("Describe your scene, choose settings, then generate. Videos stay in this browser’s workspace.")}><CircleHelp size={16} /> How it works</button>
          <div className="profile-row"><span className="profile-avatar">Y</span><span><strong>Your local workspace</strong><small>{studio.jobs.filter((job) => job.status === "completed").length} completed videos</small></span></div>
        </div>
      </aside>

      <section className="studio-main">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="top-actions"><span className={`top-credit ${studio.configured ? "provider-connected" : "provider-offline"}`}><span className="credit-dot" />{studio.loading ? "Connecting…" : studio.configured ? "Ready to create" : "Connect provider"}</span><button className="icon-button" aria-label="Search your videos" onClick={() => { go("My videos"); setTimeout(() => searchRef.current?.focus(), 0); }}><Search size={18} /></button><span className="top-avatar">Y</span></div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR CREATIVE STUDIO</div><h1>{activeNav === "Create" ? <>Make something <span>unreal.</span></> : activeNav === "Explore" ? <>Find your next <span>frame.</span></> : activeNav === "Assets" ? <>Start with a <span>reference.</span></> : <>Your ideas, <span>in motion.</span></>}</h1><p>{activeNav === "Create" ? "Dream it up. Direct every detail. Make it yours." : activeNav === "Explore" ? "A few visual starting points. Add your own perspective." : activeNav === "Assets" ? "Choose an image and bring it to life." : "Every scene you've created in this workspace."}</p></div><button className="library-button" onClick={() => go(activeNav === "My videos" ? "Create" : "My videos")}><Library size={16} />{activeNav === "My videos" ? "Create a video" : "My library"}<span>{studio.jobs.length}</span></button></section>

          {studio.error && <div className="studio-message message-error" role="alert"><CircleAlert size={17} /><div>{studio.error}</div><button onClick={() => void studio.reload()}>Retry</button></div>}
          {studio.pollError && <div className="studio-message" role="status"><RefreshCw size={17} /><div>{studio.pollError} We&apos;ll keep checking.</div></div>}
          {!studio.loading && !studio.configured && !studio.error && activeNav === "Create" && <div className="studio-message setup-message"><Sparkles size={18} /><div><strong>Connect video generation</strong><p>Add your fal.ai API key as <code>FAL_KEY</code> in your local <code>.env</code>, restart the app, then refresh the connection. <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer">Get an API key <ArrowUpRight size={12} /></a></p></div></div>}

          {activeNav === "Create" && <section className="creator-card" aria-label="Create a video">
            <div className="creator-top"><div className="mode-tabs"><button className={mode === "text" ? "mode-selected" : ""} onClick={() => setMode("text")} aria-pressed={mode === "text"}><Film size={16} /> Text to video</button><button className={mode === "reference" ? "mode-selected" : ""} onClick={() => setMode("reference")} aria-pressed={mode === "reference"}><ImagePlus size={16} /> Image to video</button></div><button className="prompt-helper" onClick={() => setPrompt(looks[Math.floor(Math.random() * looks.length)].prompt)}><WandSparkles size={15} /> Surprise me</button></div>
            <label className="prompt-label" htmlFor="video-prompt">DESCRIBE YOUR SCENE</label>
            <textarea id="video-prompt" value={prompt} maxLength={2500} onChange={(event) => { setPrompt(event.target.value); studio.clearError(); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void generate(); } }} placeholder={mode === "text" ? "A cinematic shot of... Describe your scene, subject, movement, lighting, and mood" : "Describe how your image should move. Camera direction, lighting, and mood..."} rows={3} />
            <div className="suggestion-row"><span>TRY</span>{suggestions.map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
            {mode === "reference" && <div className="reference-area">{reference ? <><div className="reference-thumb" role="img" aria-label={reference.name} style={{ backgroundImage: `url(${reference.data})` }} /><div><strong>{reference.name}</strong><small>{reference.width} × {reference.height} · Video follows this image&apos;s aspect ratio</small></div><button className="icon-button" onClick={removeReference} aria-label="Remove reference"><X size={15} /></button></> : <button className="reference-upload" disabled={readingReference} onClick={() => fileRef.current?.click()}><ImagePlus size={20} /><span>{readingReference ? "Reading image…" : "Choose a starting image"}<small>JPG or PNG · Up to 3 MB · At least 300 × 300 px</small></span></button>}</div>}
            {fileError && <p className="inline-error" role="alert">{fileError}</p>}
            <div className="creator-divider" />
            <div className="control-row">
              <div className="control-select"><span className="model-glyph"><Sparkles size={14} /></span><span className="control-caption">MODEL</span><strong>{VIDEO_MODEL}</strong></div>
              <div className="control-separator" />
              <div className="ratio-control"><span className="control-caption">{mode === "reference" ? "IMAGE RATIO" : "ASPECT RATIO"}</span><div className="ratio-buttons">{(["16:9", "9:16", "1:1"] as const).map((value) => <button key={value} disabled={mode === "reference"} onClick={() => setRatio(value)} className={ratio === value && mode === "text" ? "ratio-active" : ""} aria-pressed={ratio === value && mode === "text"}>{value === "1:1" ? <Square size={13} /> : <RectangleHorizontal size={15} className={value === "9:16" ? "ratio-vertical" : ""} />}{value}</button>)}</div></div>
              <label className="duration-select"><Clock3 size={15} /><span className="control-caption">DURATION</span><select aria-label="Video duration" value={duration} onChange={(event) => setDuration(Number(event.target.value) as 5 | 10)}><option value={5}>5 sec</option><option value={10}>10 sec</option></select><ChevronDown size={14} /></label>
              <button className="settings-button" aria-label="Generation settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={17} /></button>
              <button className="generate-button" disabled={!canGenerate} onClick={() => void generate()}>{studio.submitting ? <><span className="spinner" /> Submitting</> : busy ? <><span className="spinner" /> Rendering</> : <><Sparkles size={16} /> Generate</>}</button>
            </div>
            {settingsOpen && <div className="advanced-settings"><label className="audio-setting"><input type="checkbox" checked={audio} onChange={(event) => setAudio(event.target.checked)} /><span>Generate audio <small>Add sound to your scene</small></span></label><label htmlFor="negative-prompt">Avoid in the video</label><input id="negative-prompt" type="text" maxLength={500} value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} /></div>}
            <div className="composer-foot"><button disabled={readingReference} onClick={() => fileRef.current?.click()}><Plus size={15} />{readingReference ? "Reading image…" : "Add reference"}</button><span><kbd>⌘</kbd><kbd>↵</kbd> to generate · {prompt.length}/2500</span></div>
          </section>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={(event) => void chooseReference(event)} />

          {(activeNav === "My videos" || (activeNav === "Create" && studio.jobs.length > 0)) && <section className="inspiration-section library-section"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR CREATIONS</div><h2>{activeNav === "My videos" ? "Every scene, saved." : "From idea to motion."}</h2></div>{activeNav === "Create" && <button className="view-all" onClick={() => go("My videos")}>View library <ArrowUpRight size={15} /></button>}</div>{activeNav === "My videos" && <label className="library-search"><Search size={16} /><input ref={searchRef} type="search" placeholder="Search your videos by prompt..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>}{studio.loading ? <div className="empty-state"><span className="spinner" />Loading your library…</div> : filteredJobs.length ? jobCards(activeNav === "Create" ? filteredJobs.slice(0, 4) : filteredJobs) : <div className="empty-state"><Film size={28} /><h3>{search ? "No matching videos" : "Your first scene starts here"}</h3><p>{search ? "Try searching for a different part of your prompt." : "Create a video and it will appear in this workspace."}</p><button className="library-button" onClick={() => go("Create")}><Plus size={15} /> Create a video</button></div>}</section>}

          {(activeNav === "Create" || activeNav === "Explore") && <section className="inspiration-section"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" />LOOKS TO TRY</div><h2>Made for the <span>frame.</span></h2><p className="section-description">Visual inspiration. Choose a look to start with its prompt.</p></div>{activeNav === "Create" && <button className="view-all" onClick={() => go("Explore")}>Explore all <ArrowUpRight size={15} /></button>}</div><div className="creation-grid">{looks.map((look) => <article className="creation-card" key={look.title}><button className="creation-image" onClick={() => { setPrompt(look.prompt); setMode("text"); go("Create"); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`Use prompt: ${look.title}`}><Thumbnail image={look.image} title={look.title} /><span className="creation-tag">{look.tag}</span><span className="play-button"><ArrowUpRight size={17} /></span><span className="image-duration">USE PROMPT</span></button><div className="creation-info"><div><h3>{look.title}</h3><p>Photo reference · Prompt template</p></div></div></article>)}</div></section>}

          {activeNav === "Assets" && <section className="asset-section">{reference ? <div className="asset-card"><div role="img" aria-label={reference.name} className="asset-image" style={{ backgroundImage: `url(${reference.data})` }} /><h2>{reference.name}</h2><p>{reference.width} × {reference.height} · Selected starting frame</p><div><button className="generate-button" onClick={() => { setMode("reference"); go("Create"); }}><Film size={15} /> Animate image</button><button className="library-button" onClick={removeReference}><X size={15} /> Remove</button></div></div> : <div className="empty-state"><ImagePlus size={30} /><h3>Bring your image to life</h3><p>Choose a JPG or PNG to use as the first frame of your video. References are kept for this editing session.</p><button className="generate-button" disabled={readingReference} onClick={() => fileRef.current?.click()}><Plus size={15} />{readingReference ? "Reading…" : "Choose image"}</button>{fileError && <p className="inline-error" role="alert">{fileError}</p>}</div>}</section>}

          <footer className="studio-footer"><span>Made for the ones who see it first.</span><span><AudioLines size={13} /> Powered by your imagination</span></footer>
        </div>
      </section>
      {selectedJob && <VideoPreview job={selectedJob} close={() => setSelectedJob(null)} download={(job) => void download(job)} />}
      {notice && <div className="toast" role="status"><span className="toast-check"><Check size={13} /></span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
    </main>
  );
}
