import { Plus, Webhook } from "lucide-react";

export default function Webhooks() {
  return (
    <>
      <div className="pageHead"><div><span className="muted">Developer</span><h1>Webhooks</h1><p>Receive server-side events for key creation, authentication, revocation, and provider completions.</p></div><button className="primaryBtn"><Plus size={14}/> Webhook</button></div>
      <section className="panelCard"><div className="emptyState large"><div className="emptyIcon"><Webhook size={18}/></div><strong>No webhooks</strong><p>Add an HTTPS endpoint and choose the events it should receive.</p></div></section>
    </>
  );
}
