"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LEVEL, NIGHT_ROLES, PROFESSIONS, RESOURCES, SLOTS, type ResourceKey } from "@/game/config";
import { computeProduction, hasEnough, ratePerHour, storageHours } from "@/game/rules";
import { farmHour } from "@/art/daylight";
import { COIN } from "@/art/coin";
import { nextStep, rewardPops, type Hint, type Pop, type Snapshot } from "./guide";
import type { GameState } from "@/server/game";
import { Sprite } from "@/art/pixel";
import { LOGO, RESOURCE_SPRITES } from "@/art/sprites";
import type { ActionResult } from "@/app/actions";
import { Avatar } from "./Avatar";
import { Notices } from "./Notices";
import { FarmScreen } from "./screens/FarmScreen";
import { WorkScreen } from "./screens/WorkScreen";
import { StockScreen } from "./screens/StockScreen";
import { RankingScreen } from "./screens/RankingScreen";
import { NightScreen } from "./screens/NightScreen";
import { HeroScreen } from "./screens/HeroScreen";
import { Coins } from "./screens/MarketScreen";
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
  // a tap on a phone notice opens the game on its tab (?tab=night)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as Tab);
  }, []);
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

  const hint = hintFor(state, now);
  const pops = useRewardPops(state);

  const ctx: ScreenProps = { state, now, act, pending, openNight: () => setTab("night") };

  return (
    <>
      <main className={`shell ${tab === "farm" ? "full" : ""}`}>
        <header className="topbar">
          <Sprite sprite={LOGO} scale={2} />
          <h1 className="grow">{state.farm.name}</h1>
          <Coins n={state.me.coins} />
          <span className="lvl">Nível {state.farm.level}</span>
          <Notices state={state} act={act} pending={pending} />
          <Avatar avatar={state.me.avatar} scale={2} />
        </header>
        <button type="button" className={`hint ${hint.urgent ? "urgent" : ""}`} onClick={() => setTab(hint.tab)}>
          <span className="hint-arrow" aria-hidden>▸</span>
          <span className="grow">{hint.text}</span>
        </button>
        <div className={`screen screen-${tab}`}>
        {tab === "farm" && <FarmScreen {...ctx} />}
        {tab === "work" && <WorkScreen {...ctx} />}
        {tab === "hero" && <HeroScreen {...ctx} />}
        {tab === "night" && <NightScreen {...ctx} />}
        {tab === "barn" && <StockScreen {...ctx} />}
        {tab === "rank" && <RankingScreen {...ctx} />}
        </div>
      </main>
      <div className="pops" aria-live="polite">
        {pops.map((p) => (
          <span key={p.id} className={`pop ${p.big ? "big" : ""}`}>
            {p.coin && <Sprite sprite={COIN} scale={2} />}
            {p.resource && <Sprite sprite={RESOURCE_SPRITES[p.resource as ResourceKey]} scale={2} />}
            {p.text}
          </span>
        ))}
      </div>
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

/** The most useful thing to do now (roadmap 1c), from the game state. */
function hintFor(state: GameState, now: Date): Hint {
  const { me, farm, inventory, night } = state;
  const prof = PROFESSIONS[me.profession];
  const prod = computeProduction({
    profession: me.profession,
    workshopLevel: me.workshopLevel,
    farmLevel: farm.level,
    lastCollectedAt: new Date(me.lastCollectedAt),
    now,
  });
  const c = me.character;
  const ready = c.gear.find((g) => {
    const cost = g.upgradeCost ?? g.refineCost;
    return cost !== null && hasEnough(inventory, cost);
  });
  const b = farm.building;
  const canDonate = !!b && (Object.entries(b.cost) as [ResourceKey, number][]).some(
    ([r, need]) => need - (farm.progress[r] ?? 0) > 0 && (inventory[r] ?? 0) > 0,
  );
  return nextStep({
    pending: prod.units,
    capacity: Math.floor(ratePerHour(me.profession, me.workshopLevel, farm.level) * storageHours(farm.level)),
    resourceName: RESOURCES[prof.produces].name,
    hour: farmHour(now),
    patrolled: me.patrolledTonight,
    hordeBeatsDefense: night.horde > night.defense,
    nightsFireLasts: night.lasts,
    freeAttributePoints: c.freePoints,
    talentToPick: LEVEL.talentLevels.some((lv, i) => c.level >= lv && (c.talents[i] === null || c.talents[i] === undefined)),
    gearReady: ready ? SLOTS[ready.slot].label : null,
    canUpgradeWorkshop: !!me.upgradeCost && hasEnough(inventory, me.upgradeCost),
    workshopName: prof.workshop.name,
    canDonateTo: canDonate ? b!.name : null,
    taskReward: state.tasks.claimable,
    betterInBag: state.me.character.betterInBag.length > 0,
    missingRole: (() => {
      const k = night.team.missing.find((r) => r !== "shooter" && r !== night.myRole);
      return k ? NIGHT_ROLES[k].name.toLowerCase() : null;
    })(),
  });
}

const RESOURCE_NAMES = Object.fromEntries(Object.entries(RESOURCES).map(([k, v]) => [k, v.name]));

/** Floating "+N" chips for what the player just gained (compares the state before and after). */
function useRewardPops(state: GameState) {
  const [pops, setPops] = useState<(Pop & { id: number })[]>([]);
  const prev = useRef<Snapshot | null>(null);
  const nextId = useRef(1);
  useEffect(() => {
    const snap: Snapshot = {
      season: state.night.season,
      coins: state.me.coins,
      level: state.me.character.level,
      xpIntoLevel: state.me.character.xpIntoLevel,
      farmLevel: state.farm.level,
      inventory: state.inventory as Record<string, number>,
    };
    const before = prev.current;
    prev.current = snap;
    if (!before) return;
    const fresh = rewardPops(before, snap, RESOURCE_NAMES).map((p) => ({ ...p, id: nextId.current++ }));
    if (fresh.length === 0) return;
    setPops((list) => [...list, ...fresh]);
    const ids = new Set(fresh.map((p) => p.id));
    // no cleanup on purpose: a newer state must not cancel the removal of older pops
    setTimeout(() => setPops((list) => list.filter((p) => !ids.has(p.id))), 2600);
  }, [state]);
  return pops;
}
