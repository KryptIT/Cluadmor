export default function KeysPage() {
  return (
    <>
      <div className="pageHead"><div><span className="muted">KEY SYSTEM</span><h1>Keys</h1><p>Search, revoke, reset HWIDs and inspect account bindings.</p></div><button className="primaryBtn">+ Create Key</button></div>
      <section className="panelCard">
        <div className="toolbar"><input className="input" placeholder="Search key, HWID, Roblox or Discord ID..." /><select className="input compact"><option>All services</option></select></div>
        <div className="emptyState large"><div className="emptyIcon">⚿</div><strong>No keys yet</strong><p>Keys created by your services will appear here.</p></div>
      </section>
    </>
  );
}
