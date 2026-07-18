"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Demo-mode stand-in for the Discord bot's !redeem command. */
export function DemoRedeem() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const redeem = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/demo/redeem", { method: "POST" });
      const body = await res.json();
      if (res.ok && body.ok) {
        router.push(new URL(body.url).pathname);
        return;
      }
      setMessage(
        body.reason === "no_credits"
          ? "No pack credits left on the demo account."
          : "Could not redeem a pack right now."
      );
    } catch {
      setMessage("Could not redeem a pack right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="btn" onClick={redeem} disabled={busy}>
        {busy ? "Redeeming…" : "Redeem a demo pack"}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
