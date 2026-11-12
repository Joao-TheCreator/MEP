"use client";
import { useActionState, useState } from "react";
import { login, signup, type ActionResult } from "../actions";

/** Enter with your personal password, or create one the first time. */
export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  return mode === "login" ? <Login onNew={() => setMode("signup")} /> : <Signup onBack={() => setMode("login")} />;
}

function Message({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return <p role="status" style={{ color: state.ok ? "var(--leaf-dark)" : "var(--flame)" }}>{state.message}</p>;
}

function Login({ onNew }: { onNew: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(login, null);
  return (
    <form action={action} className="panel stack">
      <h2>Entrar</h2>
      <div>
        <label htmlFor="password">Sua senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
      </div>
      <button className="btn big" disabled={pending}>{pending ? "Entrando..." : "Entrar"}</button>
      <Message state={state} />
      <button type="button" className="btn secondary" onClick={onNew}>Primeira vez? Criar meu acesso</button>
    </form>
  );
}

function Signup({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(signup, null);
  return (
    <form action={action} className="panel stack">
      <h2>Criar meu acesso</h2>
      <p className="small muted">
        Escolha uma senha só sua, de pelo menos 6 caracteres. É só ela que você vai digitar para entrar,
        então não use a mesma de outro lugar e não conte para ninguém.
      </p>
      <div>
        <label htmlFor="new-password">Nova senha</label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={6} autoFocus />
      </div>
      <div>
        <label htmlFor="confirm">Repita a senha</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={6} />
      </div>
      <button className="btn big" disabled={pending}>{pending ? "Criando..." : "Criar e entrar"}</button>
      <Message state={state} />
      <button type="button" className="btn secondary" onClick={onBack}>Já tenho senha</button>
    </form>
  );
}
