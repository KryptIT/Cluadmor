"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  KeyRound,
  MonitorSmartphone,
  RefreshCw,
  Route,
  Send,
  ShieldCheck
} from "lucide-react";

type Service = { id: string; name: string };

type TimelinePoint = {
  bucket: string;
  auth_success: number;
  auth_rejected: number;
  deliveries: number;
};

type MetricRow = {
  label: string;
  count: number;
};

type TelemetryData = {
  service: Service;
  range: "24h" | "7d" | "30d";
  summary: {
    auth_success: number;
    auth_rejected: number;
    deliveries: number;
    route_misses: number;
    unique_devices: number;
    keys_seen: number;
  };
  timeline: TimelinePoint[];
  topScripts: MetricRow[];
  topPlaces: MetricRow[];
  topUniverses: MetricRow[];
  rejectionReasons: MetricRow[];
  recent: Array<{
    event_type: string;
    reason?: string | null;
    place_id?: string | null;
    universe_id?: string | null;
    route_type?: string | null;
    created_at: string;
    script_name?: string | null;
  }>;
};

function ActivityChart({
  data,
  range
}: {
  data: TimelinePoint[];
  range: "24h" | "7d" | "30d";
}) {
  const width = 900;
  const height = 250;
  const padX = 22;
  const padTop = 18;
  const padBottom = 32;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const max = Math.max(
    1,
    ...data.flatMap(point => [
      Number(point.auth_success || 0),
      Number(point.auth_rejected || 0),
      Number(point.deliveries || 0)
    ])
  );

  function polyline(key: "auth_success" | "auth_rejected" | "deliveries") {
    if (data.length === 0) return "";

    return data.map((point, index) => {
      const x = data.length === 1
        ? padX
        : padX + (index / (data.length - 1)) * innerW;
      const value = Number(point[key] || 0);
      const y = padTop + innerH - (value / max) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }

  const labelEvery = range === "24h" ? 4 : range === "30d" ? 6 : 1;

  return (
    <div className="telemetryChart">
      <div className="chartLegend">
        <span className="chartLegendSuccess"><i/> auth success</span>
        <span className="chartLegendDelivery"><i/> delivery</span>
        <span className="chartLegendReject"><i/> rejected</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Claudmor service activity">
        {[0, .25, .5, .75, 1].map(level => {
          const y = padTop + innerH - level * innerH;
          return (
            <g key={level}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} className="chartGridLine"/>
              <text x={padX} y={y - 5} className="chartAxisText">
                {Math.round(max * level)}
              </text>
            </g>
          );
        })}

        <polyline points={polyline("auth_success")} className="chartLine chartSuccess"/>
        <polyline points={polyline("deliveries")} className="chartLine chartDelivery"/>
        <polyline points={polyline("auth_rejected")} className="chartLine chartReject"/>

        {data.map((point, index) => {
          if (index % labelEvery !== 0 && index !== data.length - 1) return null;

          const date = new Date(point.bucket);
          const label = range === "24h"
            ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : date.toLocaleDateString([], { month: "short", day: "numeric" });

          const x = data.length === 1
            ? padX
            : padX + (index / (data.length - 1)) * innerW;

          return (
            <text
              key={point.bucket}
              x={x}
              y={height - 7}
              textAnchor="middle"
              className="chartAxisText"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function RankedList({
  rows,
  empty
}: {
  rows: MetricRow[];
  empty: string;
}) {
  if (!rows.length) {
    return <div className="telemetryEmpty">{empty}</div>;
  }

  const max = Math.max(1, ...rows.map(row => Number(row.count || 0)));

  return (
    <div className="rankList">
      {rows.map(row => (
        <div className="rankRow" key={row.label}>
          <div className="rankMeta">
            <strong>{row.label}</strong>
            <span>{row.count}</span>
          </div>
          <div className="rankTrack">
            <i style={{ width: `${Math.max(3, Number(row.count || 0) / max * 100)}%` }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function recentLabel(event: TelemetryData["recent"][number]) {
  switch (event.event_type) {
    case "AUTH_SUCCESS": return "Authenticated";
    case "AUTH_REJECTED": return "Auth rejected";
    case "SCRIPT_DELIVERY": return "Script delivered";
    case "ROUTE_MISS": return "Route miss";
    default: return event.event_type;
  }
}

function recentIcon(eventType: string) {
  if (eventType === "AUTH_SUCCESS") return <ShieldCheck size={14}/>;
  if (eventType === "AUTH_REJECTED") return <AlertTriangle size={14}/>;
  if (eventType === "SCRIPT_DELIVERY") return <Send size={14}/>;
  return <Route size={14}/>;
}

export default function TelemetryPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [range, setRange] = useState<"24h" | "7d" | "30d">("7d");
  const [data, setData] = useState<TelemetryData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadServices() {
    const res = await fetch("/api/workspace/services", { cache: "no-store" });

    if (res.status === 401) {
      setAuthenticated(false);
      setServices([]);
      return;
    }

    const payload = await res.json();
    const list = payload.services || [];
    setAuthenticated(true);
    setServices(list);

    if (!serviceId && list[0]) {
      setServiceId(list[0].id);
    }
  }

  async function loadTelemetry(id = serviceId, selectedRange = range) {
    if (!id) {
      setData(null);
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch(
        "/api/workspace/telemetry?serviceId=" + encodeURIComponent(id) +
        "&range=" + encodeURIComponent(selectedRange),
        { cache: "no-store" }
      );

      const payload = await res.json();

      if (!res.ok) {
        setMessage(payload.detail || payload.error || "Could not load telemetry.");
        setData(null);
        return;
      }

      setData(payload);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadServices(); }, []);
  useEffect(() => {
    if (serviceId) loadTelemetry(serviceId, range);
  }, [serviceId, range]);

  const successRate = useMemo(() => {
    if (!data) return 0;

    const success = Number(data.summary.auth_success || 0);
    const rejected = Number(data.summary.auth_rejected || 0);
    const total = success + rejected;

    return total === 0 ? 0 : Math.round(success / total * 100);
  }, [data]);

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Analytics</span>
          <h1>Telemetry</h1>
          <p>Server-side auth, delivery, route, device, and script activity for each service.</p>
        </div>

        <div className="telemetryHeadActions">
          <select
            className="input telemetryServiceSelect"
            value={serviceId}
            onChange={e => setServiceId(e.target.value)}
          >
            <option value="">Select service...</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>

          <div className="rangeSwitch">
            {(["24h", "7d", "30d"] as const).map(item => (
              <button
                key={item}
                className={range === item ? "active" : ""}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            className="iconButton"
            disabled={!serviceId || busy}
            onClick={() => loadTelemetry()}
          >
            <RefreshCw size={14} className={busy ? "spin" : ""}/>
          </button>
        </div>
      </div>

      {authenticated === false && (
        <div className="notice ownerNotice">
          <div>
            <strong>Sign in first.</strong>
            <span>Telemetry is visible only to the owner of the service.</span>
          </div>
          <Link className="secondaryBtn" href="/login">Sign in</Link>
        </div>
      )}

      {authenticated === true && services.length === 0 && (
        <div className="notice ownerNotice">
          <div>
            <strong>No services yet.</strong>
            <span>Create a service before telemetry can be collected.</span>
          </div>
          <Link className="secondaryBtn" href="/dashboard/services">Create service</Link>
        </div>
      )}

      {message && <div className="formError">{message}</div>}

      {data && (
        <>
          <div className="telemetryStats">
            <div className="telemetryStat">
              <ShieldCheck size={15}/>
              <span>Auth success</span>
              <strong>{data.summary.auth_success}</strong>
              <small>{successRate}% acceptance</small>
            </div>

            <div className="telemetryStat">
              <Send size={15}/>
              <span>Deliveries</span>
              <strong>{data.summary.deliveries}</strong>
              <small>protected script fetches</small>
            </div>

            <div className="telemetryStat">
              <MonitorSmartphone size={15}/>
              <span>Devices</span>
              <strong>{data.summary.unique_devices}</strong>
              <small>unique hashed HWIDs</small>
            </div>

            <div className="telemetryStat">
              <KeyRound size={15}/>
              <span>Keys seen</span>
              <strong>{data.summary.keys_seen}</strong>
              <small>distinct licenses used</small>
            </div>

            <div className="telemetryStat">
              <AlertTriangle size={15}/>
              <span>Rejected</span>
              <strong>{data.summary.auth_rejected}</strong>
              <small>failed auth attempts</small>
            </div>

            <div className="telemetryStat">
              <Route size={15}/>
              <span>Route misses</span>
              <strong>{data.summary.route_misses}</strong>
              <small>no matching route</small>
            </div>
          </div>

          <section className="panelCard telemetryGraphPanel">
            <div className="panelTitle">
              <div>
                <span className="iconBox"><Activity size={15}/></span>
                <strong>Activity</strong>
              </div>
              <span className="editorService">{data.service.name}</span>
            </div>

            <ActivityChart data={data.timeline} range={range}/>
          </section>

          <div className="telemetryGrid">
            <section className="panelCard">
              <div className="panelTitle">
                <div><span className="iconBox"><Boxes size={15}/></span><strong>Top scripts</strong></div>
              </div>
              <RankedList rows={data.topScripts} empty="No script deliveries in this range."/>
            </section>

            <section className="panelCard">
              <div className="panelTitle">
                <div><span className="iconBox"><Route size={15}/></span><strong>Top places</strong></div>
              </div>
              <RankedList rows={data.topPlaces} empty="No PlaceId activity in this range."/>
            </section>

            <section className="panelCard">
              <div className="panelTitle">
                <div><span className="iconBox"><Route size={15}/></span><strong>Top universes</strong></div>
              </div>
              <RankedList rows={data.topUniverses} empty="No UniverseId activity in this range."/>
            </section>

            <section className="panelCard">
              <div className="panelTitle">
                <div><span className="iconBox"><AlertTriangle size={15}/></span><strong>Rejection reasons</strong></div>
              </div>
              <RankedList rows={data.rejectionReasons} empty="No rejected authentication in this range."/>
            </section>
          </div>

          <section className="panelCard telemetryRecentPanel">
            <div className="panelTitle">
              <div><span className="iconBox"><Activity size={15}/></span><strong>Recent activity</strong></div>
            </div>

            {data.recent.length === 0 ? (
              <div className="telemetryEmpty">No events yet.</div>
            ) : (
              <div className="telemetryRecent">
                {data.recent.map((event, index) => (
                  <div className="telemetryEvent" key={event.created_at + index}>
                    <span className={"telemetryEventIcon event-" + event.event_type.toLowerCase()}>
                      {recentIcon(event.event_type)}
                    </span>

                    <div className="telemetryEventMain">
                      <strong>{recentLabel(event)}</strong>
                      <small>
                        {event.script_name && <span>{event.script_name}</span>}
                        {event.place_id && <span>Place {event.place_id}</span>}
                        {event.universe_id && <span>Universe {event.universe_id}</span>}
                        {event.reason && <span>{event.reason.replaceAll("_", " ")}</span>}
                      </small>
                    </div>

                    <time>
                      {new Date(event.created_at).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="hintCard">
            <strong>Privacy</strong>
            <p>Claudmor stores HWIDs and IP addresses only as hashes for telemetry and abuse checks. The dashboard exposes aggregates, not raw hardware identifiers or IP addresses.</p>
          </div>
        </>
      )}
    </>
  );
}
