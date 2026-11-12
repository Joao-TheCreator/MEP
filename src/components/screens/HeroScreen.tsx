"use client";

import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  LEVEL,
  NIGHT_WEAPONS,
  SLOTS,
  TALENTS,
  TIERS,
  WORK_TOOLS,
  type BonusKey,
  type SlotKey,
  type TierKey,
} from "@/game/config";
import { hasEnough } from "@/game/rules";
import { attributeAction, nightClassAction, refineGearAction, talentAction, upgradeGearAction } from "@/app/actions";
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

/**
 * The hero tab (design §11, §12): level, attributes, talents, night class and
 * the eight gear slots. Only the gear survives a wipe.
 */
export function HeroScreen({ state, act, pending }: ScreenProps) {
  const { me, inventory } = state;
  const c = me.character;
  const xpPct = c.xpForNext ? Math.round((c.xpIntoLevel / c.xpForNext) * 100) : 100;
  const tree = TALENTS[me.profession];

  const itemName = (slot: SlotKey) =>
    slot === "tool" ? WORK_TOOLS[me.profession].name : slot === "weapon" ? NIGHT_WEAPONS[c.nightClass].name : SLOTS[slot].itemName;

  return (
    <>
      <section className="panel stack">
        <div className="row">
          <Walker avatar={me.avatar as AvatarKey} direction="down" walking={false} scale={3} />
          <div className="grow">
            <h2>{me.name} · nível {c.level}</h2>
            <div className="bar"><i style={{ width: `${xpPct}%` }} /></div>
            <p className="small muted">
              {c.xpForNext ? `${c.xpIntoLevel} / ${c.xpForNext} XP` : "Nível máximo"} · força à noite {c.power.patrol} (ronda) / {c.power.rest} (dormindo)
            </p>
          </div>
        </div>
        <div className="seg">
          {(["volley", "mattress"] as const).map((k) => (
            <button key={k} className="btn small" aria-pressed={c.nightClass === k} disabled={pending || c.nightClass === k}
              onClick={() => act(() => nightClassAction(k))}>{NIGHT_WEAPONS[k].className}</button>
          ))}
        </div>
        <p className="small muted">Nível, atributos e talentos zeram se a fogueira apagar. O equipamento fica.</p>
      </section>

      <section className="panel stack">
        <div className="row between">
          <h2>Equipamento</h2>
          <span className="small muted">fica no wipe</span>
        </div>
        {c.gear.map((g) => {
          const tier = TIERS[g.tier as TierKey];
          const stat = SLOTS[g.slot].stat;
          return (
            <div key={g.slot} className="gear-row">
              <div className="row between">
                <span>
                  <b style={{ color: tier.color }}>{tier.name}</b> {itemName(g.slot)}{g.refine > 0 && <b> +{g.refine}</b>}
                </span>
                <span className="small muted">{SLOTS[g.slot].label} · {BONUS_TEXT[stat](g.value)}</span>
              </div>
              <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                {g.upgradeCost && (
                  <button className="btn small" disabled={pending || !hasEnough(inventory, g.upgradeCost)}
                    onClick={() => act(() => upgradeGearAction(g.slot))}>Melhorar</button>
                )}
                {g.upgradeCost && <ResList bag={g.upgradeCost} have={inventory} />}
                {!g.upgradeCost && g.refineCost && (
                  <>
                    <button className="btn small secondary" disabled={pending || !hasEnough(inventory, g.refineCost)}
                      onClick={() => act(() => refineGearAction(g.slot))}>Refinar +{g.refine + 1}</button>
                    <ResList bag={g.refineCost} have={inventory} />
                  </>
                )}
              </div>
            </div>
          );
        })}
        <p className="small muted">Melhore o tier até Diamante; depois, refine sem limite. Tábua, Barra e Ferramenta vêm do Carpinteiro e do Ferreiro.</p>
      </section>

      <section className="panel stack">
        <div className="row between">
          <h2>Atributos</h2>
          <span className="small">{c.freePoints > 0 ? <b>{c.freePoints} ponto(s) livre(s)</b> : <span className="muted">1 ponto por nível</span>}</span>
        </div>
        {ATTRIBUTE_KEYS.map((k) => (
          <div key={k} className="row between">
            <span><b>{ATTRIBUTES[k].name}</b> {c.attributes[k]}<br /><span className="small muted">{ATTRIBUTES[k].description}</span></span>
            <button className="btn small" disabled={pending || c.freePoints < 1} onClick={() => act(() => attributeAction(k))}>+1</button>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <h2>Talentos</h2>
        {tree.map((pair, i) => {
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
      </section>
    </>
  );
}
