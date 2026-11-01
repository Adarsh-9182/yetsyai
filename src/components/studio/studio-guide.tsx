"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Camera, Clapperboard, Film, X } from "lucide-react";

export function StudioGuide({ close, start }: { close: () => void; start: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="account-dialog guide-dialog" aria-labelledby="guide-heading" onCancel={close}>
    <button className="icon-button account-close" aria-label="Close studio guide" onClick={close}><X size={20} /></button>
    <div className="eyebrow">FROM A SENTENCE TO A SCENE</div><h2 id="guide-heading">Your first take.</h2><p className="guide-intro">Keep it simple. Give one idea five seconds to shine.</p>
    <ol className="guide-steps">
      <li><span><Clapperboard size={21} /></span><div><h3>Write one clear scene</h3><p>A subject, an action, a place. Add a lighting cue or pick a look from Explore.</p></div></li>
      <li><span><Camera size={21} /></span><div><h3>Give it direction</h3><p>Choose a camera move, visual treatment and frame. Review the exact prompt in your shot brief.</p></div></li>
      <li><span><Film size={21} /></span><div><h3>Render, watch, refine</h3><p>Sign in to generate when rendering is available. Your silent MP4 is saved to your private library for playback and download.</p></div></li>
    </ol>
    <div className="guide-note">Free GPU time is shared and limited. A busy queue or exhausted quota can delay a take. Storyboards and drafts work while you wait.</div>
    <button className="generate-button" onClick={() => { close(); start(); }}>Let’s make a scene <ArrowRight size={16} /></button>
  </dialog>;
}
