"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Film, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import type { Generation } from "@/lib/video/types";
import type { SequenceShot } from "@/lib/video/sequence";

export type PlayableShot = SequenceShot & { generation: Generation };

export function SequencePreview({ shots, close }: { shots: PlayableShot[]; close: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const current = shots[index];
  useEffect(() => {
    const dialog = dialogRef.current, video = player.current;
    dialog?.showModal();
    return () => { video?.pause(); dialog?.close(); };
  }, []);
  useEffect(() => {
    const video = player.current;
    if (!video) return;
    let cancelled = false;
    setError("");
    video.load();
    void video.play().catch(() => { if (!cancelled && !video.error) setError("Press play in the video controls to continue the preview."); });
    return () => { cancelled = true; video.pause(); };
  }, [current.generation.id, current.generation.videoUrl]);
  const jump = (next: number) => {
    if (next < 0 || next >= shots.length) return;
    setFinished(false);
    if (next === index) { const video = player.current; if (video) { video.currentTime = 0; void video.play().catch(() => setError("Press play in the video controls to restart.")); } }
    else setIndex(next);
  };
  const duration = shots.reduce((total, shot) => total + shot.generation.duration, 0);
  return <dialog ref={dialogRef} className="preview-dialog sequence-dialog" onCancel={close} aria-labelledby="sequence-title">
    <div className="preview-heading"><div><span className="eyebrow">YOUR FILM, TAKING SHAPE</span><h2 id="sequence-title">Preview your sequence.</h2></div><button className="icon-button" onClick={close} aria-label="Close sequence preview"><X size={19} /></button></div>
    <p className="sequence-intro">Your selected takes, played in storyboard order. This preview does not create a combined video file.</p>
    <div className="sequence-stage"><video ref={player} src={current.generation.videoUrl!} controls playsInline muted={muted} preload="metadata" onVolumeChange={event => setMuted(event.currentTarget.muted)} onPlay={() => { setFinished(false); setError(""); }} onEnded={() => { if (index + 1 < shots.length) jump(index + 1); else setFinished(true); }} onError={() => setError("This take couldn't be loaded. Close the preview and refresh your library to check its link.")} /></div>
    <div className="sequence-current"><div><span>SHOT {String(index + 1).padStart(2, "0")} / {String(shots.length).padStart(2, "0")}</span><h3>{current.scene.title || `Scene ${index + 1}`}</h3></div><button className="library-button" onClick={() => setMuted(value => !value)}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}{muted ? "Sound off" : "Sound on"}</button></div>
    <p className="sequence-shot-prompt">{current.generation.prompt}</p>
    {error && <p className="inline-error" role="status">{error}</p>}
    {finished && <div className="sequence-finished" role="status"><Film size={17} /><span>That’s your sequence. Refine a shot or try another take.</span><button className="library-button" onClick={() => jump(0)}><RotateCcw size={14} /> Replay sequence</button></div>}
    <div className="sequence-controls"><button className="library-button" disabled={index === 0} onClick={() => jump(index - 1)}><ChevronLeft size={15} /> Previous shot</button><span>{duration}s selected · {shots.length} shots</span><button className="library-button" disabled={index === shots.length - 1} onClick={() => jump(index + 1)}>Next shot <ChevronRight size={15} /></button></div>
    <ol className="sequence-strip" aria-label="Sequence shots">{shots.map((shot, position) => <li key={shot.scene.id}><button aria-label={`Preview shot ${position + 1}: ${shot.scene.title || `Scene ${position + 1}`}`} aria-current={position === index ? "step" : undefined} onClick={() => jump(position)}><span>{String(position + 1).padStart(2, "0")}</span><strong>{shot.scene.title || `Scene ${position + 1}`}</strong><small>{shot.generation.duration}s · Seed {shot.generation.seed}</small></button></li>)}</ol>
  </dialog>;
}
