import { RESOURCES, RESOURCE_KEYS } from "@/game/config";
import { FarmMap } from "@/art/FarmMap";
import { Sprite } from "@/art/pixel";
import { AVATARS, AVATAR_KEYS, AVATAR_SPRITES } from "@/art/avatars";
import {
  BARN, CONSTRUCTION, HOUSE, LOGO, MILL, PALM, POOL, RESOURCE_SPRITES, TREE, TREE_DARK, WELL, templeSprite,
} from "@/art/sprites";

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
