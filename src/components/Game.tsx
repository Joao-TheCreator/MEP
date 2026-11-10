"use client";

import { useEffect, useState, useTransition } from "react";
import {
  PROFESSIONS,
  RECIPES,
  RECIPE_KEYS,
  RESOURCES,
  type Bag,
  type ResourceKey,
} from "@/game/config";
import { computeProduction, hasEnough, maxCraftable, ratePerHour, storageHours } from "@/game/rules";
import type { GameState, RankingRow } from "@/server/game";
import { FarmMap } from "@/art/FarmMap";
import { Sprite } from "@/art/pixel";
import { LOGO, RESOURCE_SPRITES } from "@/art/sprites";
import {
  collectAction,
  craftAction,
  donateAction,
  logout,
  sendAction,
  upgradeAction,
  type ActionResult,
} from "@/app/actions";
import { Res, ResIcon, ResList } from "./Res";
import { Avatar } from "./Avatar";

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

  const ctx = { state, now, act, pending };

  return (
    <>
      <main className="shell">
        <header className="topbar">
          <Sprite sprite={LOGO} scale={2} />
          <h1 className="grow">{state.farm.name}</h1>
          <span className="lvl">Nível {state.farm.level}</span>
          <Avatar avatar={state.me.avatar} scale={2} />
        </header>
        {tab === "farm" && <FarmTab {...ctx} />}
        {tab === "work" && <WorkTab {...ctx} />}
        {tab === "barn" && <BarnTab {...ctx} />}
        {tab === "rank" && <RankTab {...ctx} />}
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

interface Ctx {
  state: GameState;
  now: Date;
  act: (fn: () => Promise<ActionResult>) => void;
  pending: boolean;
}

// ------------------------------------------------------------ Sítio

function FarmTab({ state, act, pending }: Ctx) {
  const { farm, inventory } = state;
  const b = farm.building;
  return (
    <>
      <section className="panel map-frame">
        <FarmMap completed={farm.completed} building={b?.key} />
      </section>
      {b ? (
        <section className="panel stack">
          <h2>Construindo: {b.name}</h2>
          <p className="small muted">{b.description}</p>
          {(Object.entries(b.cost) as [ResourceKey, number][]).map(([r, need]) => {
            const done = farm.progress[r] ?? 0;
            const remaining = need - done;
            const have = inventory[r] ?? 0;
            const give = Math.min(have, remaining);
            return (
              <div key={r}>
                <div className="row between">
                  <Res r={r} name />
                  <span className="small">{done} / {need}</span>
                </div>
                <div className={`bar ${remaining === 0 ? "full" : ""}`}><i style={{ width: `${(done / need) * 100}%` }} /></div>
                {remaining > 0 && (
                  <div className="row between" style={{ marginTop: 4 }}>
                    <span className="small muted">Você tem {have}</span>
                    <span className="row" style={{ gap: 6 }}>
                      <button className="btn small secondary" disabled={pending || have < 1}
                        onClick={() => act(() => donateAction(r, Math.min(10, give)))}>Doar {Math.min(10, Math.max(give, 1))}</button>
                      <button className="btn small" disabled={pending || give < 1}
                        onClick={() => act(() => donateAction(r, give))}>Doar tudo</button>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ) : (
        <section className="panel"><h2>Tudo construído!</h2><p>Em breve: novas construções.</p></section>
      )}
      <InvitePanel code={farm.inviteCode} />
    </>
  );
}

function InvitePanel({ code }: { code: string }) {
  const share = async () => {
    const url = `${location.origin}/onboarding?code=${code}`;
    const text = `Vem cuidar do sítio comigo! Código: ${code}`;
    if (navigator.share) await navigator.share({ title: "Sítio Dae Han", text, url }).catch(() => {});
    else await navigator.clipboard?.writeText(`${text} ${url}`);
  };
  return (
    <section className="panel row between">
      <div>
        <p className="small muted">Código de convite</p>
        <span className="code">{code}</span>
      </div>
      <button className="btn secondary" onClick={share}>Convidar</button>
    </section>
  );
}

// ------------------------------------------------------------ Oficina

function WorkTab({ state, now, act, pending }: Ctx) {
  const { me, farm, inventory } = state;
  const prof = PROFESSIONS[me.profession];
  const prod = computeProduction({
    profession: me.profession,
    workshopLevel: me.workshopLevel,
    farmLevel: farm.level,
    lastCollectedAt: new Date(me.lastCollectedAt),
    now,
  });
  const cap = storageHours(farm.level);
  const rate = ratePerHour(me.profession, me.workshopLevel, farm.level);
  const capUnits = Math.floor(rate * cap);
  const elapsedH = (now.getTime() - new Date(me.lastCollectedAt).getTime()) / 3_600_000;
  const pct = Math.min(1, elapsedH / cap);
  const recipes = RECIPE_KEYS.filter((k) => RECIPES[k].profession === me.profession);

  return (
    <>
      <section className="panel stack">
        <div className="row between">
          <div>
            <h2>{prof.name}</h2>
            <p className="small muted">{prof.workshop.name} nível {me.workshopLevel}</p>
          </div>
          <span className="small">{rate.toLocaleString("pt-BR")} / hora</span>
        </div>
        <div className="row">
          <ResIcon r={prof.produces} scale={4} />
          <div className="grow">
            <span className="big-number">{prod.units}</span>
            <span className="muted"> / {capUnits} {RESOURCES[prof.produces].name}</span>
            <div className={`bar ${pct >= 1 ? "full" : ""}`}><i style={{ width: `${pct * 100}%` }} /></div>
            <p className="small muted">{pct >= 1 ? "Armazém cheio! Colete para não perder." : `Armazém enche em ${cap} h`}</p>
          </div>
        </div>
        <button className="btn big green" disabled={pending || prod.units < 1} onClick={() => act(collectAction)}>
          Coletar
        </button>
      </section>

      <section className="panel stack">
        <h2>Receitas</h2>
        {recipes.map((k) => {
          const rec = RECIPES[k];
          const max = maxCraftable(k, inventory);
          return (
            <div key={k} className="stack" style={{ borderBottom: "2px dashed var(--paper-dark)", paddingBottom: 10 }}>
              <div className="row between wrap">
                <ResList bag={rec.inputs} have={inventory} />
                <span>→ <Res r={rec.output} qty={1} name /></span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {[1, 5].map((n) => (
                  <button key={n} className="btn small secondary" disabled={pending || max < n}
                    onClick={() => act(() => craftAction(k, n))}>×{n}</button>
                ))}
                <button className="btn small" disabled={pending || max < 1}
                  onClick={() => act(() => craftAction(k, max))}>Máx ({max})</button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="panel stack">
        <h2>Melhorar {prof.workshop.name}</h2>
        {me.upgradeCost ? (
          <>
            <p className="small muted">
              Nível {me.workshopLevel} → {me.workshopLevel + 1}: produção +25% da base.
              Peça aos amigos o que faltar!
            </p>
            <ResList bag={me.upgradeCost} have={inventory} />
            <button className="btn big" disabled={pending || !hasEnough(inventory, me.upgradeCost)}
              onClick={() => act(upgradeAction)}>Melhorar</button>
          </>
        ) : (
          <p>Nível máximo!</p>
        )}
      </section>
    </>
  );
}

// ------------------------------------------------------------ Estoque

function BarnTab({ state, act, pending }: Ctx) {
  const { inventory, members, me } = state;
  const items = Object.entries(inventory) as [ResourceKey, number][];
  const others = members.filter((m) => m.id !== me.id);
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [res, setRes] = useState<ResourceKey | "">(items[0]?.[0] ?? "");
  const [qty, setQty] = useState(10);

  return (
    <>
      <section className="panel">
        <h2>Seu estoque</h2>
        {items.length === 0 ? (
          <p className="muted">Vazio. Vá até a Oficina e colete sua produção!</p>
        ) : (
          <div className="inv-grid">
            {items.map(([k, v]) => (
              <div className="slot" key={k}>
                <ResIcon r={k} scale={3} />
                <div><b>{v.toLocaleString("pt-BR")}</b><div className="small muted">{RESOURCES[k].name}</div></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel stack">
        <h2>Enviar para um amigo</h2>
        {others.length === 0 ? (
          <p className="muted">Convide amigos para trocar recursos.</p>
        ) : (
          <>
            <div>
              <label htmlFor="to">Para</label>
              <select id="to" value={to} onChange={(e) => setTo(e.target.value)}>
                {others.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({PROFESSIONS[m.profession].name})</option>
                ))}
              </select>
            </div>
            <div className="row">
              <div className="grow">
                <label htmlFor="res">Recurso</label>
                <select id="res" value={res} onChange={(e) => setRes(e.target.value as ResourceKey)}>
                  {items.map(([k, v]) => <option key={k} value={k}>{RESOURCES[k].name} ({v})</option>)}
                </select>
              </div>
              <div style={{ width: 90 }}>
                <label htmlFor="qty">Qtd.</label>
                <input id="qty" type="number" min={1} inputMode="numeric" value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
              </div>
            </div>
            <button className="btn big secondary" disabled={pending || !to || !res}
              onClick={() => res && act(() => sendAction(to, res, qty))}>Enviar</button>
            <p className="small muted">Envios ajudam o amigo, mas não contam pontos no ranking.</p>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Moradores</h2>
        {members.map((m) => (
          <div key={m.id} className="row between" style={{ padding: "4px 0" }}>
            <span className="row"><Avatar avatar={m.avatar} />{m.name}{m.id === me.id && " (você)"}</span>
            <span className="small muted">{PROFESSIONS[m.profession].name} · nv. {m.workshopLevel}</span>
          </div>
        ))}
        <form action={logout} style={{ marginTop: 12 }}>
          <button className="btn small secondary">Sair</button>
        </form>
      </section>
    </>
  );
}

// ------------------------------------------------------------ Ranking

function RankTab({ state }: Ctx) {
  const [which, setWhich] = useState<"week" | "lastWeek" | "allTime">("week");
  const rows: RankingRow[] = state.ranking[which];
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <section className="panel">
      <h2>Ranking de contribuição</h2>
      <div className="seg">
        {([["week", "Semana"], ["lastWeek", "Anterior"], ["allTime", "Geral"]] as const).map(([k, label]) => (
          <button key={k} className="btn small" aria-pressed={which === k} onClick={() => setWhich(k)}>{label}</button>
        ))}
      </div>
      <table className="rank">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.playerId} className={r.playerId === state.me.id ? "me" : ""}>
              <td className="pos">{r.points > 0 && i < 3 ? medals[i] : `${i + 1}º`}</td>
              <td>
                <span className="row">
                  <Avatar avatar={r.avatar} />
                  <span>{r.name}<br /><span className="small muted">{PROFESSIONS[r.profession].name}</span></span>
                </span>
              </td>
              <td className="pts">{r.points.toLocaleString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ marginTop: 8 }}>
        Pontos vêm de doações ao sítio. A semana vira toda segunda às 00:00 (Brasília).
      </p>
    </section>
  );
}

export type { Bag };
