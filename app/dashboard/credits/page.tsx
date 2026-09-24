"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Coins, Loader2, Plus, ShieldCheck } from "lucide-react";

type Session = {
  authenticated: boolean;
  ownerBypass?: boolean;
  user?: {
    obfuscation_credits: number;
  };
};

export default function Credits() {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const res = await fetch("/api/account/session", { cache: "no-store" });

    if (!res.ok) {
      setSession({ authenticated: false });
      return;
    }

    setSession(await res.json());
  }

  useEffect(() => {
    refresh();

    const rewardId = new URLSearchParams(window.location.search).get("reward");
    if (!rewardId) return;

    let stopped = false;

    (async () => {
      for (let attempt = 0; attempt < 12 && !stopped; attempt++) {
        const res = await fetch(
          "/api/rewards/status?id=" + encodeURIComponent(rewardId),
          { cache: "no-store" }
        );

        if (res.ok) {
          const data = await res.json();
          const status = data.reward?.status;

          if (status === "COMPLETED") {
            await refresh();
            setMessage("Credit added to your account.");
            window.history.replaceState({}, "", "/dashboard/credits");
            return;
          }

          if (status === "EXPIRED") {
            setMessage("That reward session expired.");
            window.history.replaceState({}, "", "/dashboard/credits");
            return;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!stopped) {
        setMessage("Waiting for the LootLabs completion postback. Refresh in a moment if the credit has not appeared yet.");
      }
    })();

    return () => { stopped = true; };
  }, []);

  async function getCredit() {
    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/rewards/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "OBFUSCATION",
          returnTo: "/dashboard/credits"
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.detail || data.error || "Could not start reward flow.");
        return;
      }

      if (data.bypass) {
        setMessage("Owner bypass is active. Claudium builds are free for this account.");
        await refresh();
        return;
      }

      if (data.url) {
        window.location.assign(data.url);
        return;
      }

      setMessage("LootLabs did not return a reward URL.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start reward flow.");
    } finally {
      setBusy(false);
    }
  }

  const available = session?.user?.obfuscation_credits ?? 0;
  const owner = session?.ownerBypass === true;

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Claudium</span>
          <h1>Obfuscation credits</h1>
          <p>One successful Claudium obfuscation consumes one credit.</p>
        </div>

        {session?.authenticated ? (
          <button className="primaryBtn" disabled={busy} onClick={getCredit}>
            {busy ? <Loader2 size={14} className="spin"/> : <Plus size={14}/>}
            {owner ? "Owner bypass active" : "Get 1 credit"}
          </button>
        ) : (
          <Link className="primaryBtn" href="/login">Sign in</Link>
        )}
      </div>

      {message && <div className="settingsMessage">{message}</div>}

      <div className="statGrid">
        <div className="statCard">
          <span>Available</span>
          <strong>{owner ? "∞" : available}</strong>
          <small>{owner ? "Owner bypass" : "Ready to use"}</small>
        </div>

        <div className="statCard">
          <span>Reward</span>
          <strong>{owner ? <ShieldCheck size={21}/> : <Coins size={21}/>}</strong>
          <small>{owner ? "No credits consumed" : "1 LootLabs completion = 1 credit"}</small>
        </div>

        <div className="statCard">
          <span>Status</span>
          <strong><CheckCircle2 size={21}/></strong>
          <small>Claudium connected</small>
        </div>

        <div className="statCard">
          <span>Cost</span>
          <strong>{owner ? "0" : "1"}</strong>
          <small>credit per successful build</small>
        </div>
      </div>
    </>
  );
}
