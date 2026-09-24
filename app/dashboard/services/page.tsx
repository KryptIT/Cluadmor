import Link from "next/link";

export default function ServicesPage() {
  return (
    <>
      <div className="pageHead">
        <div><span className="muted">KEY SYSTEM</span><h1>Services</h1><p>Each service gets its own keys, locks, providers and authentication settings.</p></div>
        <button className="primaryBtn">+ New Service</button>
      </div>

      <section className="panelCard">
        <div className="toolbar">
          <div><strong>Services</strong><span className="pill">0 / ∞</span></div>
          <div className="toolbarRight"><input className="input compact" placeholder="Search services..." /><select className="input compact"><option>Name</option><option>Newest</option></select></div>
        </div>
        <div className="emptyState large">
          <div className="emptyIcon">▦</div>
          <strong>No services</strong>
          <p>Create a service to start issuing HWID/account-bound keys.</p>
          <button className="primaryBtn">+ Create Service</button>
        </div>
      </section>

      <div className="hintCard">
        <strong>How a service works</strong>
        <p>Create service → configure providers → set key rules → publish the key page → use the generated API credentials inside your Lua script.</p>
        <Link href="/dashboard/providers">Configure providers →</Link>
      </div>
    </>
  );
}
