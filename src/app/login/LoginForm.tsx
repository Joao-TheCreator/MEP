"use client";
import { useActionState, useState } from "react";
import { login, signup, type ActionResult } from "../actions";

/** Enter with name + password, or create them the first time. */
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
        <label htmlFor="username">Seu nome</label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
      </div>
      <div>
        <label htmlFor="password">Sua senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
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
        Escolha um nome (de 3 a 20 letras, números, ponto, traço ou _) e uma senha de pelo menos
        6 caracteres. Não use a mesma senha de outro lugar e não conte para ninguém.
      </p>
      <div>
        <label htmlFor="new-username">Nome</label>
        <input id="new-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={20} autoFocus />
      </div>
      <div>
        <label htmlFor="new-password">Nova senha</label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={6} />
      </div>
      <div>
        <label htmlFor="confirm">Repita a senha</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={6} />
      </div>
      <button className="btn big" disabled={pending}>{pending ? "Criando..." : "Criar e entrar"}</button>
      <Message state={state} />
      <button type="button" className="btn secondary" onClick={onBack}>Já tenho acesso</button>
    </form>
  );
}
