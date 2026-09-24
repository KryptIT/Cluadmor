import Link from "next/link";
import { ArrowRight, Boxes, Plus, Search } from "lucide-react";

export default function ServicesPage() {
  return (
    <>
      <div className="pageHead">
        <div><span className="muted">Key system</span><h1>Services</h1><p>Each service has separate keys, locks, providers, and authentication settings.</p></div>
        <button className="primaryBtn"><Plus size={14} /> New service</button>
      </div>

      <section className="panelCard">
        <div className="toolbar">
          <div><strong>Services</strong><span className="pill">0 total</span></div>
          <div className="toolbarRight">
            <div style={{position:"relative"}}><Search size={13} style={{position:"absolute",left:10,top:11,color:"#647178"}}/><input className="input compact" style={{paddingLeft:30}} placeholder="Search services..." /></div>
            <select className="input compact"><option>Name</option><option>Newest</option></select>
          </div>
        </div>
        <div className="emptyState large">
          <div className="emptyIcon"><Boxes size={18} /></div>
          <strong>No services</strong>
          <p>Create a service to start issuing HWID and account-bound keys.</p>
          <button className="primaryBtn"><Plus size={14} /> Create service</button>
        </div>
      </section>

      <div className="hintCard">
        <strong>Service flow</strong>
        <p>Create service → configure providers → set key rules → publish the key page → integrate the generated Lua client.</p>
        <Link href="/dashboard/providers">Configure providers <ArrowRight size={12} style={{verticalAlign:"middle"}} /></Link>
      </div>
    </>
  );
}
