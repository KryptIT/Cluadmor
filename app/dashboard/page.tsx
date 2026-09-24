"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Coins,
  KeyRound,
  Plus,
  Route,
  ShieldCheck
} from "lucide-react";

type Service = {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
};

type License = {
  id: string;
  service_name: string;
  revoked_at?: string | null;
};

type Session = {
  authenticated: boolean;
  ownerBypass: boolean;
  user?: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
    obfuscation_credits: number;
    service_creation_credits: number;
  };
};

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [keys, setKeys] = useState<License[]>([]);

  useEffect(() => {
    (async () => {
      const [sessionRes, servicesRes, keysRes] = await Promise.all([
        fetch("/api/account/session", { cache: "no-store" }),
        fetch("/api/workspace/services", { cache: "no-store" }),
        fetch("/api/workspace/keys", { cache: "no-store" })
      ]);

      if (sessionRes.ok) setSession(await sessionRes.json());

      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.services || []);
      }

      if (keysRes.ok) {
        const data = await keysRes.json();
        setKeys(data.keys || []);
      }
    })();
  }, []);

  const activeKeys = keys.filter(key => !key.revoked_at).length;
  const signedIn = session?.authenticated === true;
  const credits = session?.user?.obfuscation_credits ?? 0;
  const serviceUnlocks = session?.user?.service_creation_credits ?? 0;

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Workspace</span>
          <h1>{signedIn ? (session?.user?.display_name || session?.user?.username) : "Overview"}</h1>
          <p>
            {signedIn
              ? "Your services, keys, scripts, and routing."
              : "Sign in to open your Claudmor workspace."}
          </p>
        </div>

        {signedIn ? (
          <Link href="/dashboard/services" className="primaryBtn">
            <Plus size={14} /> New service
          </Link>
        ) : (
          <Link href="/login" className="primaryBtn">
            Sign in <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <div className="statGrid">
        <div className="statCard">
          <span>Services</span>
          <strong>{services.length}</strong>
          <small>{services.length === 1 ? "service" : "services"} in this workspace</small>
        </div>

        <div className="statCard">
          <span>Active keys</span>
          <strong>{activeKeys}</strong>
          <small>{keys.length} total issued</small>
        </div>

        <div className="statCard">
          <span>Claudium credits</span>
          <strong>{session?.ownerBypass ? "∞" : credits}</strong>
          <small>{session?.ownerBypass ? "owner bypass active" : "1 credit per successful run"}</small>
        </div>

        <div className="statCard">
          <span>Service unlocks</span>
          <strong>{session?.ownerBypass ? "∞" : serviceUnlocks}</strong>
          <small>{session?.ownerBypass ? "reward gate bypassed" : "earned through Claudmor rewards"}</small>
        </div>
      </div>

      <div className="splitGrid">
        <section className="panelCard">
          <div className="panelTitle">
            <div><span className="iconBox"><Boxes size={15} /></span><strong>Services</strong></div>
            <Link href="/dashboard/services">View all</Link>
          </div>

          {services.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon"><Boxes size={18} /></div>
              <strong>No services yet</strong>
              <p>Create a service, add scripts, then route places and universes to them.</p>
              <Link className="secondaryBtn" href={signedIn ? "/dashboard/services" : "/login"}>
                {signedIn ? "Create service" : "Sign in"} <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <div className="overviewList">
              {services.slice(0, 5).map(service => (
                <Link href="/dashboard/services" className="overviewRow" key={service.id}>
                  <Boxes size={15} />
                  <div>
                    <strong>{service.name}</strong>
                    <small>{service.id}</small>
                  </div>
                  <span className={service.enabled ? "statusGood" : "statusOff"}>
                    {service.enabled ? "active" : "disabled"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panelCard">
          <div className="panelTitle">
            <div><span className="iconBox"><ShieldCheck size={15} /></span><strong>Workspace</strong></div>
          </div>

          <div className="workspaceLinks">
            <Link href="/dashboard/keys">
              <KeyRound size={16} />
              <div><strong>Keys</strong><small>Create and manage service access.</small></div>
              <ArrowRight size={13} />
            </Link>

            <Link href="/dashboard/routes">
              <Route size={16} />
              <div><strong>Loader routes</strong><small>Resolve PlaceId / UniverseId to scripts.</small></div>
              <ArrowRight size={13} />
            </Link>

            <Link href="/dashboard/credits">
              <Coins size={16} />
              <div><strong>Claudium</strong><small>Obfuscation credits and backend status.</small></div>
              <ArrowRight size={13} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
