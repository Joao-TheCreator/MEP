import { NightGame } from "@/prototype/night/NightGame";

export const metadata = { title: "Ronda da noite (protótipo) — Sítio Dae Han" };

/** Prototype of the night patrol (issue #14). Client-only, nothing is saved. */
export default function NightPrototypePage() {
  return (
    <main className="shell night">
      <div className="hero" style={{ paddingTop: 12 }}>
        <h1>Ronda da noite</h1>
        <p>Protótipo · Vôlei e Colchonete</p>
      </div>
      <NightGame />
    </main>
  );
}
