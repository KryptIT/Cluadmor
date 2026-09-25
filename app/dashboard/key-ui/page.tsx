"use client";

import { Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";

const LIBRARY = 'local Claudmor = loadstring(game:HttpGet("https://claudmor.vercel.app/sdk/library.lua"))()';

const CUSTOM = [
  LIBRARY,
  "",
  'Claudmor.service = "YOUR_SERVICE_ID"',
  "",
  "getgenv().CLAUDMOR_KEY_UI = function(context)",
  "    return Claudmor.prompt({",
  '        serviceId = context.serviceId,',
  '        title = "My Script",',
  '        description = "Enter your key to continue."',
  "    })",
  "end",
  "",
  'loadstring(game:HttpGet("https://claudmor.vercel.app/l/YOUR_SERVICE_ID"))()'
].join("\n");

export default function KeyUiPage() {
  const [message, setMessage] = useState("");

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Copied.");
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Key system</span>
          <h1>Key UI library</h1>
          <p>Default mode works from the normal one-line loader. Custom mode can override only the UI while Claudmor keeps verification and delivery server-side.</p>
        </div>
      </div>

      <div className="splitGrid">
        <section className="panelCard">
          <div className="panelTitle">
            <div><span className="iconBox"><ShieldCheck size={15}/></span><strong>Default UI</strong></div>
          </div>
          <div className="settingsBody">
            <p>No setup code is required. If no valid SCRIPT_KEY is available, Claudmor opens its key window automatically, remembers the verified key, and retries invalid keys without killing the loader.</p>
          </div>
        </section>

        <section className="panelCard">
          <div className="panelTitle">
            <div><span className="iconBox"><KeyRound size={15}/></span><strong>Custom UI</strong></div>
          </div>
          <div className="settingsBody">
            <p>Expose <code>getgenv().CLAUDMOR_KEY_UI</code> as a callback. If a custom callback is missing or fails, Claudmor falls back to the default UI instead of aborting.</p>
          </div>
        </section>
      </div>

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div><strong>SDK library</strong></div>
          <button className="secondaryBtn" onClick={() => copy(LIBRARY)}><Copy size={13}/> Copy</button>
        </div>
        <code className="keyUiCode">{LIBRARY}</code>
      </section>

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div><strong>Custom UI example</strong></div>
          <button className="secondaryBtn" onClick={() => copy(CUSTOM)}><Copy size={13}/> Copy</button>
        </div>
        <code className="keyUiCode">{CUSTOM}</code>
      </section>

      {message && <div className="settingsMessage">{message}</div>}
    </>
  );
}
