"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  PlugZap,
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

type ConfigStatus = {
  googleOAuth: boolean;
  discordOAuth: boolean;
  claudiumApi: boolean;
  ownerAccess: boolean;
};

const emptyConfig: ConfigStatus = {
  googleOAuth: false,
  discordOAuth: false,
  claudiumApi: false,
  ownerAccess: false
};

export default function SettingsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [owner, setOwner] = useState<boolean | null>(null);
  const [ownerKey, setOwnerKey] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [config, setConfig] = useState<ConfigStatus>(emptyConfig);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [ownerRes, sessionRes, configRes] = await Promise.all([
      fetch("/api/owner/session", { cache: "no-store" }),
      fetch("/api/account/session", { cache: "no-store" }),
      fetch("/api/config/status", { cache: "no-store" })
    ]);

    if (ownerRes.ok) {
      const data = await ownerRes.json();
      setOwner(!!data.owner);
      setConfigured(!!data.configured);
    }

    if (sessionRes.ok) {
      setSession(await sessionRes.json());
    }

    if (configRes.ok) {
      const data = await configRes.json();
      setConfig({
        googleOAuth: !!data.googleOAuth,
        discordOAuth: !!data.discordOAuth,
        claudiumApi: !!data.claudiumApi,
        ownerAccess: !!data.ownerAccess
      });
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
            ? "Owner access is not configured for this deployment."
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

  const configRows = [
    { label: "Google OAuth", detail: "Google account sign-in", ready: config.googleOAuth },
    { label: "Discord OAuth", detail: "Discord account sign-in", ready: config.discordOAuth },
    { label: "Claudium API", detail: "Protected build backend", ready: config.claudiumApi },
    { label: "Owner access", detail: "Owner bypass authentication", ready: config.ownerAccess }
  ];

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Workspace</span>
          <h1>Settings</h1>
          <p>Account, owner access, and deployment connections.</p>
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
            <span className="iconBox"><PlugZap size={15}/></span>
            <strong>Configuration</strong>
          </div>
        </div>

        <div className="settingsBody">
          <div className="configStatusGrid">
            {configRows.map(row => (
              <div className="configStatusRow" key={row.label}>
                <div>
                  <strong>{row.label}</strong>
                  <small>{row.detail}</small>
                </div>

                <span className={row.ready ? "configReady" : "configMissing"}>
                  {row.ready ? "ready" : "not configured"}
                </span>
              </div>
            ))}
          </div>

          <p className="configPrivacyNote">
            Claudmor only shows connection status here. Credentials and secrets stay on the server and are never displayed in the browser.
          </p>
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
                Owner access key
                <div className="ownerKeyRow">
                  <div className="ownerKeyInput">
                    <KeyRound size={14}/>
                    <input
                      type="password"
                      value={ownerKey}
                      onChange={e => setOwnerKey(e.target.value)}
                      placeholder="Enter owner access key"
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
              Owner access is not configured for this deployment. Add the owner key in your hosting provider's production settings, then redeploy.
            </div>
          )}

          {message && <div className="settingsMessage">{message}</div>}
        </div>
      </section>

      <section className="hintCard">
        <strong>Sign-in providers</strong>
        <p>Google OAuth and Discord OAuth are configured server-side. Claudmor never shows their private credentials in the dashboard.</p>
      </section>

      <section className="hintCard">
        <strong>Deployment security</strong>
        <p>Keep authentication, database, reward-provider, and Claudium credentials private on the server. The website only reports whether supported connections are ready.</p>
      </section>
    </>
  );
}
