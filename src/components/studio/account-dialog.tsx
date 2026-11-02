"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Aperture, Check, Eye, EyeOff, Github, LockKeyhole, Mail, X } from "lucide-react";

type Action = "signin" | "signup" | "reset";

export function AccountDialog({ close, completed, configured, signedIn, initialMessage = "" }: { close: () => void; completed: () => void; configured: boolean; signedIn: boolean; initialMessage?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [action, setAction] = useState<Action>("signin");
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [failed, setFailed] = useState(Boolean(initialMessage));
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialError, setSocialError] = useState(false);
  const [socialRevision, setSocialRevision] = useState(0);
  const [redirectingProvider, setRedirectingProvider] = useState<string | null>(null);

  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  useEffect(() => {
    if (!configured || signedIn) { setSocialLoading(false); return; }
    const controller = new AbortController();
    setSocialLoading(true); setSocialError(false);
    fetch("/api/account/oauth", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error();
      if (!controller.signal.aborted) setProviders({ google: data.providers?.google === true, github: data.providers?.github === true });
    }).catch(() => { if (!controller.signal.aborted) { setProviders({ google: false, github: false }); setSocialError(true); } }).finally(() => { if (!controller.signal.aborted) setSocialLoading(false); });
    return () => controller.abort();
  }, [configured, signedIn, socialRevision]);
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    fetch("/api/account", { cache: "no-store", signal: controller.signal }).then(response => response.json()).then(data => { if (!controller.signal.aborted) setAccountEmail(data.user?.email || ""); }).catch(() => {});
    return () => controller.abort();
  }, [signedIn]);

  const changeAction = (next: Action) => { setAction(next); setMessage(""); setFailed(false); setShowPassword(false); setConfirmationSent(false); };

  async function socialSignIn(provider: "google" | "github") {
    if (submitting.current) return;
    submitting.current = true; setPending(true); setMessage(""); setFailed(false); setRedirectingProvider(provider);
    let navigating = false;
    try {
      const response = await fetch("/api/account/oauth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }), signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't start sign-in. Please retry.");
      const destination = new URL(data.url);
      if (destination.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin || destination.pathname !== "/auth/v1/authorize") throw new Error("Couldn't open secure sign-in. Please retry.");
      window.location.assign(destination.href);
      navigating = true;
    } catch (error) { setFailed(true); setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Sign-in took too long. Please retry."); }
    finally { if (!navigating) { submitting.current = false; setPending(false); setRedirectingProvider(null); } }
  }

  async function send(body: Record<string, unknown>) {
    if (submitting.current) return;
    submitting.current = true; setPending(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      setMessage(data.message);
      if (body.action === "signup" || body.action === "resend") setConfirmationSent(true);
      if (signedIn || data.signedIn) {
        try { localStorage.setItem("yetsyai-account-change", crypto.randomUUID()); } catch { /* Storage is optional. */ }
        completed(); close();
      }
    } catch (error) { setFailed(true); setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "The connection took too long. Please retry."); }
    finally { submitting.current = false; setPending(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await send({ action: signedIn ? "signout" : action, ...(signedIn ? {} : { email: email.trim(), ...(action !== "reset" ? { password: form.get("password") } : {}) }) });
  }

  return <dialog ref={dialog} className="account-dialog" onCancel={close} aria-labelledby="account-heading">
    <button className="icon-button account-close" onClick={close} aria-label="Close account"><X size={20} /></button>
    <div className="account-brand"><Aperture size={25} /> yetsyai.</div>
    <form className="account-form" onSubmit={submit} aria-busy={pending}>
      <div className="eyebrow">YOUR CREATIVE SPACE</div>
      <h2 id="account-heading">{signedIn ? "Your studio, everywhere." : action === "signup" ? "Make room for your ideas." : action === "reset" ? "A fresh start." : "Welcome to your studio."}</h2>
      <p>{signedIn ? accountEmail || "Your videos and saved projects stay in your account." : action === "reset" ? "We’ll email you a secure link to choose a new password." : "Keep your videos, references and saved projects together, on every device."}</p>
      {!configured ? <div className="studio-message">Account access is unavailable. You can still write shots and export a storyboard on this device.</div> : <>
        {!signedIn && <>
          {action !== "reset" && <div className="account-tabs" aria-label="Account access"><button type="button" disabled={pending} aria-pressed={action === "signin"} onClick={() => changeAction("signin")}>Sign in</button><button type="button" disabled={pending} aria-pressed={action === "signup"} onClick={() => changeAction("signup")}>Create account</button></div>}
          {action !== "reset" && <><div className="social-sign-in" aria-label="Social sign-in"><button type="button" disabled={pending || socialLoading || !providers.google} onClick={() => void socialSignIn("google")}><span className="google-mark" aria-hidden="true">G</span>{redirectingProvider === "google" ? "Opening Google…" : "Continue with Google"}{!socialLoading && !providers.google && <small>Unavailable</small>}</button><button type="button" disabled={pending || socialLoading || !providers.github} onClick={() => void socialSignIn("github")}><Github size={18} aria-hidden="true" />{redirectingProvider === "github" ? "Opening GitHub…" : "Continue with GitHub"}{!socialLoading && !providers.github && <small>Unavailable</small>}</button></div><div className="social-status" aria-live="polite">{socialLoading ? "Checking sign-in options…" : socialError ? <>Couldn’t check social sign-in. <button type="button" onClick={() => setSocialRevision(value => value + 1)} disabled={pending}>Retry</button></> : !providers.google || !providers.github ? "Unavailable options will open when connected. You can sign in with email below." : "Use your Google or GitHub account. No separate password needed."}</div><div className="account-divider"><span />or use email<span /></div></>}
          <label>Email address<span className="account-input"><Mail size={16} /><input name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" required disabled={pending} /></span></label>
          {action !== "reset" && <label>Password<span className="account-input"><LockKeyhole size={16} /><input name="password" type={showPassword ? "text" : "password"} autoComplete={action === "signin" ? "current-password" : "new-password"} minLength={action === "signup" ? 10 : 1} maxLength={128} placeholder={action === "signup" ? "At least 10 characters" : "Your password"} required disabled={pending} /><button type="button" className="icon-button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>}
        </>}
        <button className="generate-button" disabled={pending}>{pending ? <><span className="spinner" /> One moment…</> : <>{signedIn ? "Sign out" : action === "signup" ? "Create free account" : action === "reset" ? "Send reset link" : "Enter your studio"}<ArrowUpRight size={17} /></>}</button>
        {!signedIn && <div className="account-options"><button type="button" disabled={pending} onClick={() => changeAction(action === "reset" ? "signin" : "reset")}>{action === "reset" ? "Back to sign in" : "Forgot password?"}</button>{action !== "reset" && <button type="button" disabled={pending || !email.trim()} onClick={() => void send({ action: "resend", email: email.trim() })}>Resend confirmation</button>}</div>}
      </>}
      {message && <div className={`account-feedback ${failed ? "account-feedback-error" : ""}`} role={failed ? "alert" : "status"}>{!failed && <Check size={16} />}<span>{message}{confirmationSent && !failed && <small>Check your spam folder too. Open the latest link from your inbox, then sign in here.</small>}</span></div>}
      {!signedIn && <div className="account-privacy"><LockKeyhole size={13} /> Your library is private. No card required.</div>}
    </form>
  </dialog>;
}
