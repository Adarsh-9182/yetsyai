"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, Copy, FolderOpen, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { SavedScene } from "@/lib/video/drafts";
import { ProjectSummary, SavedProject } from "@/lib/video/projects";

type Props = { scenes: SavedScene[]; replaceScenes: (scenes: SavedScene[]) => void; enabled: boolean; hidden: boolean; signIn: () => void };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: init?.signal || AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Couldn't reach your projects. Your local storyboard is kept.");
  return data;
}

export function ProjectLibrary({ scenes, replaceScenes, enabled, hidden, signIn }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selected, setSelected] = useState<ProjectSummary | null>(null);
  const [title, setTitle] = useState("Untitled film");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const owner = useRef<string | null>(null);
  const epoch = useRef(0);
  const loadVersion = useRef(0);
  const actionLock = useRef(false);
  const pendingCreate = useRef<{ id: string; content: string } | null>(null);
  const content = JSON.stringify({ title: title.trim(), scenes });
  const dirty = selected ? content !== savedContent : scenes.length > 0;

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    const version = ++loadVersion.current;
    const started = epoch.current;
    setLoading(true);
    try {
      const data = await request<{ projects: ProjectSummary[]; owner: string }>("/api/projects", { signal });
      if (signal?.aborted || version !== loadVersion.current || started !== epoch.current) return;
      if (owner.current && owner.current !== data.owner) {
        epoch.current++;
        actionLock.current = false; setBusy(false); pendingCreate.current = null;
        setSelected(null); setSavedContent(""); setTitle("Untitled film"); setDeleteId(null);
        setMessage("Account changed. Choose a project from this account.");
      }
      owner.current = data.owner;
      setProjects(data.projects); setError("");
    } catch (reason) {
      if (!signal?.aborted && version === loadVersion.current && started === epoch.current) setError(reason instanceof Error ? reason.message : "Couldn't load projects.");
    } finally {
      if (!signal?.aborted && version === loadVersion.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    epoch.current++; loadVersion.current++; actionLock.current = false;
    setProjects([]); setSelected(null); setSavedContent(""); setTitle("Untitled film");
    setError(""); setMessage(""); setDeleteId(null); setBusy(false); setLoading(false);
    owner.current = null; pendingCreate.current = null;
    if (!enabled) return;
    const controller = new AbortController();
    void reload(controller.signal);
    const refresh = () => { if (document.visibilityState !== "hidden" && !actionLock.current) void reload(controller.signal); };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [enabled, reload]);

  async function run(action: (started: number) => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError(""); setMessage(""); setDeleteId(null);
    const started = epoch.current;
    try { await action(started); }
    catch (reason) { if (started === epoch.current) setError(reason instanceof Error ? reason.message : "Couldn't save your project. Your storyboard is kept on this device."); }
    finally { if (started === epoch.current) { actionLock.current = false; setBusy(false); } }
  }

  function save(asNew = false) {
    if (!enabled) { signIn(); return; }
    if (!title.trim()) { setError("Give your project a name."); return; }
    const snapshot = { title: title.trim(), scenes };
    const signature = JSON.stringify(snapshot);
    if ((!selected || asNew) && pendingCreate.current?.content !== signature) pendingCreate.current = { id: crypto.randomUUID(), content: signature };
    const id = selected && !asNew ? selected.id : pendingCreate.current!.id;
    const revision = selected && !asNew ? selected.revision : 0;
    void run(async started => {
      const data = await request<{ project: ProjectSummary }>("/api/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, id, revision }) });
      if (started !== epoch.current) return;
      setSelected(data.project); setSavedContent(signature); setTitle(snapshot.title); pendingCreate.current = null;
      setProjects(current => [data.project, ...current.filter(project => project.id !== data.project.id)].slice(0, 20));
      setMessage("Saved to your account. Open it on another device from Storyboard.");
    });
  }

  function open(project: ProjectSummary) {
    if ((dirty || (!selected && scenes.length > 0)) && !window.confirm("Open this project and replace the current storyboard? Save or export your current shots first if you want to keep them.")) return;
    void run(async started => {
      const data = await request<{ project: SavedProject }>(`/api/projects?id=${project.id}`);
      if (started !== epoch.current) return;
      replaceScenes(data.project.scenes); setSelected(data.project); setTitle(data.project.title);
      setSavedContent(JSON.stringify({ title: data.project.title, scenes: data.project.scenes })); pendingCreate.current = null;
      setProjects(current => current.map(item => item.id === data.project.id ? { ...item, revision: data.project.revision, sceneCount: data.project.sceneCount, updatedAt: data.project.updatedAt } : item));
      setMessage("Project opened. Edit your shots, then save changes to sync them.");
    });
  }

  function remove(project: ProjectSummary) {
    if (deleteId !== project.id) { setDeleteId(project.id); return; }
    void run(async started => {
      await request("/api/projects", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: project.id, revision: project.revision }) });
      if (started !== epoch.current) return;
      setProjects(current => current.filter(item => item.id !== project.id));
      if (selected?.id === project.id) { setSelected(null); setSavedContent(""); pendingCreate.current = null; }
      setMessage("Project removed from your account. Current local shots and rendered videos are kept.");
    });
  }

  function newProject() {
    if (scenes.length && !window.confirm("Start an empty storyboard? Save or export the current shots first if you want to keep them.")) return;
    replaceScenes([]); setSelected(null); setSavedContent(""); setTitle("Untitled film");
    setError(""); setMessage(""); setDeleteId(null); pendingCreate.current = null;
  }

  return <section className="project-library" style={hidden ? { display: "none" } : undefined} aria-labelledby="projects-title">
    <div className="project-heading"><div><span className="eyebrow"><Cloud size={14} /> YOUR ACCOUNT</span><h2 id="projects-title">Your films, wherever you work.</h2><p>Save named storyboards and open them on another device. Save again after editing.</p></div><button className="library-button" disabled={busy} onClick={newProject}><Plus size={14} /> New project</button></div>
    <div className="project-composer"><label htmlFor="project-name">PROJECT NAME<input id="project-name" maxLength={80} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="Name your film" /></label><div className="project-save-actions"><button className="generate-button" disabled={busy || loading || !title.trim()} onClick={() => save()}><Save size={15} />{busy ? "Working…" : selected ? "Save changes" : "Save project"}</button>{selected && <button className="library-button" disabled={busy || loading} onClick={() => save(true)}><Copy size={14} /> Save as new</button>}</div></div>
    <div className="project-state" aria-live="polite">{!enabled ? "Your shots stay on this device. Sign in to save a project to your account." : selected ? dirty ? "Unsaved project changes · local shots are kept" : "Project saved to your account" : "Local storyboard · save a project to sync your shots"}</div>
    {error && <p className="project-error" role="alert">{error} <button disabled={busy || loading} onClick={() => void reload()}>Refresh projects</button></p>}
    {message && <p className="project-message" role="status">{message}</p>}
    {enabled && <><div className="project-list-heading"><span>{projects.length} / 20 saved projects</span><button className="library-button" disabled={busy || loading} onClick={() => void reload()}><RefreshCw size={13} />{loading ? "Loading…" : "Refresh"}</button></div>{projects.length ? <div className="project-grid">{projects.map(project => <article key={project.id} className={`project-card ${selected?.id === project.id ? "project-selected" : ""}`}><div className="project-card-top"><FolderOpen size={20} /><span>{project.sceneCount} {project.sceneCount === 1 ? "shot" : "shots"}</span></div><h3>{project.title}</h3><p>Saved {new Date(project.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p><div className="project-card-actions"><button className="library-button" disabled={busy || loading} onClick={() => open(project)}>Open storyboard</button><button className={`icon-button ${deleteId === project.id ? "project-delete-confirm" : ""}`} disabled={busy || loading} onClick={() => remove(project)} aria-label={deleteId === project.id ? `Confirm removal of ${project.title}` : `Remove project ${project.title}`}><Trash2 size={14} />{deleteId === project.id && "Confirm"}</button></div></article>)}</div> : !loading && <p className="project-empty">Your first saved film starts with the storyboard below.</p>}</>}
  </section>;
}
