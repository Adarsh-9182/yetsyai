"use client";
import { FormEvent, useState } from "react";
export default function ResetPassword() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true);
    try {
      const password = new FormData(event.currentTarget).get("password");
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", password }) });
      const result = await response.json(); setMessage(result.message || result.error);
    } catch { setMessage("Connection interrupted. Please retry."); }
    finally { setPending(false); }
  }
  return <main className="account-page"><form className="account-form" onSubmit={submit}><a className="brand" href="/">yetsyai.</a><h1>A fresh start.</h1><p>Choose a new password for your studio.</p><label>New password<input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /></label><button className="generate-button" disabled={pending}>{pending ? "Saving…" : "Save password"}</button>{message && <p role="status">{message}</p>}<a href="/">Back to the studio →</a></form></main>;
}
