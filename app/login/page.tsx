"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, KeyRound, LogIn, UserPlus } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(mode === "login" ? "/api/account/login" : "/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Authentication failed.");
        return;
      }
      window.location.href = "/dashboard";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authPanel">
        <Link href="/" className="authBrand">
          <img src="/claudmor-mark.svg" alt="" />
          <div><strong>Claudmor</strong><span>workspace account</span></div>
        </Link>

        <div className="authTabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>

        <div className="authCopy">
          <h1>{mode === "login" ? "Sign in" : "Create your workspace"}</h1>
          <p>
            {mode === "login"
              ? "Open your own services, scripts, keys, and loader routes."
              : "Each account gets its own isolated Claudmor workspace."}
          </p>
        </div>

        <div className="authForm">
          <label>
            Username
            <input
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              placeholder="username"
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8+ characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
            />
          </label>

          <button
            className="primaryBtn authSubmit"
            disabled={busy || username.length < 3 || password.length < 8}
            onClick={submit}
          >
            {mode === "login" ? <LogIn size={15}/> : <UserPlus size={15}/>}
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>

          {message && <div className="formError">{message}</div>}
        </div>

        <div className="authFoot">
          <span>Owner of Claudmor?</span>
          <Link href="/dashboard/settings">Use the owner bypass <ArrowRight size={13}/></Link>
        </div>
      </section>
    </main>
  );
}
