import { RESOURCES, type Bag, type ResourceKey } from "@/game/config";
import { Sprite } from "@/art/pixel";
import { RESOURCE_SPRITES } from "@/art/sprites";

export function ResIcon({ r, scale = 2 }: { r: ResourceKey; scale?: number }) {
  return <Sprite sprite={RESOURCE_SPRITES[r]} scale={scale} title={RESOURCES[r].name} />;
}

/** "12 🪵" style resource amount, with the pixel icon. */
export function Res({ r, qty, name = false }: { r: ResourceKey; qty?: number; name?: boolean }) {
  return (
    <span className="res">
      <ResIcon r={r} />
      {qty !== undefined && <span>{qty.toLocaleString("pt-BR")}</span>}
      {name && <span>{RESOURCES[r].name}</span>}
    </span>
  );
}

export function ResList({ bag, have }: { bag: Bag; have?: Bag }) {
  return (
    <span className="row wrap" style={{ gap: 12 }}>
      {(Object.entries(bag) as [ResourceKey, number][]).map(([k, v]) => (
        <span key={k} style={have && (have[k] ?? 0) < v ? { color: "var(--flame)" } : undefined}>
          <Res r={k} qty={v} />
        </span>
      ))}
    </span>
  );
}
