"use client";

import { useState } from "react";
import { BUILDINGS, PROFESSIONS, type ResourceKey } from "@/game/config";
import { FarmScene } from "@/art/FarmScene";
import { LANDMARKS, type PlaceKey } from "@/art/FarmMap";
import { farmHour, isNight } from "@/art/daylight";
import type { Spot } from "@/art/FarmScene";
import type { ProfessionKey } from "@/game/config";
import { collectAction, donateAction, donateAllAction } from "@/app/actions";
import { computeProduction } from "@/game/rules";
import { NIGHT_CLASS_ROLE, NIGHT_ROLES, PROFESSIONS as PROFS, RESOURCES } from "@/game/config";
import { Res } from "../Res";
import type { ScreenProps } from "./types";

/**
 * The farm tab: the live map fills the screen; the current construction (or
 * the building the player tapped) lives in a drawer at the bottom.
 */
/** Work place of each profession on the map. */
const WORK_SPOT: Record<ProfessionKey, Spot> = { farmer: "crops", rancher: "pen", carpenter: "sawmill", blacksmith: "forge" };

export function FarmScreen({ state, now, act, pending, openNight }: ScreenProps) {
  const { farm, inventory, members, me } = state;
  const b = farm.building;
  const [picked, setPicked] = useState<PlaceKey | null>(null);
  const [open, setOpen] = useState(false);

  // by day everyone is near their work place; at night, those who patrolled sit by the fire
  const hour = farmHour(now);
  const night = isNight(hour);
  const residents = members.map((m) => ({
    spot: night && m.patrolled ? ("camp" as const) : WORK_SPOT[m.profession],
    id: m.id,
    name: m.id === me.id ? `${m.name} (você)` : m.name,
    avatar: m.avatar,
    subtitle: `${PROFESSIONS[m.profession].name} nv. ${m.workshopLevel} · ${NIGHT_ROLES[NIGHT_CLASS_ROLE[m.nightClass]].name} à noite`,
  }));

  const placeLabels: Partial<Record<PlaceKey, string>> = {};
  for (const bd of BUILDINGS) placeLabels[bd.key as PlaceKey] = bd.name;

  // tapping a building opens the drawer on it; tapping the ground or a
  // resident puts the drawer away so the map is free again
  const pick = (p: PlaceKey | null) => {
    setPicked(p);
    setOpen(p !== null);
  };

  // what the drawer shows: the tapped building, else the construction in progress
  const showingPicked = picked !== null && picked !== b?.key;

  return (
    <div className="farm-stage">
      <FarmScene
        completed={farm.completed}
        building={b?.key}
        residents={residents}
        highlightId={me.id}
        selectedPlace={picked}
        onSelectPlace={pick}
        placeLabels={placeLabels}
        hour={hour}
        fire={state.night.fireHp / state.night.fireMax}
        onFire={openNight}
      />
      <div className="stage-top">
        <span className={`chip fire-chip ${state.night.defense < state.night.horde ? "danger" : ""}`}>
          Fogueira {Math.round((state.night.fireHp / state.night.fireMax) * 100)}% · noite {state.night.night} às 20h
        </span>
        <InviteButton code={farm.inviteCode} />
      </div>

      <section className={`drawer ${open ? "open" : ""}`} aria-label="Construção">
        {showingPicked ? (
          <PlaceDrawer
            place={picked!}
            completed={farm.completed}
            open={open}
            setOpen={setOpen}
            onClose={() => setPicked(null)}
            work={picked === WORK_SPOT[me.profession] ? {
              units: computeProduction({
                profession: me.profession,
                workshopLevel: me.workshopLevel,
                farmLevel: farm.level,
                lastCollectedAt: new Date(me.lastCollectedAt),
                now,
              }).units,
              resource: RESOURCES[PROFS[me.profession].produces].name,
              collect: () => act(collectAction),
              pending,
            } : undefined}
          />
        ) : b ? (
          <BuildingDrawer
            building={b}
            progress={farm.progress}
            inventory={inventory}
            open={open}
            setOpen={setOpen}
            pending={pending}
            act={act}
          />
        ) : (
          <DrawerHandle title="Tudo construído!" subtitle="Em breve: novas construções." open={open} setOpen={setOpen} />
        )}
      </section>
    </div>
  );
}

function DrawerHandle({
  title,
  subtitle,
  pct,
  open,
  setOpen,
}: {
  title: string;
  subtitle?: string;
  pct?: number;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  return (
    <button type="button" className="drawer-handle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="grow">
        <span className="drawer-title">{title}</span>
        {subtitle && <span className="small muted drawer-sub">{subtitle}</span>}
        {pct !== undefined && (
          <span className="bar drawer-bar"><i style={{ width: `${pct * 100}%` }} /></span>
        )}
      </span>
      <span className={`caret ${open ? "down" : "up"}`} aria-hidden />
    </button>
  );
}

function BuildingDrawer({
  building: b,
  progress,
  inventory,
  open,
  setOpen,
  pending,
  act,
}: {
  building: NonNullable<ScreenProps["state"]["farm"]["building"]>;
  progress: ScreenProps["state"]["farm"]["progress"];
  inventory: ScreenProps["state"]["inventory"];
  open: boolean;
  setOpen: (o: boolean) => void;
  pending: boolean;
  act: ScreenProps["act"];
}) {
  const rows = Object.entries(b.cost) as [ResourceKey, number][];
  const totalNeed = rows.reduce((s, [, n]) => s + n, 0);
  const totalDone = rows.reduce((s, [r, n]) => s + Math.min(n, progress[r] ?? 0), 0);
  const pct = totalNeed ? totalDone / totalNeed : 0;
  return (
    <>
      <DrawerHandle title={`Construindo: ${b.name}`} subtitle={`${Math.round(pct * 100)}% pronto`} pct={pct} open={open} setOpen={setOpen} />
      <div className="drawer-body stack">
        <p className="small muted">{b.description}</p>
        {(() => {
          const useful = rows.filter(([r, need]) => Math.min(inventory[r] ?? 0, need - (progress[r] ?? 0)) > 0).length;
          return useful > 0 ? (
            <button className="btn big" disabled={pending} onClick={() => act(donateAllAction)}>
              Doar o que falta ({useful} {useful === 1 ? "material" : "materiais"})
            </button>
          ) : null;
        })()}
        {rows.map(([r, need]) => {
          const done = progress[r] ?? 0;
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
      </div>
    </>
  );
}

function PlaceDrawer({
  place,
  completed,
  open,
  setOpen,
  onClose,
  work,
}: {
  place: PlaceKey;
  completed: string[];
  open: boolean;
  setOpen: (o: boolean) => void;
  onClose: () => void;
  /** Set when this is the player's own work place: they can collect right here. */
  work?: { units: number; resource: string; collect: () => void; pending: boolean };
}) {
  const building = BUILDINGS.find((bd) => bd.key === place);
  const landmark = place in LANDMARKS ? LANDMARKS[place as keyof typeof LANDMARKS] : null;
  const name = building?.name ?? landmark?.name ?? place;
  const description = building?.description ?? landmark?.description ?? "";
  const status = building ? (completed.includes(place) ? "Pronto" : "Em obras") : "Lugar do sítio";
  return (
    <>
      <DrawerHandle title={name} subtitle={work ? "Seu local de trabalho" : status} open={open} setOpen={setOpen} />
      <div className="drawer-body stack">
        <p className="small muted">{description}</p>
        {work && (
          <button className="btn big green" disabled={work.pending || work.units < 1} onClick={work.collect}>
            {work.units < 1 ? "Nada para coletar ainda" : `Coletar ${work.units.toLocaleString("pt-BR")} de ${work.resource}`}
          </button>
        )}
        <button className="btn small secondary" onClick={onClose}>Voltar para a obra</button>
      </div>
    </>
  );
}

function InviteButton({ code }: { code: string }) {
  const share = async () => {
    const url = `${location.origin}/onboarding?code=${code}`;
    const text = `Vem cuidar do sítio comigo! Código: ${code}`;
    if (navigator.share) await navigator.share({ title: "Sítio Dae Han", text, url }).catch(() => {});
    else await navigator.clipboard?.writeText(`${text} ${url}`);
  };
  return (
    <button className="btn small secondary" onClick={share} title={`Código ${code}`}>
      Convidar · {code}
    </button>
  );
}
