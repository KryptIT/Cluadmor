import "./dashboard-extra.css";
import Link from "next/link";
import {
  LayoutDashboard,
  Boxes,
  PlugZap,
  KeyRound,
  Code2,
  Globe2,
  Webhook,
  Key,
  Search,
  Coins,
  ExternalLink,
  Settings,
  Route,
  FileText
} from "lucide-react";

const groups = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Services", href: "/dashboard/services", icon: Boxes },
      { label: "Settings", href: "/dashboard/settings", icon: Settings }
    ]
  },
  {
    label: "Key system",
    items: [
      { label: "Providers", href: "/dashboard/providers", icon: PlugZap },
      { label: "Keys", href: "/dashboard/keys", icon: KeyRound },
      { label: "Scripts", href: "/dashboard/scripts", icon: Code2 },
      { label: "Loader routes", href: "/dashboard/routes", icon: Route },
      { label: "Loader", href: "/dashboard/loaders", icon: FileText },
      { label: "Public pages", href: "/dashboard/public", icon: Globe2 }
    ]
  },
  {
    label: "Developer",
    items: [
      { label: "Webhooks", href: "/dashboard/webhooks", icon: Webhook },
      { label: "API keys", href: "/dashboard/api-keys", icon: Key }
    ]
  }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <img src="/claudmor-mark.svg" alt="" />
          <div>
            <strong>Claudmor</strong>
            <span>control panel</span>
          </div>
        </Link>

        <nav className="sideNav">
          {groups.map(group => (
            <div className="navGroup" key={group.label}>
              <div className="navLabel">{group.label}</div>
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="navItem">
                    <Icon size={16} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebarBottom">
          <a href="https://dsc.gg/oxyenv" target="_blank" rel="noreferrer">
            Community <ExternalLink size={13} />
          </a>
          <a href="https://guns.lol/larpcorrupted" target="_blank" rel="noreferrer">
            larpcorrupted <ExternalLink size={13} />
          </a>
        </div>
      </aside>

      <section className="dashMain">
        <header className="topbar">
          <div className="crumb">Claudmor / dashboard</div>
          <div className="topActions">
            <button className="searchBtn"><Search size={15} /> Search <kbd>Ctrl K</kbd></button>
            <Link href="/dashboard/credits" className="creditBtn"><Coins size={15} /> Credits</Link>
          </div>
        </header>
        <main className="dashContent">{children}</main>
      </section>
    </div>
  );
}
