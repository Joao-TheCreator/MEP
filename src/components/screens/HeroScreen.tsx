"use client";

import { useState } from "react";
import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  LEVEL,
  NIGHT_CLASS_ROLE,
  NIGHT_ROLES,
  NIGHT_WEAPONS,
  PLAYABLE_NIGHT_CLASSES,
  SLOTS,
  TALENTS,
  TIERS,
  WORK_TOOLS,
  type BonusKey,
  type SlotKey,
  type TierKey,
} from "@/game/config";
import { hasEnough } from "@/game/rules";
import {
  attributeAction,
  dismantleItemAction,
  equipBestAction,
  equipItemAction,
  nightClassAction,
  refineGearAction,
  talentAction,
  upgradeGearAction,
} from "@/app/actions";
import type { AvatarKey } from "@/art/avatars";
import { Walker } from "@/art/WalkerSprite";
import { ResList } from "../Res";
import type { ScreenProps } from "./types";

const BONUS_TEXT: Record<BonusKey, (v: number) => string> = {
  productionPct: (v) => `+${v}% produção`,
  storageMinutes: (v) => `+${v} min de armazém`,
  craftExtraPct: (v) => `${v}% fabricar em dobro`,
  donationProgressPct: (v) => `+${v}% doação na obra`,
  energyRegenPct: (v) => `+${v}% energia`,
  damagePct: (v) => `+${v}% dano`,
  healthPct: (v) => `+${v}% vida`,
  attackSpeedPct: (v) => `+${v}% velocidade`,
  specialChargePct: (v) => `+${v}% carga do especial`,
  healPct: (v) => `+${v}% cura`,
};

const LEFT: SlotKey[] = ["hat", "body", "hands", "feet"];
const RIGHT: SlotKey[] = ["weapon", "tool", "pin", "bracelet"];
type PanelTab = "item" | "bag" | "attrs" | "talents" | "class";

/**
 * The hero tab (design §11, §12; layout from issue #22): the resident in the
 * middle with the eight gear slots around, and a tabbed panel for the selected
 * item, attributes, talents and night class. Lying down the two sit side by
 * side and the page does not scroll; standing up they stack.
 * Only the gear survives a wipe.
 */
export function HeroScreen({ state, act, pending }: ScreenProps) {
  const { me, inventory } = state;
  const c = me.character;
  const xpPct = c.xpForNext ? Math.round((c.xpIntoLevel / c.xpForNext) * 100) : 100;
  const tree = TALENTS[me.profession];
  const [slot, setSlot] = useState<SlotKey>("weapon");
  const [tab, setTab] = useState<PanelTab>("item");
  const [picked, setPicked] = useState<string | null>(null);
  const better = new Set(c.betterInBag);

  const itemName = (k: SlotKey) =>
    k === "tool" ? WORK_TOOLS[me.profession].name : k === "weapon" ? NIGHT_WEAPONS[c.nightClass].name : SLOTS[k].itemName;
  const gearOf = (k: SlotKey) => c.gear.find((g) => g.slot === k)!;
  const stepCost = (k: SlotKey) => gearOf(k).upgradeCost ?? gearOf(k).refineCost;
  const canStep = (k: SlotKey) => {
    const cost = stepCost(k);
    return cost !== null && hasEnough(inventory, cost);
  };
  const talentOpen = LEVEL.talentLevels.some((lv, i) => c.level >= lv && (c.talents[i] === null || c.talents[i] === undefined));

  const slotButton = (k: SlotKey) => {
    const g = gearOf(k);
    const tier = TIERS[g.tier as TierKey];
    return (
      <button key={k} type="button" className="slot-btn" aria-pressed={slot === k && tab === "item"}
        onClick={() => { setSlot(k); setTab("item"); }} style={{ borderColor: tier.color }}>
        <span className="slot-label">{SLOTS[k].label}</span>
        <b style={{ color: tier.color }}>{tier.name}{g.refine > 0 ? ` +${g.refine}` : ""}</b>
        {canStep(k) && <span className="slot-dot" aria-label="Dá para melhorar" />}
        {better.has(k) && <span className="slot-better" aria-label="Tem melhor na mochila">↑</span>}
      </button>
    );
  };

  const g = gearOf(slot);
  const tier = TIERS[g.tier as TierKey];

  return (
    <div className="hero-layout">
      <section className="panel hero-board">
        <div className="hero-head">
          <h2>{me.name} · nível {c.level}</h2>
          <div className="bar"><i style={{ width: `${xpPct}%` }} /></div>
          <div className="bar energy" title="Energia"><i style={{ width: `${(me.energy.now / me.energy.max) * 100}%` }} /></div>
          <p className="small muted">
            {c.xpForNext ? `${c.xpIntoLevel} / ${c.xpForNext} XP` : "Nível máximo"} · energia {me.energy.now}/{me.energy.max}
          </p>
        </div>
        <div className="hero-doll">
          <div className="slots">{LEFT.map(slotButton)}</div>
          <div className="doll">
            <Walker avatar={me.avatar as AvatarKey} direction="down" walking={false} scale={5} />
            <span className="small">{NIGHT_WEAPONS[c.nightClass].className}</span>
            <span className="small muted">força {c.power.patrol} na ronda</span>
          </div>
          <div className="slots">{RIGHT.map(slotButton)}</div>
        </div>
      </section>

      <section className="panel hero-panel">
        <div className="seg hero-tabs">
          <button className="btn small" aria-pressed={tab === "item"} onClick={() => setTab("item")}>Item</button>
          <button className="btn small" aria-pressed={tab === "bag"} onClick={() => setTab("bag")}>
            Mochila ({c.bag.length}){better.size > 0 ? " ↑" : ""}
          </button>
          <button className="btn small" aria-pressed={tab === "attrs"} onClick={() => setTab("attrs")}>
            Atributos{c.freePoints > 0 ? ` (${c.freePoints})` : ""}
          </button>
          <button className="btn small" aria-pressed={tab === "talents"} onClick={() => setTab("talents")}>
            Talentos{talentOpen ? " •" : ""}
          </button>
          <button className="btn small" aria-pressed={tab === "class"} onClick={() => setTab("class")}>Classe</button>
        </div>

        <div className="hero-panel-body stack">
          {tab === "item" && (
            <>
              <div>
                <h2><span style={{ color: tier.color }}>{tier.name}</span> {itemName(slot)}{g.refine > 0 ? ` +${g.refine}` : ""}</h2>
                <p className="small muted">{SLOTS[slot].label} · {BONUS_TEXT[SLOTS[slot].stat](g.value)}</p>
              </div>
              {g.upgradeCost && (
                <>
                  <p className="small">Próximo tier:</p>
                  <ResList bag={g.upgradeCost} have={inventory} />
                  <button className="btn big" disabled={pending || !hasEnough(inventory, g.upgradeCost)}
                    onClick={() => act(() => upgradeGearAction(slot))}>Melhorar</button>
                </>
              )}
              {!g.upgradeCost && g.refineCost && (
                <>
                  <p className="small">Refinar para +{g.refine + 1}:</p>
                  <ResList bag={g.refineCost} have={inventory} />
                  <button className="btn big secondary" disabled={pending || !hasEnough(inventory, g.refineCost)}
                    onClick={() => act(() => refineGearAction(slot))}>Refinar +{g.refine + 1}</button>
                </>
              )}
              <p className="small muted">
                O equipamento e a mochila ficam quando a fogueira apaga; nível, atributos e talentos zeram.
              </p>
            </>
          )}

          {tab === "bag" && (() => {
            const sel = c.bag.find((it) => it.id === picked) ?? null;
            return (
              <>
                <div className="row between">
                  <span className="small muted">{c.bag.length} de {c.bagCapacity} espaços</span>
                  {better.size > 0 && (
                    <button className="btn small" disabled={pending} onClick={() => act(equipBestAction)}>Equipar o melhor</button>
                  )}
                </div>
                {c.bag.length === 0 ? (
                  <p className="small muted">
                    Vazia. Cada estrela da ronda e das expedições tem chance de achar um item pronto; noites mais altas dão
                    itens melhores.
                  </p>
                ) : (
                  <div className="bag-grid">
                    {c.bag.map((it) => {
                      const t = TIERS[it.tier];
                      return (
                        <button key={it.id} type="button" className="bag-item" aria-pressed={picked === it.id}
                          style={{ borderColor: t.color }} onClick={() => setPicked(picked === it.id ? null : it.id)}>
                          <span className="slot-label">{SLOTS[it.slot].label}</span>
                          <b style={{ color: t.color }}>{t.name}{it.refine ? ` +${it.refine}` : ""}</b>
                          {it.gain > 0 && <span className="slot-better">↑</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {sel && (
                  <div className="bag-detail stack">
                    <b>
                      <span style={{ color: TIERS[sel.tier].color }}>{TIERS[sel.tier].name}</span> {itemName(sel.slot)}
                      {sel.refine ? ` +${sel.refine}` : ""}
                    </b>
                    <span className="small">
                      {BONUS_TEXT[SLOTS[sel.slot].stat](sel.value)} ·{" "}
                      {sel.gain > 0 ? <b className="ok-text">{BONUS_TEXT[SLOTS[sel.slot].stat](sel.gain)} a mais</b> : sel.gain < 0 ? "pior que o seu" : "igual ao seu"}
                    </span>
                    <div className="row wrap" style={{ gap: 6 }}>
                      <button className="btn small" disabled={pending} onClick={() => { act(() => equipItemAction(sel.id)); setPicked(null); }}>Equipar</button>
                      <button className="btn small secondary" disabled={pending} onClick={() => { act(() => dismantleItemAction(sel.id)); setPicked(null); }}>Desmontar</button>
                      {Object.keys(sel.dismantle).length > 0 && <ResList bag={sel.dismantle} />}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {tab === "attrs" && (
            <>
              <p className="small">{c.freePoints > 0 ? <b>{c.freePoints} ponto(s) livre(s)</b> : <span className="muted">Você ganha 1 ponto por nível.</span>}</p>
              {ATTRIBUTE_KEYS.map((k) => (
                <div key={k} className="row between attr-row">
                  <span><b>{ATTRIBUTES[k].name}</b> {c.attributes[k]}<br /><span className="small muted">{ATTRIBUTES[k].description}</span></span>
                  <button className="btn small" disabled={pending || c.freePoints < 1} onClick={() => act(() => attributeAction(k))}>+1</button>
                </div>
              ))}
            </>
          )}

          {tab === "talents" && tree.map((pair, i) => {
            const at = LEVEL.talentLevels[i];
            const chosen = c.talents[i];
            const open = c.level >= at;
            return (
              <div key={i} className="stack" style={{ gap: 4 }}>
                <span className="small muted">Nível {at}{open ? "" : " (fechado)"}</span>
                <div className="talent-pair">
                  {pair.map((t, o) => (
                    <button key={t.key} className="talent" aria-pressed={chosen === o}
                      disabled={pending || !open || (chosen !== null && chosen !== undefined)}
                      onClick={() => act(() => talentAction(i, o))}>
                      <b>{t.name}</b>
                      <span className="small">{t.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {tab === "class" && (
            <>
              <div className="class-pick">
                {PLAYABLE_NIGHT_CLASSES.map((k) => {
                  const role = NIGHT_ROLES[NIGHT_CLASS_ROLE[k]];
                  return (
                    <button key={k} className="talent" aria-pressed={c.nightClass === k}
                      disabled={pending || c.nightClass === k || me.patrolledTonight}
                      onClick={() => act(() => nightClassAction(k))}>
                      <b>{NIGHT_WEAPONS[k].className}</b>
                      <span className="small">{role.name}</span>
                      <span className="small muted">{role.description}</span>
                    </button>
                  );
                })}
              </div>
              <p className="small muted">
                {me.patrolledTonight
                  ? "Classe travada: você já fez a ronda de hoje. Dá para trocar amanhã."
                  : "Troque à vontade antes da ronda. Veja o que o time precisa na aba Noite."}
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
