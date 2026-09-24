"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldCheck
} from "lucide-react";

type Service = { id: string; name: string };

export default function LoadersPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function loadServices() {
    const res = await fetch("/api/workspace/services", { cache: "no-store" });

    if (res.status === 401) {
      setAuthenticated(false);
      setServices([]);
      return;
    }

    const data = await res.json();
    const list = data.services || [];
    setAuthenticated(true);
    setServices(list);

    if (!serviceId && list[0]) setServiceId(list[0].id);
  }

  async function loadLoader(id = serviceId) {
    if (!id) {
      setPublished(false);
      setOneLiner("");
      setPublicUrl("");
      return;
    }

    const res = await fetch(
      "/api/workspace/loaders?serviceId=" + encodeURIComponent(id),
      { cache: "no-store" }
    );

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.detail || data.error || "Could not load loader status.");
      return;
    }

    setPublished(!!data.published);
    setOneLiner(data.oneLiner || "");
    setPublicUrl(data.publicUrl || "");
    setUpdatedAt(data.updatedAt || null);
  }

  useEffect(() => { loadServices(); }, []);
  useEffect(() => {
    if (serviceId) loadLoader(serviceId);
  }, [serviceId]);

  async function publish() {
    if (!serviceId) return;

    setBusy("publish");
    setMessage("");

    try {
      const res = await fetch("/api/workspace/loaders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.detail || data.error || "Could not publish protected loader.");
        return;
      }

      setPublished(true);
      setOneLiner(data.oneLiner || "");
      setPublicUrl(data.publicUrl || "");
      setUpdatedAt(data.updatedAt || new Date().toISOString());
      setMessage("Protected loader published.");
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setMessage("Copied.");
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Loader</span>
          <h1>Service loader</h1>
          <p>Publish one protected loader URL for each service and copy the loadstring into your UI.</p>
        </div>
      </div>

      {authenticated === false && (
        <div className="notice ownerNotice">
          <div>
            <strong>Sign in first.</strong>
            <span>Loaders are published per service in your Claudmor workspace.</span>
          </div>
          <Link className="secondaryBtn" href="/login">Sign in</Link>
        </div>
      )}

      {authenticated === true && services.length === 0 && (
        <div className="notice ownerNotice">
          <div>
            <strong>Create a service first.</strong>
            <span>The public loader URL belongs to a service.</span>
          </div>
          <Link className="secondaryBtn" href="/dashboard/services">Create service</Link>
        </div>
      )}

      <section className="panelCard">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><FileText size={15}/></span>
            <strong>Published loader</strong>
          </div>

          {published && (
            <span className="ownerBadge">
              <CheckCircle2 size={13}/> live
            </span>
          )}
        </div>

        <div className="loaderControls">
          <label>
            Service
            <select
              className="input"
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
            >
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
              onClick={publish}
            >
              {busy === "publish"
                ? <RefreshCw size={14} className="spin"/>
                : <ShieldCheck size={14}/>}
              {busy === "publish"
                ? "Protecting..."
                : published
                  ? "Re-publish protected loader"
                  : "Publish protected loader"}
            </button>
          </div>
        </div>

        <div className="loaderFlow">
          <div>
            <span>1</span>
            <strong>UI sets SCRIPT_KEY</strong>
            <small>Your key-system UI writes getgenv().SCRIPT_KEY before running the loader.</small>
          </div>
          <div>
            <span>2</span>
            <strong>Loader authenticates</strong>
            <small>Claudmor checks the key, HWID, bindings, expiry, and service.</small>
          </div>
          <div>
            <span>3</span>
            <strong>Protected build is delivered</strong>
            <small>The matched PlaceId / UniverseId route returns only the stored obfuscated script.</small>
          </div>
        </div>

        <div className="loaderPublishBox">
          <label>
            Copy this into your script / UI
            <div className="copyField">
              <code>{oneLiner || "Publish the loader first."}</code>
              <button className="iconButton" disabled={!oneLiner} onClick={() => copy(oneLiner)}>
                <Copy size={14}/>
              </button>
            </div>
          </label>

          <label>
            Public loader URL
            <div className="copyField">
              <code>{publicUrl || "Not published"}</code>
              <button className="iconButton" disabled={!publicUrl} onClick={() => copy(publicUrl)}>
                <Copy size={14}/>
              </button>
              {publicUrl && (
                <a className="iconButton" href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14}/>
                </a>
              )}
            </div>
          </label>

          {updatedAt && (
            <small className="loaderUpdated">
              Last protected build: {new Date(updatedAt).toLocaleString()}
            </small>
          )}
        </div>

        {message && <div className="settingsMessage">{message}</div>}
      </section>

      <section className="hintCard">
        <strong>The loader URL is public by design</strong>
        <p>The public URL returns only a small bootstrap. The actual obfuscated loader is POST-only and requires Claudmor executor headers plus a valid SCRIPT_KEY, HWID, and configured account bindings. The headers are only an extra filter; key/HWID validation is the real gate.</p>
      </section>
    </>
  );
}
