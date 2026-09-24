import Link from "next/link";

export default function Dashboard() {
  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">WORKSPACE</span>
          <h1>Overview</h1>
          <p>Manage Claudmor authentication, providers, keys and Claudium credits.</p>
        </div>
        <Link href="/dashboard/services" className="primaryBtn">+ New Service</Link>
      </div>

      <div className="statGrid">
        <div className="statCard"><span>Services</span><strong>0</strong><small>Create your first service</small></div>
        <div className="statCard"><span>Active keys</span><strong>0</strong><small>Across all services</small></div>
        <div className="statCard"><span>Obfuscation credits</span><strong>0</strong><small>1 credit = 1 Claudium run</small></div>
        <div className="statCard"><span>Auth requests</span><strong>0</strong><small>Last 24 hours</small></div>
      </div>

      <div className="splitGrid">
        <section className="panelCard">
          <div className="panelTitle"><div><span className="iconBox">▦</span><strong>Services</strong></div><Link href="/dashboard/services">View all</Link></div>
          <div className="emptyState">
            <div className="emptyIcon">+</div>
            <strong>No services yet</strong>
            <p>Create a service, configure key locks, then attach one or more monetization providers.</p>
            <Link className="secondaryBtn" href="/dashboard/services">Create service</Link>
          </div>
        </section>

        <section className="panelCard">
          <div className="panelTitle"><div><span className="iconBox">⌁</span><strong>Providers</strong></div><Link href="/dashboard/providers">Configure</Link></div>
          <div className="providerMini"><span className="providerDot purple" /><div><strong>LootLabs</strong><small>Not configured</small></div></div>
          <div className="providerMini"><span className="providerDot blue" /><div><strong>Linkvertise</strong><small>Not configured</small></div></div>
          <div className="providerMini"><span className="providerDot orange" /><div><strong>Boostellar</strong><small>Not configured</small></div></div>
        </section>
      </div>
    </>
  );
}
