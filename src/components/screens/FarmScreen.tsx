"use client";

import { PROFESSIONS, type ResourceKey } from "@/game/config";
import { FarmScene } from "@/art/FarmScene";
import { donateAction } from "@/app/actions";
import { Res } from "../Res";
import type { ScreenProps } from "./types";

export function FarmScreen({ state, act, pending }: ScreenProps) {
  const { farm, inventory, members, me } = state;
  const b = farm.building;
  const residents = members.map((m) => ({
    id: m.id,
    name: m.id === me.id ? `${m.name} (você)` : m.name,
    avatar: m.avatar,
    subtitle: `${PROFESSIONS[m.profession].name} · nv. ${m.workshopLevel}`,
  }));
  return (
    <>
      <section className="panel map-frame">
        <FarmScene completed={farm.completed} building={b?.key} residents={residents} highlightId={me.id} />
      </section>
      <p className="small" style={{ color: "var(--paper-dark)", margin: "-4px 2px 0" }}>
        Arraste para explorar · toque em alguém para ver quem é
      </p>
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
