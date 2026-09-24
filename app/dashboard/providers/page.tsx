"use client";

import { useState } from "react";

const initial = [
  { id: "lootlabs", name: "LootLabs", color: "purple", description: "Rewarded task links. User completes your LootLabs flow before receiving a key.", fields: ["API key", "Link / template"] },
  { id: "linkvertise", name: "Linkvertise", color: "blue", description: "Use your own Linkvertise account and monetized links as key checkpoints.", fields: ["Publisher ID", "API key / secret", "Link template"] },
  { id: "boostellar", name: "Boostellar", color: "orange", description: "Connect your own Boostellar account and key-system links.", fields: ["API key / secret", "Link / template"] }
];

export default function ProvidersPage() {
  const [open, setOpen] = useState<string | null>("lootlabs");
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ lootlabs: true, linkvertise: false, boostellar: false });

  return (
    <>
      <div className="pageHead">
        <div><span className="muted">KEY SYSTEM</span><h1>Providers</h1><p>Users bring their own monetization provider accounts. Enable any combination per service.</p></div>
      </div>

      <div className="notice"><strong>Bring your own provider.</strong> Claudmor never shares your platform-wide ad credentials with service owners. Each service owner supplies their own provider credentials.</div>

      <div className="providerGrid">
        {initial.map(p => (
          <section key={p.id} className={"providerCard " + (enabled[p.id] ? "enabled" : "")}>
            <div className="providerHead">
              <div className="providerIdentity">
                <span className={"providerLogo " + p.color}>{p.name.slice(0,1)}</span>
                <div><strong>{p.name}</strong><small>{enabled[p.id] ? "Enabled" : "Disabled"}</small></div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={!!enabled[p.id]} onChange={e => setEnabled(v => ({...v, [p.id]: e.target.checked}))} />
                <span />
              </label>
            </div>
            <p>{p.description}</p>
            <button className="providerConfigure" onClick={() => setOpen(open === p.id ? null : p.id)}>
              {open === p.id ? "Hide configuration" : "Configure provider"}
            </button>
            {open === p.id && (
              <div className="providerForm">
                <label>Service<select className="input"><option>Select a service...</option></select></label>
                {p.fields.map((field, i) => (
                  <label key={field}>{field}<input className="input" type={i === 1 || field.toLowerCase().includes("key") || field.toLowerCase().includes("secret") ? "password" : "text"} placeholder={field} /></label>
                ))}
                <div className="row"><button className="primaryBtn">Save provider</button><button className="secondaryBtn">Test configuration</button></div>
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="panelCard">
        <div className="panelTitle"><div><span className="iconBox">⇄</span><strong>Provider flow</strong></div></div>
        <div className="flowRow">
          <div><span>1</span><strong>User opens key page</strong><small>Claudmor creates a signed key session.</small></div>
          <b>→</b>
          <div><span>2</span><strong>Provider checkpoint</strong><small>LootLabs, Linkvertise or Boostellar.</small></div>
          <b>→</b>
          <div><span>3</span><strong>Claudmor verifies</strong><small>Completion is tied to the key session.</small></div>
          <b>→</b>
          <div><span>4</span><strong>Key issued</strong><small>HWID/account locks are applied.</small></div>
        </div>
      </section>
    </>
  );
}
