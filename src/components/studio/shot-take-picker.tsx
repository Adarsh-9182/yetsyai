"use client";

import { Play } from "lucide-react";
import type { SavedScene } from "@/lib/video/drafts";
import type { Generation } from "@/lib/video/types";

export function ShotTakePicker({ scene, position, jobs, choose, preview }: { scene: SavedScene; position: number; jobs: Generation[]; choose: (id: string | undefined) => void; preview: (job: Generation) => void }) {
  const takes = jobs.filter(job => job.sceneId === scene.id && job.status === "completed" && job.videoUrl).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const selected = takes.find(job => job.id === scene.preferredGenerationId);
  const missing = Boolean(scene.preferredGenerationId && !selected);
  const name = scene.title || `Scene ${position + 1}`;
  return <div className="shot-take-picker">
    <label htmlFor={`take-${scene.id}`}>PREFERRED TAKE</label>
    <div className="shot-take-controls"><select id={`take-${scene.id}`} aria-label={`Preferred take for ${name}`} value={scene.preferredGenerationId || ""} onChange={event => choose(event.target.value || undefined)}>
      <option value="">{scene.preferredGenerationId ? "No preferred take" : takes.length ? "Choose a take" : "No completed takes yet"}</option>
      {missing && <option value={scene.preferredGenerationId} disabled>Chosen take unavailable</option>}
      {takes.map((take, index) => <option key={take.id} value={take.id}>Take {index + 1} · {take.duration}s · Seed {take.seed}</option>)}
    </select><button className="library-button" disabled={!selected} onClick={() => { if (selected) preview(selected); }} aria-label={`Play preferred take for ${name}`}><Play size={13} /> Play</button></div>
    <p>{missing ? "This choice is no longer playable. Choose another take or clear the selection." : selected ? "Included in your sequence. Save your project to sync this choice." : "Choose a completed take to include this shot in your sequence."}</p>
  </div>;
}
