"use client";
import { useActionState } from "react";
import { requestLogin, type ActionResult } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(requestLogin, null);
  return (
    <form action={action} className="panel stack">
      <h2>Entrar</h2>
      <p className="muted">Sem senha: enviamos um link mágico para o seu e-mail.</p>
      <div>
        <label htmlFor="email">Seu e-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" />
      </div>
      <button className="btn big" disabled={pending}>{pending ? "Enviando..." : "Receber link"}</button>
      {state && <p style={{ color: state.ok ? "var(--leaf-dark)" : "var(--flame)" }}>{state.message}</p>}
      {state?.devLink && (
        <p className="small">
          Modo dev (sem e-mail configurado): <a href={state.devLink}>abrir link</a>
        </p>
      )}
    </form>
  );
}
