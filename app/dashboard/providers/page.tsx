"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, PlugZap, RefreshCw, Save } from "lucide-react";

type Service = { id: string; name: string };

const providers = [
  { id: "lootlabs", name: "LootLabs", fields: ["apiKey", "linkTemplate"] },
  { id: "linkvertise", name: "Linkvertise", fields: ["publisherId", "apiKey", "linkTemplate"] },
  { id: "boostellar", name: "Boostellar", fields: ["apiKey", "linkTemplate"] }
] as const;

export default function ProvidersPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const currentService = useMemo(
    () => services.find(s => s.id === serviceId),
    [services, serviceId]
  );

  async function loadServices() {
    const res = await fetch("/api/workspace/services", { cache: "no-store" });
    if (res.status === 401) {
      setAuthenticated(false);
      return;
    }
    const data = await res.json();
    const list = data.services || [];
    setAuthenticated(true);
    setServices(list);
    if (!serviceId && list[0]) setServiceId(list[0].id);
  }

  async function loadProviders(id = serviceId) {
    if (!id) return;
    const res = await fetch("/api/workspace/providers?serviceId=" + encodeURIComponent(id), { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();

    const nextSaved: Record<string, boolean> = {};
    const nextEnabled: Record<string, boolean> = {};
    const nextForms: Record<string, Record<string, string>> = {};

    for (const row of data.providers || []) {
      nextSaved[row.provider] = !!row.configured;
      nextEnabled[row.provider] = !!row.enabled;
      nextForms[row.provider] = {
        linkTemplate: row.config?.linkTemplate || "",
        publisherId: row.config?.publisherId || ""
      };
    }

    setSaved(nextSaved);
    setEnabled(nextEnabled);
    setForms(nextForms);
  }

  useEffect(() => { loadServices(); }, []);
  useEffect(() => { if (serviceId) loadProviders(serviceId); }, [serviceId]);

  function setField(provider: string, key: string, value: string) {
    setForms(v => ({
      ...v,
      [provider]: { ...(v[provider] || {}), [key]: value }
    }));
  }

  async function saveProvider(provider: typeof providers[number]) {
    if (!serviceId) return;
    setBusy(provider.id);
    setMessage("");

    const form = forms[provider.id] || {};
    const credentials: Record<string, string> = {};
    const config: Record<string, string> = {};

    for (const field of provider.fields) {
      const value = form[field] || "";
      if (!value) continue;

      if (field === "apiKey") credentials.apiKey = value;
      else config[field] = value;
    }

    try {
      const res = await fetch("/api/workspace/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          provider: provider.id,
          enabled: enabled[provider.id] !== false,
          credentials,
          config
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not save provider.");
        return;
      }

      setSaved(v => ({ ...v, [provider.id]: true }));
      setMessage(provider.name + " saved.");
      await loadProviders();
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Key system</span>
          <h1>Providers</h1>
          <p>Each service owner connects their own provider accounts.</p>
        </div>
      </div>

      {authenticated === false && (
        <div className="notice ownerNotice">
          <div><strong>Sign in first.</strong><span>Provider settings belong to your Claudmor workspace.</span></div>
          <Link className="secondaryBtn" href="/login">Sign in</Link>
        </div>
      )}

      {authenticated === true && services.length === 0 && (
        <div className="notice ownerNotice">
          <div><strong>Create a service first.</strong><span>Provider configuration is stored per service.</span></div>
          <Link className="secondaryBtn" href="/dashboard/services">Create service</Link>
        </div>
      )}

      {services.length > 0 && (
        <section className="panelCard">
          <div className="providerServiceBar">
            <div>
              <span className="fieldLabel">Service</span>
              <select className="input" value={serviceId} onChange={e => setServiceId(e.target.value)}>
                {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </div>
            <div className="providerCurrent">
              <strong>{currentService?.name}</strong>
              <small>Provider settings are isolated to this service.</small>
            </div>
          </div>
        </section>
      )}

      <div className="providerGrid providerGridSpaced">
        {providers.map(provider => {
          const form = forms[provider.id] || {};
          return (
            <section key={provider.id} className={"providerCard " + (saved[provider.id] ? "enabled" : "")}>
              <div className="providerHead">
                <div className="providerIdentity">
                  <span className="providerLogo"><PlugZap size={15}/></span>
                  <div>
                    <strong>{provider.name}</strong>
                    <small>{saved[provider.id] ? "Configured" : "Not configured"}</small>
                  </div>
                </div>

                {saved[provider.id] && <CheckCircle2 size={16} color="#70d9a6"/>}
              </div>

              <div className="providerForm providerFormAlways">
                {provider.fields.map(field => (
                  <label key={field}>
                    {field === "apiKey"
                      ? "API key / secret"
                      : field === "publisherId"
                        ? "Publisher ID"
                        : provider.id === "lootlabs"
                          ? "Example LootLabs single link"
                          : "Link / template"}
                    <input
                      className="input"
                      type={field === "apiKey" ? "password" : "text"}
                      value={form[field] || ""}
                      onChange={e => setField(provider.id, field, e.target.value)}
                      placeholder={field === "apiKey" && saved[provider.id] ? "Leave blank to keep current secret" : ""}
                    />
                  </label>
                ))}

                {provider.id === "lootlabs" && (
                  <small className="muted">
                    Claudmor uses this existing single link as the shell and replaces its destination dynamically with LootLabs Redirect API data. The link must belong to the same LootLabs account as the API key.
                  </small>
                )}

                <label className="providerEnableRow">
                  <input
                    type="checkbox"
                    checked={enabled[provider.id] !== false}
                    onChange={e => setEnabled(v => ({ ...v, [provider.id]: e.target.checked }))}
                  />
                  <span>Enabled for this service</span>
                </label>

                <button
                  className="primaryBtn"
                  disabled={!serviceId || busy !== ""}
                  onClick={() => saveProvider(provider)}
                >
                  {busy === provider.id ? <RefreshCw size={14} className="spin"/> : <Save size={14}/>}
                  {busy === provider.id ? "Saving..." : "Save provider"}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {message && <div className="settingsMessage">{message}</div>}
    </>
  );
}
