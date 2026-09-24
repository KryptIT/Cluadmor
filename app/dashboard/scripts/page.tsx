"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Code2,
  Coins,
  Copy,
  FileCode2,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles
} from "lucide-react";

type Service = { id: string; name: string };

type SavedScript = {
  id: string;
  name: string;
  service_id: string;
  service_name: string;
  updated_at: string;
  obfuscated_at?: string | null;
  obfuscation_preset?: string;
  has_build?: boolean;
};

export default function ScriptsPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [ownerBypass, setOwnerBypass] = useState(false);
  const [claudiumConfigured, setClaudiumConfigured] = useState<boolean | null>(null);
  const [claudiumDetail, setClaudiumDetail] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [scripts, setScripts] = useState<SavedScript[]>([]);

  const [scriptId, setScriptId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("script.lua");
  const [source, setSource] = useState("");
  const [preset, setPreset] = useState("executor");
  const [output, setOutput] = useState("");
  const [obfuscatedAt, setObfuscatedAt] = useState<string | null>(null);
  const [buildStale, setBuildStale] = useState(false);

  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const selectedService = useMemo(
    () => services.find(service => service.id === serviceId),
    [services, serviceId]
  );

  async function load() {
    const [servicesRes, scriptsRes, claudiumRes] = await Promise.all([
      fetch("/api/workspace/services", { cache: "no-store" }),
      fetch("/api/workspace/scripts", { cache: "no-store" }),
      fetch("/api/workspace/claudium/status", { cache: "no-store" })
    ]);

    if (servicesRes.status === 401) {
      setAuthenticated(false);
      setServices([]);
      setScripts([]);
      return;
    }

    const serviceData = await servicesRes.json();
    const list = serviceData.services || [];

    setAuthenticated(true);
    setOwnerBypass(!!serviceData.ownerBypass);
    setServices(list);

    if (!serviceId && list[0]) setServiceId(list[0].id);

    if (scriptsRes.ok) {
      const scriptData = await scriptsRes.json();
      setScripts(scriptData.scripts || []);
    }

    if (claudiumRes.ok) {
      const claudiumData = await claudiumRes.json();
      setClaudiumConfigured(!!claudiumData.online);
      setClaudiumDetail(String(claudiumData.detail || ""));
    }
  }

  useEffect(() => { load(); }, []);

  function newScript() {
    setScriptId("");
    setName("script.lua");
    setSource("");
    setOutput("");
    setPreset("executor");
    setObfuscatedAt(null);
    setBuildStale(false);
    setMessage("");
    if (!serviceId && services[0]) setServiceId(services[0].id);
  }

  async function saveScript(): Promise<string | null> {
    if (!serviceId || !name.trim() || !source.trim()) {
      setMessage("Choose a service and enter source first.");
      return null;
    }

    setBusy("save");
    setMessage("");

    try {
      const res = await fetch("/api/workspace/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: scriptId || undefined,
          serviceId,
          name,
          source,
          preset
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.detail || data.error || "Could not save source.");
        return null;
      }

      const id = data.script?.id || scriptId;
      setScriptId(id);
      setBuildStale(!!obfuscatedAt);
      setMessage("Source saved.");
      await load();
      return id;
    } finally {
      setBusy("");
    }
  }

  async function openScript(id: string) {
    setBusy(id);
    setMessage("");

    try {
      const res = await fetch(
        "/api/workspace/scripts?id=" + encodeURIComponent(id),
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.detail || data.error || "Could not load script.");
        return;
      }

      setScriptId(data.script.id);
      setName(data.script.name);
      setServiceId(data.script.serviceId);
      setSource(data.script.source || "");
      setOutput(data.script.obfuscated || "");
      setPreset(data.script.preset || "executor");
      setObfuscatedAt(data.script.obfuscatedAt || null);
      setBuildStale(!!data.script.buildStale);
    } finally {
      setBusy("");
    }
  }

  async function build() {
    let id = scriptId;

    if (!id) {
      const saved = await saveScript();
      if (!saved) return;
      id = saved;
    } else {
      const saved = await saveScript();
      if (!saved) return;
      id = saved;
    }

    setBusy("build");
    setMessage("");

    try {
      const res = await fetch("/api/workspace/scripts/obfuscate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId: id, preset })
      });

      const data = await res.json();

      if (res.status === 402 && data.error === "obfuscation_credit_required") {
        setMessage("You need 1 Claudium token to build this script.");
        return;
      }

      if (!res.ok) {
        setMessage(data.detail || data.error || "Claudium failed.");
        return;
      }

      setOutput(data.output || "");
      setObfuscatedAt(new Date().toISOString());
      setBuildStale(false);
      setMessage(data.bypassedCredit
        ? "Protected build updated with owner bypass."
        : "Protected build updated. 1 token used.");

      await load();
    } finally {
      setBusy("");
    }
  }

  async function getObfuscationCredit() {
    setBusy("reward");
    setMessage("");

    try {
      const res = await fetch("/api/rewards/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "OBFUSCATION" })
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

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setMessage("Protected build copied.");
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Script storage</span>
          <h1>Scripts</h1>
          <p>Keep editable source privately, store the last Claudium build, and route only protected builds to loaders.</p>
        </div>

        <div className="pageHeadActions">
          <span className={
            claudiumConfigured === true
              ? "backendState backendOnline"
              : claudiumConfigured === false
                ? "backendState backendOffline"
                : "backendState"
          }>
            {claudiumConfigured === true
              ? "Claudium online"
              : claudiumConfigured === false
                ? "Claudium not configured"
                : "Checking Claudium"}
          </span>

          <button
            className="secondaryBtn"
            disabled={authenticated !== true}
            onClick={newScript}
          >
            <Plus size={14}/> New script
          </button>
        </div>
      </div>

      {authenticated === false && (
        <div className="notice ownerNotice">
          <div>
            <strong>Sign in to use your script workspace.</strong>
            <span>Use Google or Discord to access your own services and stored source.</span>
          </div>
          <Link className="secondaryBtn" href="/login"><KeyRound size={14}/> Sign in</Link>
        </div>
      )}

      {authenticated === true && claudiumConfigured === false && (
        <div className="notice ownerNotice">
          <div>
            <strong>Claudium backend is offline.</strong>
            <span>{claudiumDetail || "Check CLAUDIUM_INTERNAL_URL and CLAUDIUM_INTERNAL_SECRET on Vercel and Railway."}</span>
          </div>
        </div>
      )}

      {authenticated === true && services.length === 0 && (
        <div className="notice ownerNotice">
          <div>
            <strong>Create a service first.</strong>
            <span>Every stored script belongs to one service.</span>
          </div>
          <Link className="secondaryBtn" href="/dashboard/services">Create service</Link>
        </div>
      )}

      {authenticated === true && ownerBypass && (
        <div className="notice ownerNotice">
          <div>
            <strong>Owner bypass active.</strong>
            <span>Save/edit normally; re-obfuscation does not consume tokens for your account.</span>
          </div>
          <Link className="secondaryBtn" href="/dashboard/settings">Settings</Link>
        </div>
      )}

      <div className="scriptWorkspace">
        <section className="panelCard scriptEditor">
          <div className="panelTitle">
            <div>
              <span className="iconBox"><Code2 size={15}/></span>
              <strong>{scriptId ? "Edit source" : "New source file"}</strong>
            </div>

            <span className="editorService">
              {selectedService?.name || "No service"}
            </span>
          </div>

          <div className="scriptMeta">
            <label>
              Service
              <select
                className="input"
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                disabled={authenticated !== true}
              >
                <option value="">Select service...</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            </label>

            <label>
              File name
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="main.lua"
                disabled={authenticated !== true}
              />
            </label>

            <label>
              Claudium preset
              <select
                className="input"
                value={preset}
                onChange={e => setPreset(e.target.value)}
                disabled={authenticated !== true}
              >
                <option value="executor">executor</option>
                <option value="roblox">roblox</option>
                <option value="luau">luau</option>
                <option value="lua51">lua51</option>
              </select>
            </label>
          </div>

          <label className="sourceLabel">
            Unobfuscated source
            <textarea
              className="sourceEditor"
              value={source}
              onChange={e => {
                setSource(e.target.value);
                if (obfuscatedAt) setBuildStale(true);
              }}
              spellCheck={false}
              disabled={authenticated !== true}
              placeholder={'print("hello from my script")'}
            />
          </label>

          <div className="scriptBuildBar">
            <div>
              <span className={
                !obfuscatedAt
                  ? "buildStatus buildMissing"
                  : buildStale
                    ? "buildStatus buildStale"
                    : "buildStatus buildReady"
              }>
                {!obfuscatedAt
                  ? "no protected build"
                  : buildStale
                    ? "protected build is stale"
                    : "protected build ready"}
              </span>

              {obfuscatedAt && (
                <small>Built {new Date(obfuscatedAt).toLocaleString()}</small>
              )}
            </div>

            <div className="editorActions">
              <button
                className="secondaryBtn"
                disabled={authenticated !== true || busy !== "" || !serviceId || !source.trim()}
                onClick={() => saveScript()}
              >
                {busy === "save"
                  ? <RefreshCw size={14} className="spin"/>
                  : <Save size={14}/>}
                Save source
              </button>

              <button
                className="primaryBtn"
                disabled={authenticated !== true || claudiumConfigured !== true || busy !== "" || !serviceId || !source.trim()}
                onClick={build}
              >
                {busy === "build"
                  ? <RefreshCw size={14} className="spin"/>
                  : <ShieldCheck size={14}/>}
                Re-obfuscate
                {!ownerBypass && <span className="tokenCost"><Coins size={12}/>1</span>}
              </button>

              {!ownerBypass && authenticated === true && (
                <button
                  className="secondaryBtn"
                  disabled={busy !== ""}
                  onClick={getObfuscationCredit}
                >
                  <Sparkles size={14}/> Get token
                </button>
              )}
            </div>
          </div>

          {message && <div className="settingsMessage">{message}</div>}
        </section>

        <aside className="panelCard scriptLibrary">
          <div className="panelTitle">
            <div>
              <span className="iconBox"><FileCode2 size={15}/></span>
              <strong>Stored files</strong>
            </div>
            <button className="iconButton" onClick={load}><RefreshCw size={14}/></button>
          </div>

          {scripts.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon"><FileCode2 size={18}/></div>
              <strong>No scripts yet</strong>
              <p>Create a source file and save it under a service.</p>
            </div>
          ) : (
            <div className="savedScriptList">
              {scripts.map(script => {
                const stale =
                  !!script.obfuscated_at &&
                  new Date(script.updated_at).getTime() > new Date(script.obfuscated_at).getTime();

                return (
                  <button
                    className={"savedScriptRow " + (script.id === scriptId ? "selected" : "")}
                    key={script.id}
                    onClick={() => openScript(script.id)}
                  >
                    <FileCode2 size={15}/>
                    <span>
                      <strong>{script.name}</strong>
                      <small>{script.service_name}</small>
                    </span>

                    {busy === script.id
                      ? <RefreshCw size={13} className="spin"/>
                      : <span className={
                          !script.has_build
                            ? "scriptBuildTag missing"
                            : stale
                              ? "scriptBuildTag stale"
                              : "scriptBuildTag ready"
                        }>
                          {!script.has_build ? "raw" : stale ? "stale" : "built"}
                        </span>}
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><ShieldCheck size={15}/></span>
            <strong>Last protected build</strong>
          </div>

          <button
            className="secondaryBtn"
            disabled={!output}
            onClick={copyOutput}
          >
            <Copy size={13}/> Copy
          </button>
        </div>

        <textarea
          className="outputEditor"
          value={output}
          readOnly
          placeholder="Run Re-obfuscate to create the protected build that loaders are allowed to deliver."
          spellCheck={false}
        />
      </section>
    </>
  );
}
