"use client";

import { useEffect, useState, useTransition } from "react";
import type { ResourceKey } from "@/game/config";
import type { GameState } from "@/server/game";
import { Sprite } from "@/art/pixel";
import { LOGO, RESOURCE_SPRITES } from "@/art/sprites";
import type { ActionResult } from "@/app/actions";
import { Avatar } from "./Avatar";
import { FarmScreen } from "./screens/FarmScreen";
import { WorkScreen } from "./screens/WorkScreen";
import { StockScreen } from "./screens/StockScreen";
import { RankingScreen } from "./screens/RankingScreen";
import type { ScreenProps } from "./screens/types";

type Tab = "farm" | "work" | "barn" | "rank";

const TABS: { key: Tab; label: string; icon: ResourceKey }[] = [
  { key: "farm", label: "Sítio", icon: "plank" },
  { key: "work", label: "Oficina", icon: "tool" },
  { key: "barn", label: "Estoque", icon: "feed" },
  { key: "rank", label: "Ranking", icon: "cheese" },
];

export function Game({ state }: { state: GameState }) {
  const [tab, setTab] = useState<Tab>("farm");
  const [toast, setToast] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Server time offset, so the client estimate follows the server clock.
  const [offset] = useState(() => new Date(state.now).getTime() - Date.now());
  const [now, setNow] = useState(() => new Date(state.now));
  useEffect(() => {
    const id = setInterval(() => setNow(new Date(Date.now() + offset)), 1000);
    return () => clearInterval(id);
  }, [offset]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const act = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setToast(await fn());
    });

  const ctx: ScreenProps = { state, now, act, pending };

  return (
    <>
      <main className="shell">
        <header className="topbar">
          <Sprite sprite={LOGO} scale={2} />
          <h1 className="grow">{state.farm.name}</h1>
          <span className="lvl">Nível {state.farm.level}</span>
          <Avatar avatar={state.me.avatar} scale={2} />
        </header>
        {tab === "farm" && <FarmScreen {...ctx} />}
        {tab === "work" && <WorkScreen {...ctx} />}
        {tab === "barn" && <StockScreen {...ctx} />}
        {tab === "rank" && <RankingScreen {...ctx} />}
      </main>
      {toast && <div className={`toast ${toast.ok ? "" : "error"}`} role="status">{toast.message}</div>}
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            <Sprite sprite={RESOURCE_SPRITES[t.icon]} scale={2} />
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
