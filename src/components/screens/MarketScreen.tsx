"use client";

import { useState } from "react";
import { MARKET, RESOURCES, RESOURCE_KEYS, type ResourceKey } from "@/game/config";
import { buyCost, maxBuyable, sellValue } from "@/game/market";
import { buyAction, sellAction } from "@/app/actions";
import { Sprite } from "@/art/pixel";
import { COIN } from "@/art/coin";
import { ResIcon } from "../Res";
import type { ScreenProps } from "./types";

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function Coins({ n }: { n: number }) {
  return (
    <span className="coins"><Sprite sprite={COIN} scale={2} title="Moedas" />{fmt(n)}</span>
  );
}

/**
 * The Vendinha (design §16): sell what you make for coins and buy any
 * material, much dearer than trading with a friend.
 */
export function MarketScreen({ state, act, pending }: ScreenProps) {
  const { me, inventory, market } = state;
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const left = Math.max(0, market.limit - market.used);
  const own = RESOURCE_KEYS.filter((r) => (inventory[r] ?? 0) > 0);

  return (
    <>
      <section className="panel stack">
        <div className="row between">
          <h2>Vendinha</h2>
          <Coins n={me.coins} />
        </div>
        <p className="small muted">
          Vende pela metade do valor e compra pelo dobro. Trocar com um amigo sai {MARKET.buyPct / MARKET.sellPct}× mais
          barato; a Vendinha é para ninguém ficar travado.
        </p>
        <div className="seg">
          <button className="btn small" aria-pressed={mode === "buy"} onClick={() => setMode("buy")}>Comprar</button>
          <button className="btn small" aria-pressed={mode === "sell"} onClick={() => setMode("sell")}>Vender</button>
        </div>

        {mode === "buy" ? (
          <>
            <div className="bar"><i style={{ width: `${Math.min(100, (market.used / market.limit) * 100)}%` }} /></div>
            <p className="small muted">Limite de hoje: {fmt(market.used)} de {fmt(market.limit)} pontos usados. Cresce com o seu nível.</p>
            {RESOURCE_KEYS.map((r) => <BuyRow key={r} r={r} coins={me.coins} left={left} have={inventory[r] ?? 0} act={act} pending={pending} />)}
          </>
        ) : own.length === 0 ? (
          <p className="muted">Nada para vender. Colete sua produção na Oficina.</p>
        ) : (
          own.map((r) => <SellRow key={r} r={r} have={inventory[r] ?? 0} act={act} pending={pending} />)
        )}
      </section>
    </>
  );
}

type RowProps = Pick<ScreenProps, "act" | "pending"> & { r: ResourceKey; have: number };

function BuyRow({ r, coins, left, have, act, pending }: RowProps & { coins: number; left: number }) {
  const max = maxBuyable(r, coins, left);
  return (
    <div className="market-row">
      <ResIcon r={r} scale={3} />
      <div className="grow">
        <b>{RESOURCES[r].name}</b>
        <div className="small muted">{buyCost(r, 1)} moedas cada · você tem {fmt(have)}</div>
      </div>
      {[1, 10].map((n) => (
        <button key={n} className="btn small secondary" disabled={pending || max < n} onClick={() => act(() => buyAction(r, n))}>+{n}</button>
      ))}
      <button className="btn small" disabled={pending || max < 1} onClick={() => act(() => buyAction(r, max))}>Máx ({max})</button>
    </div>
  );
}

function SellRow({ r, have, act, pending }: RowProps) {
  const half = Math.floor(have / 2);
  return (
    <div className="market-row">
      <ResIcon r={r} scale={3} />
      <div className="grow">
        <b>{RESOURCES[r].name}</b>
        <div className="small muted">você tem {fmt(have)} · tudo vale {fmt(sellValue(r, have))} moedas</div>
      </div>
      <button className="btn small secondary" disabled={pending || sellValue(r, half) < 1} onClick={() => act(() => sellAction(r, half))}>Metade</button>
      <button className="btn small" disabled={pending || sellValue(r, have) < 1} onClick={() => act(() => sellAction(r, have))}>Tudo</button>
    </div>
  );
}
