"use client";

import { Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";

const LIBRARY = 'local ClaudmorUI = loadstring(game:HttpGet("https://claudmor.vercel.app/ui/keysystem.lua"))()';

const CUSTOM = [
  LIBRARY,
  "",
  "local key = ClaudmorUI.prompt({",
  '    title = "My Script",',
  '    description = "Enter your key to continue."',
  "})",
  "",
  "ClaudmorUI.setKey(key)",
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
          <p>Use Claudmor's default Roblox key window or build your own UI on top of the same library.</p>
        </div>
      </div>

      <div className="splitGrid">
        <section className="panelCard">
          <div className="panelTitle">
            <div><span className="iconBox"><ShieldCheck size={15}/></span><strong>Default UI</strong></div>
          </div>
          <div className="settingsBody">
            <p>Set a service to <strong>Default UI</strong>. If SCRIPT_KEY is missing, the loader opens the Claudmor key window automatically and continues after the user submits a key.</p>
          </div>
        </section>

        <section className="panelCard">
          <div className="panelTitle">
            <div><span className="iconBox"><KeyRound size={15}/></span><strong>Custom UI</strong></div>
          </div>
          <div className="settingsBody">
            <p>Set a service to <strong>Custom UI</strong>, then set SCRIPT_KEY from your own interface before running the loader.</p>
          </div>
        </section>
      </div>

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div><strong>Load the library</strong></div>
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
