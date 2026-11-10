"use client";

import { useState } from "react";
import { PROFESSIONS, RESOURCES, type ResourceKey } from "@/game/config";
import { logout, sendAction } from "@/app/actions";
import { ResIcon } from "../Res";
import { Avatar } from "../Avatar";
import type { ScreenProps } from "./types";

export function StockScreen({ state, act, pending }: ScreenProps) {
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
