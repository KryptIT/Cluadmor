"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  FileCode2,
  KeyRound,
  Play,
  RefreshCw,
  Save,
  Sparkles
} from "lucide-react";

type Service = { id: string; name: string };
type SavedScript = {
  id: string;
  name: string;
  service_id: string;
  service_name: string;
  updated_at: string;
};

export default function ScriptsPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);\n  const [ownerBypass, setOwnerBypass] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("script.lua");
  const [source, setSource] = useState('print("hi claudium")');
  const [preset, setPreset] = useState("executor");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const selectedService = useMemo(
    () => services.find(s => s.id === serviceId),
    [services, serviceId]
  );

  async function load() {
    const servicesRes = await fetch("/api/workspace/services", { cache: "no-store" });
    if (servicesRes.status === 401) {
      setAuthenticated(false);
      setServices([]);
      setScripts([]);
      return;
    }

    const serviceData = await servicesRes.json();
    const list = serviceData.services || [];
    setAuthenticated(true);\n    setOwnerBypass(!!serviceData.ownerBypass);
    setServices(list);
    if (!serviceId && list[0]) setServiceId(list[0].id);

    const scriptsRes = await fetch("/api/workspace/scripts", { cache: "no-store" });
    if (scriptsRes.ok) {
      const scriptData = await scriptsRes.json();
      setScripts(scriptData.scripts || []);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveScript() {
    if (!serviceId || !name.trim() || !source.trim()) return;
    setBusy("save");
    setMessage("");
    try {
      const res = await fetch("/api/owner/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, name, source })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not save script.");
        return;
      }
      setMessage("Saved.");
      await load();
    } finally {
      setBusy("");
    }
  }

  async function openScript(id: string) {
    setBusy(id);
    setMessage("");
    try {
      const res = await fetch("/api/workspace/scripts?id=" + encodeURIComponent(id), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not load script.");
        return;
      }
      setName(data.script.name);
      setServiceId(data.script.serviceId);
      setSource(data.script.source || "");
      setOutput("");
    } finally {
      setBusy("");
    }
  }

  async function obfuscate() {
    if (!source.trim()) return;
    setBusy("obfuscate");
    setMessage("");
    setOutput("");
    try {
      const res = await fetch("/api/workspace/obfuscate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, preset })
      });
      const text = await res.text();
      if (!res.ok) {
        try {
          const parsed = JSON.parse(text);
          if (res.status === 402 && parsed.error === "obfuscation_credit_required") {
            setMessage("One obfuscation credit is required. Complete the reward step or enable the owner bypass.");
          } else {
            setMessage(parsed.detail || parsed.error || "Claudium failed.");
          }
        } catch {
          setMessage(text || "Claudium failed.");
        }
        return;
      }

      try {
        const parsed = JSON.parse(text);
        setOutput(parsed.output || parsed.result || text);
      } catch {
        setOutput(text);
      }
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
        setMessage(data.error || "Could not start reward flow.");
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
    if (output) {
      await navigator.clipboard.writeText(output);
      setMessage("Output copied.");
    }
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Claudium</span>
          <h1>Lua scripts</h1>
          <p>Save scripts under a service and run Claudium directly from the dashboard.</p>
        </div>
      </div>

      {authenticated === false && (
        <div className="notice ownerNotice">
          <div>
            <strong>Sign in to use your script workspace.</strong>
            <span>Every Claudmor account can save scripts for its own services. Owner mode only skips obfuscation rewards.</span>
          </div>
          <Link className="secondaryBtn" href="/login"><KeyRound size={14}/> Sign in</Link>
        </div>
      )}

      {authenticated === true && services.length === 0 && (
        <div className="notice ownerNotice">
          <div>
            <strong>Create a service first.</strong>
            <span>Scripts belong to your service and can then be selected by place/universe loader routes.</span>
          </div>
          <Link className="secondaryBtn" href="/dashboard/services">Create service</Link>
        </div>
      )}
      {authenticated === true && ownerBypass && (
        <div className="notice ownerNotice">
          <div><strong>Owner bypass active.</strong><span>Claudium runs here do not consume obfuscation credits.</span></div>
          <Link className="secondaryBtn" href="/dashboard/settings">Settings</Link>
        </div>
      )}

      <div className="scriptWorkspace">
        <section className="panelCard scriptEditor">
          <div className="panelTitle">
            <div><span className="iconBox"><Code2 size={15}/></span><strong>Editor</strong></div>
            <span className="editorService">{selectedService?.name || "No service"}</span>
          </div>

          <div className="scriptMeta">
            <label>
              Service
              <select className="input" value={serviceId} onChange={e => setServiceId(e.target.value)} disabled={authenticated !== true}>
                <option value="">Select service...</option>
                {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            <label>
              Script name
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="script.lua" disabled={authenticated !== true}/>
            </label>
            <label>
              Claudium preset
              <select className="input" value={preset} onChange={e => setPreset(e.target.value)} disabled={authenticated !== true}>
                <option value="executor">executor</option>
                <option value="roblox">roblox</option>
                <option value="luau">luau</option>
                <option value="lua51">lua51</option>
              </select>
            </label>
          </div>

          <label className="sourceLabel">
            Source
            <textarea
              className="sourceEditor"
              value={source}
              onChange={e => setSource(e.target.value)}
              spellCheck={false}
              disabled={authenticated !== true}
            />
          </label>

          <div className="editorActions">
            <button className="secondaryBtn" disabled={authenticated !== true || busy !== "" || !serviceId} onClick={saveScript}>
              {busy === "save" ? <RefreshCw size={14} className="spin"/> : <Save size={14}/>}
              Save script
            </button>
            <button className="primaryBtn" disabled={authenticated !== true || busy !== "" || !source.trim()} onClick={obfuscate}>
              {busy === "obfuscate" ? <RefreshCw size={14} className="spin"/> : <Play size={14}/>}
              Obfuscate
            </button>
            {!ownerBypass && authenticated === true && (
              <button className="secondaryBtn" disabled={busy !== ""} onClick={getObfuscationCredit}>
                <Sparkles size={14}/> Get 1 credit
              </button>
            )}
          </div>

          {message && <div className="settingsMessage">{message}</div>}
        </section>

        <aside className="panelCard scriptLibrary">
          <div className="panelTitle">
            <div><span className="iconBox"><FileCode2 size={15}/></span><strong>Saved scripts</strong></div>
            <button className="iconButton" onClick={load}><RefreshCw size={14}/></button>
          </div>

          {scripts.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon"><FileCode2 size={18}/></div>
              <strong>No saved scripts</strong>
              <p>Save the current editor contents to keep it under this service.</p>
            </div>
          ) : (
            <div className="savedScriptList">
              {scripts.map(script => (
                <button className="savedScriptRow" key={script.id} onClick={() => openScript(script.id)}>
                  <FileCode2 size={15}/>
                  <span><strong>{script.name}</strong><small>{script.service_name}</small></span>
                  {busy === script.id ? <RefreshCw size={13} className="spin"/> : <span className="openHint">open</span>}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div><span className="iconBox"><Check size={15}/></span><strong>Claudium output</strong></div>
          <button className="secondaryBtn" disabled={!output} onClick={copyOutput}><Copy size={13}/> Copy</button>
        </div>
        <textarea
          className="outputEditor"
          value={output}
          readOnly
          placeholder="Obfuscated output appears here."
          spellCheck={false}
        />
      </section>
    </>
  );
}
