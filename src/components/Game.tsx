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
import { NightScreen } from "./screens/NightScreen";
import { HeroScreen } from "./screens/HeroScreen";
import type { ScreenProps } from "./screens/types";

type Tab = "farm" | "work" | "hero" | "night" | "barn" | "rank";

const TABS: { key: Tab; label: string; icon: ResourceKey }[] = [
  { key: "farm", label: "Sítio", icon: "plank" },
  { key: "work", label: "Oficina", icon: "tool" },
  { key: "hero", label: "Herói", icon: "iron_bar" },
  { key: "night", label: "Noite", icon: "ore" },
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
      <main className={`shell ${tab === "farm" ? "full" : ""}`}>
        <header className="topbar">
          <Sprite sprite={LOGO} scale={2} />
          <h1 className="grow">{state.farm.name}</h1>
          <span className="lvl">Nível {state.farm.level}</span>
          <Avatar avatar={state.me.avatar} scale={2} />
        </header>
        {tab === "farm" && <FarmScreen {...ctx} />}
        {tab === "work" && <WorkScreen {...ctx} />}
        {tab === "hero" && <HeroScreen {...ctx} />}
        {tab === "night" && <NightScreen {...ctx} />}
        {tab === "barn" && <StockScreen {...ctx} />}
        {tab === "rank" && <RankingScreen {...ctx} />}
      </main>
      <WipeNotice state={state} onSee={() => setTab("night")} />
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

/**
 * Shown once per season after a wipe: the fire went out, a new season began and
 * only the items were kept. Remembered per browser (just a convenience).
 */
function WipeNotice({ state, onSee }: { state: GameState; onSee: () => void }) {
  const last = state.night.seasons[0];
  const key = "sitio-seen-season";
  const [seen, setSeen] = useState<number | null>(null);
  useEffect(() => {
    try {
      setSeen(Number(localStorage.getItem(key) ?? 0));
    } catch {
      setSeen(state.night.season);
    }
  }, [state.night.season]);
  if (!last || seen === null || seen >= state.night.season) return null;
  const close = () => {
    try {
      localStorage.setItem(key, String(state.night.season));
    } catch {}
    setSeen(state.night.season);
  };
  return (
    <div className="wipe-notice" role="dialog" aria-label="A fogueira apagou">
      <div className="panel stack">
        <h2>A fogueira apagou</h2>
        <p>
          Na noite {last.endedNight} a horda venceu e a {last.season}ª temporada acabou. O sítio recomeçou do zero:
          nível, obras, recursos, oficinas e o nível de todo mundo.
        </p>
        <p><b>Os itens ficaram.</b> Começa a {state.night.season}ª temporada.</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn big" onClick={close}>Recomeçar</button>
          <button className="btn big secondary" onClick={() => { close(); onSee(); }}>Ver a noite</button>
        </div>
      </div>
    </div>
  );
}
