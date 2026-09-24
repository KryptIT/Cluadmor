"use client";

import { useState } from "react";
import {
  ArrowRight,
  KeyRound,
  PlugZap,
  Save,
  Settings2,
  ShieldCheck,
  TestTube2
} from "lucide-react";

const initial = [
  { id: "lootlabs", name: "LootLabs", color: "purple", description: "Rewarded task links. Users complete your LootLabs flow before receiving a key.", fields: ["API key", "Link / template"] },
  { id: "linkvertise", name: "Linkvertise", color: "blue", description: "Use your own Linkvertise account and monetized links as key checkpoints.", fields: ["Publisher ID", "API key / secret", "Link template"] },
  { id: "boostellar", name: "Boostellar", color: "orange", description: "Connect your own Boostellar account and key-system links.", fields: ["API key / secret", "Link / template"] }
];

export default function ProvidersPage() {
  const [open, setOpen] = useState<string | null>("lootlabs");
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ lootlabs: true, linkvertise: false, boostellar: false });

  return (
    <>
      <div className="pageHead">
        <div><span className="muted">Key system</span><h1>Providers</h1><p>Bring your own monetization accounts and choose which providers each service uses.</p></div>
      </div>

      <div className="notice"><strong>Your credentials stay separate.</strong> Every service owner supplies their own provider configuration; Claudmor does not expose platform-wide secrets to other users.</div>

      <div className="providerGrid">
        {initial.map(p => (
          <section key={p.id} className={"providerCard " + (enabled[p.id] ? "enabled" : "")}>
            <div className="providerHead">
              <div className="providerIdentity">
                <span className={"providerLogo " + p.color}><PlugZap size={15}/></span>
                <div><strong>{p.name}</strong><small>{enabled[p.id] ? "Enabled" : "Disabled"}</small></div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={!!enabled[p.id]} onChange={e => setEnabled(v => ({...v, [p.id]: e.target.checked}))} />
                <span />
              </label>
            </div>
            <p>{p.description}</p>
            <button className="providerConfigure" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <Settings2 size={13} style={{verticalAlign:"middle",marginRight:7}}/>
              {open === p.id ? "Hide configuration" : "Configure provider"}
            </button>
            {open === p.id && (
              <div className="providerForm">
                <label>Service<select className="input"><option>Select a service...</option></select></label>
                {p.fields.map((field, i) => (
                  <label key={field}>{field}<input className="input" type={i === 1 || field.toLowerCase().includes("key") || field.toLowerCase().includes("secret") ? "password" : "text"} placeholder={field} /></label>
                ))}
                <div className="row">
                  <button className="primaryBtn"><Save size={13}/> Save provider</button>
                  <button className="secondaryBtn"><TestTube2 size={13}/> Test</button>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="panelCard">
        <div className="panelTitle"><div><span className="iconBox"><PlugZap size={15}/></span><strong>Provider flow</strong></div></div>
        <div className="flowRow">
          <div><span>01</span><strong>Open key page</strong><small>Claudmor creates a signed key session.</small></div>
          <ArrowRight size={15}/>
          <div><span>02</span><strong>Provider checkpoint</strong><small>LootLabs, Linkvertise, or Boostellar.</small></div>
          <ArrowRight size={15}/>
          <div><span>03</span><strong>Verify completion</strong><small>The completion is tied to that key session.</small></div>
          <ArrowRight size={15}/>
          <div><span>04</span><strong>Issue key</strong><small>HWID and account locks are applied.</small></div>
        </div>
      </section>
    </>
  );
}
