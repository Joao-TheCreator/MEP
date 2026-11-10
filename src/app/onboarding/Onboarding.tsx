"use client";
import { useActionState, useState } from "react";
import { PROFESSIONS, PROFESSION_KEYS } from "@/game/config";
import { ResIcon } from "@/components/Res";
import { Avatar } from "@/components/Avatar";
import { AVATARS, AVATAR_KEYS, type AvatarKey } from "@/art/avatars";
import { startPlaying, type ActionResult } from "../actions";

export function Onboarding({ initialCode }: { initialCode: string }) {
  const [mode, setMode] = useState<"create" | "join">("join");
  const [avatar, setAvatar] = useState<AvatarKey | "">("");
  const [name, setName] = useState("");
  // Controlled fields: React resets uncontrolled forms after an action, which
  // would wipe the invite code when the server returns an error.
  const [code, setCode] = useState(initialCode);
  const [farmName, setFarmName] = useState("Sítio Dae Han");
  const [profession, setProfession] = useState<string>(PROFESSION_KEYS[0]);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(startPlaying, null);
  return (
    <form action={action} className="panel stack">
      <div className="seg">
        <button type="button" className="btn small" aria-pressed={mode === "join"} onClick={() => setMode("join")}>Entrar num sítio</button>
        <button type="button" className="btn small" aria-pressed={mode === "create"} onClick={() => setMode("create")}>Criar sítio</button>
      </div>
      <input type="hidden" name="mode" value={mode} />
      {mode === "join" ? (
        <div>
          <label htmlFor="code">Código de convite</label>
          <input id="code" name="code" value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="Ex.: K7M2QX" autoCapitalize="characters" />
        </div>
      ) : (
        <div>
          <label htmlFor="farmName">Nome do sítio</label>
          <input id="farmName" name="farmName" value={farmName} onChange={(e) => setFarmName(e.target.value)} maxLength={40} />
        </div>
      )}
      <div>
        <label>Quem é você?</label>
        <div className="avatar-pick">
          {AVATAR_KEYS.map((k) => (
            <label key={k} title={AVATARS[k].name}>
              <input type="radio" name="avatar" value={k} required checked={avatar === k}
                onChange={() => { setAvatar(k); setName(AVATARS[k].name.replace(/\s*\(.*\)$/, "")); }} />
              <span className="avatar-card"><Avatar avatar={k} scale={2} /><span className="small">{AVATARS[k].name}</span></span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="displayName">Seu nome no jogo</label>
        <input id="displayName" name="displayName" required minLength={2} maxLength={24}
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label>Profissão</label>
        <div className="prof-pick">
          {PROFESSION_KEYS.map((k) => (
            <label key={k}>
              <input type="radio" name="profession" value={k} checked={profession === k} onChange={() => setProfession(k)} />
              <div className="prof-card">
                <div className="row"><ResIcon r={PROFESSIONS[k].produces} /><h3>{PROFESSIONS[k].name}</h3></div>
                <p className="small muted">{PROFESSIONS[k].description}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>A profissão não pode ser trocada depois.</p>
      </div>
      <button className="btn big" disabled={pending}>{pending ? "Entrando..." : "Começar"}</button>
      {state && !state.ok && <p style={{ color: "var(--flame)" }}>{state.message}</p>}
    </form>
  );
}
