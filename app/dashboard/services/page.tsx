"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Boxes, Check, KeyRound, Plus, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";

type Service = {
  id: string;
  name: string;
  enabled: boolean;
  key_system_enabled: boolean;
  key_ui_mode: "DEFAULT" | "CUSTOM";
  require_hwid: boolean;
  require_roblox_user_id: boolean;
  require_roblox_username: boolean;
  require_discord_user_id: boolean;
  created_at: string;
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [ownerBypass, setOwnerBypass] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [keySystemEnabled, setKeySystemEnabled] = useState(true);
  const [keyUiMode, setKeyUiMode] = useState<"DEFAULT" | "CUSTOM">("DEFAULT");
  const [locks, setLocks] = useState({
    hwid: true,
    robloxUserId: false,
    robloxUsername: false,
    discordUserId: false
  });
  const [message, setMessage] = useState("");

  async function loadServices() {
    const res = await fetch("/api/workspace/services", { cache: "no-store" });
    if (res.status === 401) {
      setAuthenticated(false);
      setServices([]);
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setAuthenticated(res.status === 401 ? false : null);
      setServices([]);
      setMessage(data.detail || data.error || "Could not load services.");
      return;
    }
    setAuthenticated(true);
    setOwnerBypass(!!data.ownerBypass);
    setServices(data.services || []);
  }

  useEffect(() => { loadServices(); }, []);

  async function getServiceUnlock() {
    setBusy("reward");
    setMessage("");
    try {
      const res = await fetch("/api/rewards/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SERVICE_CREATION" })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.detail || data.error || "Could not start reward flow.");
        return;
      }
      if (data.bypass) {
        setOwnerBypass(true);
        setMessage("Owner bypass active.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy("");
    }
  }

  async function updateService(serviceId: string, patch: Record<string, unknown>) {
    setBusy(serviceId);
    setMessage("");
    try {
      const res = await fetch("/api/workspace/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, ...patch })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not update service.");
        return;
      }
      await loadServices();
    } finally {
      setBusy("");
    }
  }

  async function createService() {
    if (!name.trim()) return;
    setBusy("create");
    setMessage("");
    try {
      const res = await fetch("/api/workspace/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          keySystemEnabled,
          keyUiMode,
          requireHwid: locks.hwid,
          requireRobloxUserId: locks.robloxUserId,
          requireRobloxUsername: locks.robloxUsername,
          requireDiscordUserId: locks.discordUserId
        })
      });
      const data = await res.json();
      if (res.status === 402 && data.error === "service_creation_credit_required") {
        setMessage("One service unlock is required. Complete the LootLabs step, then create the service.");
        return;
      }
      if (!res.ok) {
        setMessage(data.detail || data.error || "Could not create service.");
        return;
      }
      setName("");
      setKeySystemEnabled(true);
      setKeyUiMode("DEFAULT");
      setCreating(false);
      await loadServices();
    } finally {
      setBusy("");
    }
  }


  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Key system</span>
          <h1>Services</h1>
          <p>Every account owns its own services, scripts, keys, providers, and loader routes.</p>
        </div>
        <button className="primaryBtn" disabled={authenticated !== true} onClick={() => setCreating(true)}>
          <Plus size={14} /> New service
        </button>
      </div>

      {authenticated === null && message && (
        <div className="formError pageError">{message}</div>
      )}

      {authenticated === false && (
        <div className="notice ownerNotice">
          <div>
            <strong>Sign in to your Claudmor account.</strong>
            <span>Normal users can create and manage their own services. Owner mode is only a reward bypass.</span>
          </div>
          <Link className="secondaryBtn" href="/login"><KeyRound size={14}/> Sign in</Link>
        </div>
      )}

      {authenticated === true && ownerBypass && (
        <div className="notice ownerNotice">
          <div>
            <strong>Owner bypass active.</strong>
            <span>Service creation will not consume a LootLabs unlock in this browser session.</span>
          </div>
          <Link className="secondaryBtn" href="/dashboard/settings">Settings</Link>
        </div>
      )}


      {creating && authenticated === true && (
        <section className="panelCard createPanel">
          <div className="panelTitle">
            <div><span className="iconBox"><Plus size={15}/></span><strong>Create service</strong></div>
            <button className="iconButton" onClick={() => setCreating(false)}><X size={15}/></button>
          </div>

          <div className="createServiceForm">
            <label>
              Service name
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Magnify Hub" maxLength={80}/>
            </label>

            <div>
              <span className="fieldLabel">Key system</span>
              <div className="keySystemSetup">
                <label className="keySystemToggle">
                  <input
                    type="checkbox"
                    checked={keySystemEnabled}
                    onChange={e => setKeySystemEnabled(e.target.checked)}
                  />
                  <span>{keySystemEnabled ? "Enabled" : "Disabled"}</span>
                </label>

                <select
                  className="input"
                  value={keyUiMode}
                  disabled={!keySystemEnabled}
                  onChange={e => setKeyUiMode(e.target.value as "DEFAULT" | "CUSTOM")}
                >
                  <option value="DEFAULT">Default Claudmor UI</option>
                  <option value="CUSTOM">Custom UI / library</option>
                </select>

                <Link className="secondaryBtn" href="/dashboard/key-ui">Key UI library</Link>
              </div>
            </div>

            <div>
              <span className="fieldLabel">Required bindings</span>
              <div className="lockChoices">
                <label><input type="checkbox" checked={locks.hwid} onChange={e => setLocks(v => ({...v, hwid:e.target.checked}))}/><span><ShieldCheck size={15}/> HWID</span></label>
                <label><input type="checkbox" checked={locks.robloxUserId} onChange={e => setLocks(v => ({...v, robloxUserId:e.target.checked}))}/><span>Roblox UserId</span></label>
                <label><input type="checkbox" checked={locks.robloxUsername} onChange={e => setLocks(v => ({...v, robloxUsername:e.target.checked}))}/><span>Roblox username</span></label>
                <label><input type="checkbox" checked={locks.discordUserId} onChange={e => setLocks(v => ({...v, discordUserId:e.target.checked}))}/><span>Discord UserId</span></label>
              </div>
            </div>

            <div className="row">
              <button className="primaryBtn" disabled={busy !== "" || name.trim().length < 2} onClick={createService}>
                {busy === "create" ? <RefreshCw size={14} className="spin"/> : <Check size={14}/>}
                {busy === "create" ? "Creating..." : "Create service"}
              </button>
              {!ownerBypass && (
                <button className="secondaryBtn" disabled={busy !== ""} onClick={getServiceUnlock}>
                  <Sparkles size={14}/> Get 1 service unlock
                </button>
              )}
              <button className="secondaryBtn" onClick={() => setCreating(false)}>Cancel</button>
            </div>
            {message && <div className="formError">{message}</div>}
          </div>
        </section>
      )}

      <section className="panelCard">
        <div className="toolbar">
          <div><strong>Services</strong><span className="pill">{services.length} total</span></div>
          <button className="secondaryBtn" onClick={loadServices}><RefreshCw size={13}/> Refresh</button>
        </div>

        {services.length === 0 ? (
          <div className="emptyState large">
            <div className="emptyIcon"><Boxes size={18}/></div>
            <strong>No services</strong>
            <p>{authenticated === false ? "Sign in first." : "Create your first service, then add scripts, keys, providers, and loader routes."}</p>
            {authenticated === true && <button className="primaryBtn" onClick={() => setCreating(true)}><Plus size={14}/> Create service</button>}
          </div>
        ) : (
          <div className="serviceList">
            {services.map(service => (
              <article className="serviceRow" key={service.id}>
                <div className="serviceMark"><Boxes size={17}/></div>
                <div className="serviceMain">
                  <strong>{service.name}</strong>
                  <small>{service.id}</small>
                </div>
                <div className="serviceLocks">
                  <span className={service.key_system_enabled ? "keyBadgeOn" : "keyBadgeOff"}>
                    {service.key_system_enabled ? "Keys on" : "Keys off"}
                  </span>
                  {service.key_system_enabled && <span>{service.key_ui_mode === "DEFAULT" ? "Default UI" : "Custom UI"}</span>}
                  {service.require_hwid && <span>HWID</span>}
                  {service.require_roblox_user_id && <span>Roblox ID</span>}
                  {service.require_roblox_username && <span>Roblox name</span>}
                  {service.require_discord_user_id && <span>Discord ID</span>}
                </div>
                <div className="serviceActions">
                  <button
                    className="secondaryBtn"
                    disabled={busy !== ""}
                    onClick={() => updateService(service.id, { keySystemEnabled: !service.key_system_enabled })}
                  >
                    {service.key_system_enabled ? "Disable keys" : "Enable keys"}
                  </button>

                  {service.key_system_enabled && (
                    <select
                      className="input serviceUiSelect"
                      value={service.key_ui_mode}
                      disabled={busy !== ""}
                      onChange={e => updateService(service.id, { keyUiMode: e.target.value })}
                    >
                      <option value="DEFAULT">Default UI</option>
                      <option value="CUSTOM">Custom UI</option>
                    </select>
                  )}

                  <button
                    className="secondaryBtn"
                    disabled={busy !== ""}
                    onClick={() => updateService(service.id, { enabled: !service.enabled })}
                  >
                    {service.enabled ? "Disable service" : "Enable service"}
                  </button>
                </div>
                <span className={service.enabled ? "statusGood" : "statusOff"}>{service.enabled ? "active" : "disabled"}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="hintCard">
        <strong>Next</strong>
        <p>Add scripts, choose where the loader should route each Roblox place/universe, then create keys for the users of that service.</p>
        <Link href="/dashboard/routes">Configure loader routes →</Link>
      </div>
    </>
  );
}
