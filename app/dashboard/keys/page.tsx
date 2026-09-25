"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, KeyRound, Plus, RefreshCw, X } from "lucide-react";

type Service = { id: string; name: string };
type License = {
  id: string;
  service_id: string;
  service_name: string;
  roblox_user_id?: string | null;
  roblox_username?: string | null;
  discord_user_id?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  hwid_bound: boolean;
};

export default function KeysPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [keys, setKeys] = useState<License[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [creating, setCreating] = useState(false);
  const [issuedKey, setIssuedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function load() {
    const s = await fetch("/api/workspace/services", { cache: "no-store" });
    if (s.status === 401) {
      setAuthenticated(false);
      setServices([]);
      setKeys([]);
      return;
    }
    const sd = await s.json();
    const list = sd.services || [];
    setAuthenticated(true);
    setServices(list);
    if (!serviceId && list[0]) setServiceId(list[0].id);

    const k = await fetch("/api/workspace/keys", { cache: "no-store" });
    if (k.ok) {
      const kd = await k.json();
      setKeys(kd.keys || []);
    }
  }

  useEffect(() => { load(); }, []);

  async function createKey() {
    if (!serviceId) return;
    setBusy(true);
    setMessage("");
    setIssuedKey("");
    try {
      const res = await fetch("/api/workspace/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not create key.");
        return;
      }
      setIssuedKey(data.key || "");
      setCreating(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copyIssued() {
    if (issuedKey) await navigator.clipboard.writeText(issuedKey);
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Key system</span>
          <h1>Keys</h1>
          <p>Create keys for your services. On first successful execution, each key automatically locks to that executor's HWID, Roblox UserId, and Roblox username.</p>
        </div>
        <button className="primaryBtn" disabled={authenticated !== true || services.length === 0} onClick={() => setCreating(true)}>
          <Plus size={14}/> Create key
        </button>
      </div>

      {authenticated === false && (
        <div className="notice ownerNotice">
          <div><strong>Sign in first.</strong><span>Every Claudmor account manages its own service keys.</span></div>
          <Link className="secondaryBtn" href="/login">Sign in</Link>
        </div>
      )}

      {authenticated === true && services.length === 0 && (
        <div className="notice ownerNotice">
          <div><strong>You need a service first.</strong><span>Keys always belong to one service.</span></div>
          <Link className="secondaryBtn" href="/dashboard/services">Create service</Link>
        </div>
      )}

      {issuedKey && (
        <div className="secretNotice">
          <div>
            <strong>Key created. Copy it now.</strong>
            <code>{issuedKey}</code>
            <small>Only the key hash is stored.</small>
          </div>
          <button className="secondaryBtn" onClick={copyIssued}><Copy size={14}/> Copy</button>
        </div>
      )}

      {creating && (
        <section className="panelCard createPanel">
          <div className="panelTitle">
            <div><span className="iconBox"><KeyRound size={15}/></span><strong>Create key</strong></div>
            <button className="iconButton" onClick={() => setCreating(false)}><X size={15}/></button>
          </div>

          <div className="createServiceForm">
            <label>
              Service
              <select className="input" value={serviceId} onChange={e => setServiceId(e.target.value)}>
                {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>

            <div className="formGrid">
              <label>
                Expires at
                <input
                  className="input"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                />
              </label>
              <div className="notice ownerNotice">
                <div>
                  <strong>Automatic first-use binding</strong>
                  <span>The first successful execution sets HWID, Roblox UserId, and Roblox username. These cannot be pre-set here.</span>
                </div>
              </div>
            </div>

            <div className="row">
              <button className="primaryBtn" disabled={busy || !serviceId} onClick={createKey}>
                {busy ? <RefreshCw size={14} className="spin"/> : <Plus size={14}/>}
                {busy ? "Creating..." : "Create key"}
              </button>
              <button className="secondaryBtn" onClick={() => setCreating(false)}>Cancel</button>
            </div>
            {message && <div className="formError">{message}</div>}
          </div>
        </section>
      )}

      <section className="panelCard">
        <div className="toolbar">
          <div><strong>Keys</strong><span className="pill">{keys.length} total</span></div>
          <button className="secondaryBtn" onClick={load}><RefreshCw size={13}/> Refresh</button>
        </div>

        {keys.length === 0 ? (
          <div className="emptyState large">
            <div className="emptyIcon"><KeyRound size={18}/></div>
            <strong>No keys yet</strong>
            <p>Create keys for users who should authenticate into one of your services.</p>
          </div>
        ) : (
          <div className="serviceList">
            {keys.map(key => (
              <article className="serviceRow" key={key.id}>
                <div className="serviceMark"><KeyRound size={16}/></div>
                <div className="serviceMain">
                  <strong>{key.service_name}</strong>
                  <small>{key.id}</small>
                </div>
                <div className="serviceLocks">
                  {key.hwid_bound && <span>HWID bound</span>}
                  {key.roblox_user_id && <span>Roblox {key.roblox_user_id}</span>}
                  {key.roblox_username && <span>@{key.roblox_username}</span>}
                  {key.discord_user_id && <span>Discord {key.discord_user_id}</span>}
                </div>
                <span className={key.revoked_at ? "statusOff" : "statusGood"}>{key.revoked_at ? "revoked" : "active"}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
