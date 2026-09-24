import { Globe2 } from "lucide-react";

export default function PublicPages() {
  return (
    <>
      <div className="pageHead"><div><span className="muted">Key system</span><h1>Public pages</h1><p>Customize the key page shown to users for each service.</p></div></div>
      <section className="panelCard"><div className="emptyState large"><div className="emptyIcon"><Globe2 size={18}/></div><strong>No public pages configured</strong><p>Create a service first, then customize its title, logo, accent, and provider flow.</p></div></section>
    </>
  );
}
