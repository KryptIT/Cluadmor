"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Globe2, Plus, RefreshCw, Route, Trash2 } from "lucide-react";

type Service = {
  id: string;
  name: string;
};

type LoaderRoute = {
  id: string;
  service_id: string;
  script_id?: string | null;
  script_name?: string | null;
  target_service_id?: string | null;
  target_service_name?: string | null;
  match_type: "PLACE" | "UNIVERSE" | "DEFAULT";
  match_value: string;
  priority: number;
  enabled: boolean;
};

export default function LoaderRoutesPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [routes, setRoutes] = useState<LoaderRoute[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [targetServiceId, setTargetServiceId] = useState("");
  const [matchType, setMatchType] = useState<"PLACE" | "UNIVERSE" | "DEFAULT">("PLACE");
  const [matchValue, setMatchValue] = useState("");
  const [priority, setPriority] = useState("0");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const targetServices = useMemo(
    () => services.filter(service => service.id !== serviceId),
    [services, serviceId]
  );

  async function loadBase() {
    const response = await fetch("/api/workspace/services", {
      cache: "no-store"
    });

    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }

    const data = await response.json();
    const serviceList = data.services || [];

    setAuthenticated(true);
    setServices(serviceList);

    if (!serviceId && serviceList[0]) {
      setServiceId(serviceList[0].id);
      setTargetServiceId(
        serviceList.find((service: Service) => service.id !== serviceList[0].id)?.id || ""
      );
    }
  }

  async function loadRoutes(id = serviceId) {
    if (!id) {
      setRoutes([]);
      return;
    }

    const response = await fetch(
      "/api/workspace/routes?serviceId=" + encodeURIComponent(id),
      { cache: "no-store" }
    );

    if (response.ok) {
      const data = await response.json();
      setRoutes(data.routes || []);
    }
  }

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (!serviceId) return;

    loadRoutes(serviceId);
    setMessage("");

    if (
      targetServiceId === serviceId ||
      (targetServiceId && !services.some(service => service.id === targetServiceId))
    ) {
      setTargetServiceId(
        services.find(service => service.id !== serviceId)?.id || ""
      );
    }
  }, [serviceId, services]);

  async function saveRoute() {
    if (!serviceId || !targetServiceId) return;

    setBusy("save");
    setMessage("");

    try {
      const response = await fetch("/api/workspace/routes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          serviceId,
          targetServiceId,
          matchType,
          matchValue: matchType === "DEFAULT" ? "" : matchValue,
          priority: Number(priority) || 0
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not save route.");
        return;
      }

      setMatchValue("");
      await loadRoutes();
    } finally {
      setBusy("");
    }
  }

  async function removeRoute(id: string) {
    setBusy(id);

    try {
      await fetch("/api/workspace/routes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id })
      });

      await loadRoutes();
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Loader</span>
          <h1>Place & universe routing</h1>
          <p>Route one loader service into different Claudmor services by Roblox game.</p>
        </div>
      </div>

      {authenticated === false && (
        <div className="notice ownerNotice">
          <div>
            <strong>Sign in first.</strong>
            <span>Loader routes belong to your own Claudmor services.</span>
          </div>
          <Link className="secondaryBtn" href="/login">Sign in</Link>
        </div>
      )}

      {authenticated === true && services.length < 2 && (
        <div className="notice ownerNotice">
          <div>
            <strong>Create another service.</strong>
            <span>Service-to-service routing needs at least two services.</span>
          </div>
          <Link className="secondaryBtn" href="/dashboard/services">
            Create service
          </Link>
        </div>
      )}

      <section className="panelCard">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><Route size={15}/></span>
            <strong>Add loader route</strong>
          </div>
        </div>

        <div className="routeForm">
          <label>
            Loader service
            <select
              className="input"
              value={serviceId}
              onChange={event => setServiceId(event.target.value)}
            >
              <option value="">Select loader service...</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Match
            <select
              className="input"
              value={matchType}
              onChange={event => setMatchType(event.target.value as any)}
            >
              <option value="PLACE">PlaceId</option>
              <option value="UNIVERSE">UniverseId / game.GameId</option>
              <option value="DEFAULT">Default fallback</option>
            </select>
          </label>

          <label>
            {matchType === "PLACE"
              ? "PlaceId"
              : matchType === "UNIVERSE"
                ? "UniverseId"
                : "Fallback"}
            <input
              className="input"
              value={matchValue}
              onChange={event => setMatchValue(event.target.value.replace(/\D/g, ""))}
              disabled={matchType === "DEFAULT"}
              placeholder={matchType === "DEFAULT" ? "No ID needed" : "1234567890"}
            />
          </label>

          <label>
            Target service
            <select
              className="input"
              value={targetServiceId}
              onChange={event => setTargetServiceId(event.target.value)}
            >
              <option value="">Select target service...</option>
              {targetServices.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priority
            <input
              className="input"
              type="number"
              value={priority}
              onChange={event => setPriority(event.target.value)}
            />
          </label>

          <button
            className="primaryBtn routeSave"
            disabled={
              busy !== "" ||
              !serviceId ||
              !targetServiceId ||
              (matchType !== "DEFAULT" && !matchValue)
            }
            onClick={saveRoute}
          >
            {busy === "save"
              ? <RefreshCw size={14} className="spin"/>
              : <Plus size={14}/>}
            Save route
          </button>
        </div>

        {message && <div className="formError">{message}</div>}
      </section>

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><Globe2 size={15}/></span>
            <strong>Current routes</strong>
          </div>
          <button className="secondaryBtn" onClick={() => loadRoutes()}>
            <RefreshCw size={13}/> Refresh
          </button>
        </div>

        {routes.length === 0 ? (
          <div className="emptyState">
            <div className="emptyIcon"><Route size={18}/></div>
            <strong>No routes configured</strong>
            <p>Add as many PlaceId or UniverseId routes as you need.</p>
          </div>
        ) : (
          <div className="routeList">
            {routes.map(route => (
              <article className="routeRow" key={route.id}>
                <div className="routeType">{route.match_type}</div>

                <div className="routeValue">
                  <strong>
                    {route.match_type === "DEFAULT"
                      ? "fallback"
                      : route.match_value}
                  </strong>
                  <small>
                    {route.match_type === "PLACE"
                      ? "game.PlaceId"
                      : route.match_type === "UNIVERSE"
                        ? "game.GameId"
                        : "when nothing else matches"}
                  </small>
                </div>

                <div className="routeArrow">→</div>

                <div className="routeScript">
                  <strong>{route.target_service_name || "Unknown service"}</strong>
                  <small>
                    {route.script_name
                      ? `legacy direct script · ${route.script_name}`
                      : `service route · priority ${route.priority}`}
                  </small>
                </div>

                <button
                  className="iconButton"
                  disabled={busy === route.id}
                  onClick={() => removeRoute(route.id)}
                >
                  {busy === route.id
                    ? <RefreshCw size={13} className="spin"/>
                    : <Trash2 size={14}/>}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="hintCard">
        <strong>Runtime resolution</strong>
        <p>
          Claudmor authenticates the key against the loader service, follows the
          matching service route, then resolves that target service&apos;s own
          PlaceId, UniverseId, or default script route. Route chains are limited
          and cycles are rejected.
        </p>
      </div>
    </>
  );
}
