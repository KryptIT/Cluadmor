import { Key, Plus } from "lucide-react";

export default function ApiKeys() {
  return (
    <>
      <div className="pageHead"><div><span className="muted">Developer</span><h1>API keys</h1><p>Server credentials for managing services and keys through the Claudmor API.</p></div><button className="primaryBtn"><Plus size={14}/> API key</button></div>
      <section className="panelCard"><div className="emptyState large"><div className="emptyIcon"><Key size={18}/></div><strong>No API keys</strong><p>Create API keys only for trusted server-side integrations.</p></div></section>
    </>
  );
}
