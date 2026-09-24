"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserRound
} from "lucide-react";

type Session = {
  authenticated: boolean;
  ownerBypass?: boolean;
  user?: {
    username: string;
    display_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  };
};

export default function SettingsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [owner, setOwner] = useState<boolean | null>(null);
  const [ownerKey, setOwnerKey] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [ownerRes, sessionRes] = await Promise.all([
      fetch("/api/owner/session", { cache: "no-store" }),
      fetch("/api/account/session", { cache: "no-store" })
    ]);

    if (ownerRes.ok) {
      const data = await ownerRes.json();
      setOwner(!!data.owner);
      setConfigured(!!data.configured);
    }

    if (sessionRes.ok) {
      setSession(await sessionRes.json());
    }
  }

  useEffect(() => { refresh(); }, []);

  async function activate() {
    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/owner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerKey })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(
          data.error === "owner_key_not_configured"
            ? "CLAUDMOR_OWNER_KEY is not configured on Vercel."
            : data.error === "login_required"
              ? "Sign in with Google or Discord before enabling owner mode."
              : "Owner key rejected."
        );
        return;
      }

      setOwnerKey("");
      setOwner(true);
      setMessage("Owner bypass enabled for this account.");
    } finally {
      setBusy(false);
    }
  }

  async function disableOwner() {
    await fetch("/api/owner/session", { method: "DELETE" });
    setOwner(false);
    setMessage("Owner bypass disabled.");
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/account/session", { method: "DELETE" });
      window.location.href = "/login";
    } finally {
      setBusy(false);
    }
  }

  const profileName =
    session?.user?.display_name ||
    session?.user?.email ||
    session?.user?.username ||
    "Claudmor account";

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Workspace</span>
          <h1>Settings</h1>
          <p>Account, owner bypass, and deployment configuration.</p>
        </div>
      </div>

      <section className="panelCard settingsPanel">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><UserRound size={15}/></span>
            <strong>Account</strong>
          </div>

          {session?.authenticated && (
            <span className="ownerBadge">
              <CheckCircle2 size={13}/> signed in
            </span>
          )}
        </div>

        <div className="settingsBody">
          {session?.authenticated ? (
            <div className="accountSettingsRow">
              <div className="accountIdentity">
                {session.user?.avatar_url ? (
                  <img src={session.user.avatar_url} alt="" />
                ) : (
                  <span className="accountAvatarFallback"><UserRound size={16}/></span>
                )}

                <div>
                  <strong>{profileName}</strong>
                  <small>{session.user?.email || "Google / Discord workspace account"}</small>
                </div>
              </div>

              <button className="secondaryBtn" disabled={busy} onClick={signOut}>
                <LogOut size={14}/> Sign out
              </button>
            </div>
          ) : (
            <div className="ownerNotice">
              <div>
                <strong>Not signed in</strong>
                <span>Use Google or Discord to open a Claudmor workspace.</span>
              </div>
              <Link className="secondaryBtn" href="/login">Sign in</Link>
            </div>
          )}
        </div>
      </section>

      <section className="panelCard settingsPanel settingsPanelGap">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><ShieldCheck size={15}/></span>
            <strong>Owner bypass</strong>
          </div>

          {owner === true && (
            <span className="ownerBadge">
              <CheckCircle2 size={13}/> active
            </span>
          )}
        </div>

        <div className="settingsBody">
          <p>
            Owner bypass only skips Claudmor reward and token gates for the
            currently signed-in account. It never grants access to another
            user's services, scripts, keys, providers, loaders, or telemetry.
          </p>

          {owner === true ? (
            <div className="ownerActive">
              <div>
                <strong>Owner bypass authenticated</strong>
                <small>Service creation and script re-obfuscation do not consume rewards or tokens for this account.</small>
              </div>

              <button className="secondaryBtn" onClick={disableOwner}>
                <LogOut size={14}/> Disable owner bypass
              </button>
            </div>
          ) : (
            <div className="ownerLogin">
              <label>
                Owner key
                <div className="ownerKeyRow">
                  <div className="ownerKeyInput">
                    <KeyRound size={14}/>
                    <input
                      type="password"
                      value={ownerKey}
                      onChange={e => setOwnerKey(e.target.value)}
                      placeholder="CLAUDMOR_OWNER_KEY"
                      onKeyDown={e => { if (e.key === "Enter") activate(); }}
                    />
                  </div>

                  <button
                    className="primaryBtn"
                    disabled={busy || !session?.authenticated || ownerKey.length < 1}
                    onClick={activate}
                  >
                    {busy ? "Checking..." : "Enable owner bypass"}
                  </button>
                </div>
              </label>
            </div>
          )}

          {configured === false && (
            <div className="formError">
              CLAUDMOR_OWNER_KEY is not loaded by this deployment. Add it to the Production environment in Vercel, then redeploy.
            </div>
          )}

          {message && <div className="settingsMessage">{message}</div>}
        </div>
      </section>

      <section className="hintCard">
        <strong>OAuth environment</strong>
        <p>Google uses <code>GOOGLE_CLIENT_ID</code> + <code>GOOGLE_CLIENT_SECRET</code>. Discord uses <code>DISCORD_CLIENT_ID</code> + <code>DISCORD_CLIENT_SECRET</code>. Keep every secret server-side.</p>
      </section>

      <section className="hintCard">
        <strong>Owner variable</strong>
        <p><code>CLAUDMOR_OWNER_KEY</code> can be any non-empty value, including your existing 8-character key. Add it to Vercel Production exactly as the key itself, without extra quotes, then redeploy. Never prefix it with <code>NEXT_PUBLIC_</code>.</p>
      </section>
    </>
  );
}
