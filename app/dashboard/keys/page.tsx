import { KeyRound, Plus, Search } from "lucide-react";

export default function KeysPage() {
  return (
    <>
      <div className="pageHead">
        <div><span className="muted">Key system</span><h1>Keys</h1><p>Search, revoke, reset HWIDs, and inspect account bindings.</p></div>
        <button className="primaryBtn"><Plus size={14} /> Create key</button>
      </div>
      <section className="panelCard">
        <div className="toolbar">
          <div style={{position:"relative",flex:1}}><Search size={13} style={{position:"absolute",left:10,top:11,color:"#647178"}}/><input className="input" style={{paddingLeft:30}} placeholder="Search key, HWID, Roblox or Discord ID..." /></div>
          <select className="input compact"><option>All services</option></select>
        </div>
        <div className="emptyState large"><div className="emptyIcon"><KeyRound size={18} /></div><strong>No keys yet</strong><p>Keys created by your services will appear here.</p></div>
      </section>
    </>
  );
}
