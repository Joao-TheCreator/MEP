"use client";

import { useState } from "react";
import { MARKET, RESOURCES, RESOURCE_KEYS, type ResourceKey } from "@/game/config";
import { buyCost, maxBuyable, sellValue, surplusToSell } from "@/game/market";
import { PROFESSIONS } from "@/game/config";
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
  // what is spare of the player's own raw resource: all of it minus what the
  // building still needs and what the next workshop upgrade costs
  const raw = PROFESSIONS[me.profession].produces;
  const b = state.farm.building;
  const keepBuilding = b ? Math.max(0, (b.cost[raw] ?? 0) - (state.farm.progress[raw] ?? 0)) : 0;
  const keepWorkshop = me.upgradeCost?.[raw] ?? 0;
  const spare = surplusToSell(inventory[raw] ?? 0, [keepBuilding, keepWorkshop]);

  return (
    <>
      <section className="panel stack">
        <div className="row between">
          <h2>Vendinha</h2>
          <Coins n={me.coins} />
        </div>
        <p className="small muted">
          Vende por {MARKET.sellPct}% do valor e compra por {market.buyPct}%
          {market.buyPct < MARKET.buyPct ? " (mais barato desde que a Vendinha ficou pronta)" : ""}. Trocar com um amigo sai
          bem mais barato; a loja é para ninguém ficar travado.
        </p>
        <div className="seg">
          <button className="btn small" aria-pressed={mode === "buy"} onClick={() => setMode("buy")}>Comprar</button>
          <button className="btn small" aria-pressed={mode === "sell"} onClick={() => setMode("sell")}>Vender</button>
        </div>

        {mode === "buy" ? (
          <>
            <div className="bar"><i style={{ width: `${Math.min(100, (market.used / market.limit) * 100)}%` }} /></div>
            <p className="small muted">Limite de hoje: {fmt(market.used)} de {fmt(market.limit)} pontos usados. Cresce com o seu nível.</p>
            {RESOURCE_KEYS.map((r) => <BuyRow key={r} r={r} coins={me.coins} left={left} buyPct={market.buyPct} have={inventory[r] ?? 0} act={act} pending={pending} />)}
          </>
        ) : null}
        {mode === "sell" && spare > 0 && sellValue(raw, spare) > 0 && (
          <div className="stack surplus">
            <button className="btn big" disabled={pending} onClick={() => act(() => sellAction(raw, spare))}>
              Vender o excedente: {fmt(spare)} de {RESOURCES[raw].name} por {fmt(sellValue(raw, spare))} moedas
            </button>
            <p className="small muted">
              Guarda {fmt(keepBuilding)} para a obra e {fmt(keepWorkshop)} para melhorar a oficina.
            </p>
          </div>
        )}
        {mode === "buy" ? null : own.length === 0 ? (
          <p className="muted">Nada para vender. Colete sua produção na Oficina.</p>
        ) : (
          own.map((r) => <SellRow key={r} r={r} have={inventory[r] ?? 0} act={act} pending={pending} />)
        )}
      </section>
    </>
  );
}

type RowProps = Pick<ScreenProps, "act" | "pending"> & { r: ResourceKey; have: number };

function BuyRow({ r, coins, left, have, buyPct, act, pending }: RowProps & { coins: number; left: number; buyPct: number }) {
  const max = maxBuyable(r, coins, left, buyPct);
  return (
    <div className="market-row">
      <ResIcon r={r} scale={3} />
      <div className="grow">
        <b>{RESOURCES[r].name}</b>
        <div className="small muted">{buyCost(r, 1, buyPct)} moedas cada · você tem {fmt(have)}</div>
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
