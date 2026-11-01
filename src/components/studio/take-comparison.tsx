"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Pause, Play, X } from "lucide-react";
import { Generation } from "@/lib/video/types";
import { cameraDirections, visualStyles } from "@/lib/video/direction";

export function TakeComparison({ jobs, close, download }: { jobs: [Generation, Generation]; close: () => void; download: (job: Generation) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const attempt = useRef(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = dialogRef.current;
    const players = [...videos.current];
    dialog?.showModal();
    return () => { attempt.current++; players.forEach(video => video?.pause()); dialog?.close(); };
  }, []);
  const pause = () => { attempt.current++; videos.current.forEach(video => video?.pause()); };
  const play = async () => {
    const current = ++attempt.current;
    setError("");
    const players = videos.current.filter((video): video is HTMLVideoElement => Boolean(video));
    players.forEach(video => { video.pause(); video.currentTime = 0; });
    const results = await Promise.allSettled(players.map(video => video.play()));
    if (current !== attempt.current) return;
    if (results.some(result => result.status === "rejected")) {
      pause();
      setError("Couldn't start both videos. Try the individual playback controls, or refresh your library to renew the links.");
    }
  };
  return <dialog ref={dialogRef} className="preview-dialog comparison-dialog" onCancel={close} aria-labelledby="comparison-title">
    <div className="preview-heading"><div><span className="eyebrow">THE REVIEW ROOM</span><h2 id="comparison-title">Compare your takes.</h2></div><button className="icon-button" onClick={close} aria-label="Close take comparison"><X size={19} /></button></div>
    <div className="comparison-controls"><button className="generate-button" onClick={() => void play()}><Play size={14} /> Play both from start</button><button className="library-button" onClick={pause}><Pause size={14} /> Pause both</button><p>Use each player to inspect a moment. Playback may vary with buffering.</p></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="comparison-grid">{jobs.map((job, index) => <article className="comparison-take" key={job.id}>
      <div className="comparison-take-heading"><strong>TAKE {index === 0 ? "A" : "B"}</strong><span>{job.duration}s · {job.aspectRatio}</span></div>
      <video ref={video => { videos.current[index] = video; }} src={job.videoUrl!} controls playsInline muted preload="metadata" onError={() => setError("A saved video couldn't be loaded. Close this view and refresh the library to check its link.")} />
      <p className="comparison-prompt">{job.prompt}</p>
      <dl className="comparison-settings"><div><dt>Camera</dt><dd>{cameraDirections.find(camera => camera.id === job.settings?.camera)?.name ?? "Not recorded"}</dd></div><div><dt>Look</dt><dd>{visualStyles.find(style => style.id === job.settings?.style)?.name ?? "Not recorded"}</dd></div><div><dt>Seed</dt><dd>{job.seed}</dd></div><div><dt>Model</dt><dd>{job.model}</dd></div><div><dt>Audio</dt><dd>{job.settings ? job.settings.generateAudio ? "Requested" : "Silent" : "Not recorded"}</dd></div></dl>
      {job.settings?.negativePrompt && <p className="comparison-avoid"><strong>Avoid:</strong> {job.settings.negativePrompt}</p>}
      <button className="library-button" onClick={() => download(job)}><ArrowDownToLine size={14} /> Download take {index === 0 ? "A" : "B"}</button>
    </article>)}</div>
  </dialog>;
}
