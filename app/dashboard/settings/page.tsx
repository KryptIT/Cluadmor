"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LogOut, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  const [owner, setOwner] = useState<boolean | null>(null);
  const [ownerKey, setOwnerKey] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/owner/session", { cache: "no-store" });
    const data = await res.json();
    setOwner(!!data.owner);
    setConfigured(!!data.configured);
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
      setMessage("Owner mode enabled.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/owner/session", { method: "DELETE" });
    setOwner(false);
    setMessage("Owner mode disabled.");
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Workspace</span>
          <h1>Settings</h1>
          <p>Owner access and Claudmor workspace settings.</p>
        </div>
      </div>

      <section className="panelCard settingsPanel">
        <div className="panelTitle">
          <div><span className="iconBox"><ShieldCheck size={15}/></span><strong>Owner mode</strong></div>
          {owner === true && <span className="ownerBadge"><CheckCircle2 size={13}/> active</span>}
        </div>

        <div className="settingsBody">
          <p>
            Owner mode only bypasses Claudmor's monetization gates for your current workspace.
            It does not give you ownership of other users' services, keys, scripts, or provider settings.
          </p>

          {owner === true ? (
            <div className="ownerActive">
              <div>
                <strong>Owner session authenticated</strong>
                <small>The raw owner key is not stored in the browser. Reward checks are skipped for this workspace.</small>
              </div>
              <button className="secondaryBtn" onClick={logout}><LogOut size={14}/> Disable owner mode</button>
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
                  <button className="primaryBtn" disabled={busy || ownerKey.length < 1} onClick={activate}>
                    {busy ? "Checking..." : "Enable owner mode"}
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
        <strong>Vercel variable</strong>
        <p>Add <code>CLAUDMOR_OWNER_KEY</code> to Vercel's Production environment and redeploy after changing it. It can be any non-empty value, though a long random value is safer. Never prefix it with <code>NEXT_PUBLIC_</code>.</p>
      </section>
    </>
  );
}
