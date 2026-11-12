import { RESOURCES, RESOURCE_KEYS } from "@/game/config";
import { FarmMap } from "@/art/FarmMap";
import { FarmScene } from "@/art/FarmScene";
import { Sprite } from "@/art/pixel";
import { AVATARS, AVATAR_KEYS, AVATAR_SPRITES } from "@/art/avatars";
import { Walker } from "@/art/WalkerSprite";
import { WALKERS } from "@/art/walker";
import {
  BARN, CONSTRUCTION, HOUSE, LOGO, MILL, PALM, POOL, RESOURCE_SPRITES, TREE, TREE_DARK, WELL, templeSprite,
} from "@/art/sprites";

const SPOTS = ["crops", "pen", "sawmill", "forge"] as const;

export const metadata = { title: "Arte — Sítio Dae Han" };

/** Style guide: every sprite in one place (useful when two people draw). */
export default function ArtPage() {
  return (
    <main className="shell">
      <div className="hero">
        <Sprite sprite={LOGO} scale={6} />
        <h1>Guia de arte</h1>
        <p>Todas as sprites do jogo.</p>
      </div>

      <section className="panel">
        <h2>Moradores</h2>
        <div className="row wrap" style={{ gap: 14 }}>
          {AVATAR_KEYS.map((k) => (
            <figure key={k} style={{ margin: 0, textAlign: "center" }}>
              <Sprite sprite={AVATAR_SPRITES[k]} scale={4} title={AVATARS[k].name} />
              <figcaption className="small">{AVATARS[k].name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Corpo inteiro — andando</h2>
        <p className="small muted">Girando pelas 4 direções. Com “reduzir movimento” ligado, ficam parados.</p>
        <div className="row wrap" style={{ gap: 10 }}>
          {AVATAR_KEYS.map((k) => (
            <figure key={k} style={{ margin: 0, textAlign: "center", width: 64 }}>
              <Walker avatar={k} direction="spin" scale={3} title={AVATARS[k].name} />
              <figcaption className="small">{AVATARS[k].name.split(" ")[0]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Corpo inteiro — quadros</h2>
        <p className="small muted">Frente, costas, direita e esquerda: parado, passo A, passo B.</p>
        <div className="stack">
          {AVATAR_KEYS.map((k) => (
            <div key={k} className="row wrap" style={{ gap: 4, alignItems: "flex-end" }}>
              <span className="small" style={{ width: 70 }}>{AVATARS[k].name.split(" ")[0]}</span>
              {(["down", "up", "right", "left"] as const).flatMap((d) =>
                WALKERS[k][d].map((f, i) => <Sprite key={`${d}${i}`} sprite={f} scale={2} />),
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel map-frame">
        <FarmScene
          completed={["well"]}
          building="barn"
          residents={AVATAR_KEYS.map((k, i) => ({ id: k, name: AVATARS[k].name, avatar: k, spot: SPOTS[i % SPOTS.length] }))}
          showGraph={process.env.NODE_ENV !== "production"}
          fire={1}
        />
      </section>
      <section className="panel">
        <h2>Sítio vivo — de noite</h2>
        <p className="small muted">Às 21h: o mapa escurece, a fogueira ilumina e quem fez a ronda fica em volta dela. Fogueira fraca (30%).</p>
      </section>
      <section className="panel map-frame">
        <FarmScene
          completed={["well", "barn", "mill"]}
          residents={AVATAR_KEYS.map((k, i) => ({ id: k, name: AVATARS[k].name, avatar: k, spot: i % 2 ? "camp" : SPOTS[i % SPOTS.length] }))}
          hour={21}
          fire={0.3}
        />
      </section>
      <section className="panel map-frame"><FarmMap completed={[]} building="well" /></section>
      <section className="panel map-frame"><FarmMap completed={["well", "barn", "mill"]} /></section>

      <section className="panel">
        <h2>Recursos</h2>
        <div className="row wrap" style={{ gap: 14 }}>
          {RESOURCE_KEYS.map((k) => (
            <figure key={k} style={{ margin: 0, textAlign: "center" }}>
              <Sprite sprite={RESOURCE_SPRITES[k]} scale={4} />
              <figcaption className="small">{RESOURCES[k].name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Construções e cenário</h2>
        <div className="row wrap" style={{ gap: 14, alignItems: "flex-end" }}>
          <Sprite sprite={templeSprite()} scale={4} title="Templo" />
          {[POOL, HOUSE, WELL, BARN, MILL, CONSTRUCTION, TREE, TREE_DARK, PALM].map((s, i) => (
            <Sprite key={i} sprite={s} scale={4} />
          ))}
        </div>
      </section>
    </main>
  );
}
