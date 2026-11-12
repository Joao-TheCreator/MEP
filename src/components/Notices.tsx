"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NOTIFY, NOTIFY_KINDS } from "@/game/config";
import { notifyPrefAction, subscribePushAction, unsubscribePushAction, type ActionResult } from "@/app/actions";
import type { GameState } from "@/server/game";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Support = "ok" | "no-key" | "unsupported" | "ios-install" | "denied";

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Some browsers never answer the push subscription (no push service): give up instead of hanging. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

function detectSupport(): Support {
  if (!VAPID) return "no-key";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !standalone ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

const SUPPORT_TEXT: Record<Exclude<Support, "ok">, string> = {
  "no-key": "Os avisos ainda não foram configurados neste servidor (chaves VAPID). Eles chegam depois do deploy.",
  unsupported: "Este navegador não recebe avisos. Tente pelo Chrome ou instale o app na tela inicial.",
  "ios-install": "No iPhone, os avisos só chegam com o app instalado: toque em Compartilhar → \"Adicionar à Tela de Início\" e abra por lá.",
  denied: "Os avisos foram bloqueados neste aparelho. Libere nas configurações do navegador para este site.",
};

/**
 * The bell on the top bar (design §23): turns phone notices on for this device
 * and picks which kinds the person wants.
 */
export function Notices({ state, act, pending }: { state: GameState; act: (fn: () => Promise<ActionResult>) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [support, setSupport] = useState<Support>("ok");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const { notify } = state.me;

  useEffect(() => {
    setSupport(detectSupport());
    if (!("serviceWorker" in navigator)) return setSubscribed(false);
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      setSubscribed(Boolean(await reg?.pushManager.getSubscription()));
    }).catch(() => setSubscribed(false));
  }, []);

  const turnOn = () =>
    act(async () => {
      try {
        return await subscribeHere();
      } catch {
        return { ok: false, message: "Não deu para ligar os avisos neste navegador. Tente pelo app instalado." };
      }
    });

  const subscribeHere = async (): Promise<ActionResult> => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport(permission === "denied" ? "denied" : "ok");
        return { ok: false, message: "Sem permissão, os avisos não chegam." };
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }), 20_000));
      const r = await subscribePushAction(sub.toJSON());
      if (r.ok) setSubscribed(true);
      return r;
  };

  const turnOff = () =>
    act(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return { ok: true, message: "Avisos desligados neste aparelho." };
      }
      const r = await unsubscribePushAction(sub.endpoint);
      await sub.unsubscribe().catch(() => {});
      setSubscribed(false);
      return r;
    });

  const anyOn = subscribed === true;
  return (
    <>
      <button type="button" className={`icon-btn ${anyOn ? "on" : ""}`} aria-label="Avisos no celular" aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <Bell off={!anyOn} />
      </button>
      {open && createPortal(
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <section className="panel stack sheet" role="dialog" aria-label="Avisos no celular" onClick={(e) => e.stopPropagation()}>
            <div className="row between">
              <h2>Avisos no celular</h2>
              <button type="button" className="btn small secondary" onClick={() => setOpen(false)}>Fechar</button>
            </div>
            {support !== "ok" ? (
              <p className="small">{SUPPORT_TEXT[support]}</p>
            ) : anyOn ? (
              <div className="row between">
                <span className="small ok-text">Ligados neste aparelho.</span>
                <button type="button" className="btn small secondary" disabled={pending} onClick={turnOff}>Desligar aqui</button>
              </div>
            ) : (
              <button type="button" className="btn big" disabled={pending || subscribed === null} onClick={turnOn}>Ativar avisos</button>
            )}
            <p className="small muted">
              {notify.devices === 0 ? "Nenhum aparelho seu recebe avisos ainda." : `${notify.devices} aparelho(s) seu(s) recebe(m) avisos.`}{" "}
              Nada chega entre {NOTIFY.quietFromHour}h e {NOTIFY.quietToHour}h.
            </p>
            <div className="stack" style={{ gap: 4 }}>
              {NOTIFY_KINDS.map((k) => (
                <label key={k} className="row between notify-row">
                  <span>{NOTIFY.labels[k]}</span>
                  <input type="checkbox" checked={notify.on[k]} disabled={pending}
                    onChange={(e) => act(() => notifyPrefAction(k, e.target.checked))} />
                </label>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Pixel bell for the top bar; a slash when this device gets no notices. */
function Bell({ off }: { off: boolean }) {
  const rows = ["...##...", "..####..", ".######.", ".######.", ".######.", "########", "........", "...##..."];
  return (
    <svg width={20} height={20} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#f3d27a" /> : null)))}
      {off && <path d="M0.5 7.5 L7.5 0.5" stroke="#e5566b" strokeWidth={1} />}
    </svg>
  );
}
