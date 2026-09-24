"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  FileKey2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck
} from "lucide-react";

type Service = { id: string; name: string };

export default function LoadersPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [source, setSource] = useState("");
  const [protectedLoader, setProtectedLoader] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

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

  useEffect(() => { loadServices(); }, []);

  async function generate(protect: boolean) {
    if (!serviceId) return;

    setBusy(protect ? "protect" : "plain");
    setMessage("");
    setSource("");

    try {
      const res = await fetch("/api/workspace/loaders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, protect })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.detail || data.error || "Could not generate loader.");
        return;
      }

      setSource(data.source || "");
      setProtectedLoader(!!data.protected);
      setMessage(data.protected
        ? "Protected loader generated."
        : "Readable loader generated.");
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    if (!source) return;
    await navigator.clipboard.writeText(source);
    setMessage("Loader copied.");
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Loader</span>
          <h1>Service loaders</h1>
          <p>Generate the loader your UI library executes after setting getgenv().SCRIPT_KEY.</p>
        </div>
      </div>

      {authenticated === false && (
        <div className="notice ownerNotice">
          <div>
            <strong>Sign in first.</strong>
            <span>Loaders are generated per service in your own workspace.</span>
          </div>
          <Link className="secondaryBtn" href="/login">Sign in</Link>
        </div>
      )}

      {authenticated === true && services.length === 0 && (
        <div className="notice ownerNotice">
          <div>
            <strong>Create a service first.</strong>
            <span>A loader needs a service ID to authenticate keys and resolve scripts.</span>
          </div>
          <Link className="secondaryBtn" href="/dashboard/services">Create service</Link>
        </div>
      )}

      <section className="panelCard">
        <div className="panelTitle">
          <div><span className="iconBox"><FileKey2 size={15}/></span><strong>Generate loader</strong></div>
          {protectedLoader && <span className="ownerBadge"><ShieldCheck size={13}/> protected</span>}
        </div>

        <div className="loaderControls">
          <label>
            Service
            <select className="input" value={serviceId} onChange={e => setServiceId(e.target.value)}>
              <option value="">Select service...</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </select>
          </label>

          <div className="loaderButtons">
            <button
              className="primaryBtn"
              disabled={!serviceId || busy !== ""}
              onClick={() => generate(true)}
            >
              {busy === "protect" ? <RefreshCw size={14} className="spin"/> : <LockKeyhole size={14}/>}
              {busy === "protect" ? "Protecting..." : "Generate protected loader"}
            </button>

            <button
              className="secondaryBtn"
              disabled={!serviceId || busy !== ""}
              onClick={() => generate(false)}
            >
              {busy === "plain" ? <RefreshCw size={14} className="spin"/> : <LoaderCircle size={14}/>}
              Readable loader
            </button>
          </div>
        </div>

        <div className="loaderFlow">
          <div><span>1</span><strong>UI sets SCRIPT_KEY</strong><small>Your key-system UI writes getgenv().SCRIPT_KEY.</small></div>
          <div><span>2</span><strong>Server auth</strong><small>Key, HWID, Roblox identity, service and expiry are checked.</small></div>
          <div><span>3</span><strong>One-use delivery</strong><small>A short-lived ticket selects the PlaceId / UniverseId route.</small></div>
        </div>

        <textarea
          className="outputEditor loaderOutput"
          value={source}
          readOnly
          spellCheck={false}
          placeholder="Generate a loader to see it here."
        />

        <div className="editorActions">
          <button className="secondaryBtn" disabled={!source} onClick={copy}>
            <Copy size={14}/> Copy loader
          </button>
        </div>

        {message && <div className="settingsMessage">{message}</div>}
      </section>

      <section className="hintCard">
        <strong>Expected usage</strong>
        <p>Your UI library should set <code>getgenv().SCRIPT_KEY</code> before executing this loader. The key and HWID are sent in POST bodies, not query strings, so they do not end up in normal URL logs.</p>
      </section>

      <section className="hintCard">
        <strong>What protects it</strong>
        <p>The protected loader is obfuscated by Claudium, but the important protection is server-side: no service secret is embedded, script delivery requires a valid key + HWID, and the delivery ticket is short-lived and single-use.</p>
      </section>
    </>
  );
}
