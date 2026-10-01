"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Aperture, X } from "lucide-react";

export function AccountDialog({ close, completed, configured, signedIn }: { close: () => void; completed: () => void; configured: boolean; signedIn: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<"signin" | "signup" | "reset">("signin");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: signedIn ? "signout" : action, ...(signedIn ? {} : { email: form.get("email"), ...(action !== "reset" ? { password: form.get("password") } : {}) }) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      setMessage(data.message); completed();
      if (signedIn || data.message === "You're signed in.") close();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connection interrupted. Please retry."); }
    finally { setPending(false); }
  }
  return <dialog ref={dialog} className="account-dialog" onCancel={close} aria-labelledby="account-heading"><button className="icon-button account-close" onClick={close} aria-label="Close account"><X size={20} /></button><div className="account-brand"><Aperture size={25} /> yetsyai.</div><form className="account-form" onSubmit={submit}><div className="eyebrow">YOUR CREATIVE SPACE</div><h2 id="account-heading">{signedIn ? "Your account." : action === "signup" ? "Make it yours." : action === "reset" ? "A fresh start." : "Welcome back."}</h2><p>{signedIn ? "Your videos stay in your account when you sign out." : "Save your scenes. Pick up where you left off, on any device."}</p>{!configured ? <div className="studio-message">Account access is opening soon. You can explore looks and save a draft on this device now.</div> : <>{!signedIn && <><label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></label>{action !== "reset" && <label>Password<input name="password" type="password" autoComplete={action === "signin" ? "current-password" : "new-password"} minLength={10} maxLength={128} placeholder="At least 10 characters" required /></label>}</>}<button className="generate-button" disabled={pending}>{pending ? "One moment…" : signedIn ? "Sign out" : action === "signup" ? "Create account" : action === "reset" ? "Send reset link" : "Enter your studio"}<ArrowUpRight size={17} /></button>{!signedIn && <div className="account-options"><button type="button" onClick={() => { setAction(action === "signup" ? "signin" : "signup"); setMessage(""); }}>{action === "signup" ? "Already have an account? Sign in" : "New here? Create account"}</button><button type="button" onClick={() => { setAction("reset"); setMessage(""); }}>Forgot password?</button></div>}</>}{message && <p className="account-message" role="status">{message}</p>}</form></dialog>;
}
