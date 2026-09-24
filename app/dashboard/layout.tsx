import Link from "next/link";

const nav = [
  ["Overview", "/dashboard", "◫"],
  ["Services", "/dashboard/services", "▦"],
  ["Providers", "/dashboard/providers", "⌁"],
  ["Keys", "/dashboard/keys", "⚿"],
  ["Lua Scripts", "/dashboard/scripts", "<>"],
  ["Public Pages", "/dashboard/public", "◎"],
  ["Webhooks", "/dashboard/webhooks", "↗"],
  ["API Keys", "/dashboard/api-keys", "⚙"]
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brandMark">C</span>
          <span>CLAUDMOR</span>
        </Link>

        <div className="navGroup">
          <div className="navLabel">WORKSPACE</div>
          {nav.slice(0, 2).map(([label, href, icon]) => (
            <Link key={href} href={href} className="navItem"><span>{icon}</span>{label}</Link>
          ))}
        </div>

        <div className="navGroup">
          <div className="navLabel">KEY SYSTEM</div>
          {nav.slice(2, 6).map(([label, href, icon]) => (
            <Link key={href} href={href} className="navItem"><span>{icon}</span>{label}</Link>
          ))}
        </div>

        <div className="navGroup">
          <div className="navLabel">DEVELOPER</div>
          {nav.slice(6).map(([label, href, icon]) => (
            <Link key={href} href={href} className="navItem"><span>{icon}</span>{label}</Link>
          ))}
        </div>

        <div className="sidebarBottom">
          <div className="avatar">X9</div>
          <div><strong>Workspace</strong><small>Claudmor</small></div>
        </div>
      </aside>

      <section className="dashMain">
        <header className="topbar">
          <div className="crumb">Dashboard</div>
          <div className="topActions">
            <button className="searchBtn">⌕ Search <kbd>Ctrl K</kbd></button>
            <Link href="/dashboard/credits" className="creditBtn">◆ Credits</Link>
          </div>
        </header>
        <main className="dashContent">{children}</main>
      </section>
    </div>
  );
}
