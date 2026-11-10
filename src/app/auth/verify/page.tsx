import Link from "next/link";
import { verifyLogin } from "../../actions";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <main className="shell">
      <div className="hero"><h1>Sítio Dae Han</h1></div>
      <div className="panel stack">
        {error || !token ? (
          <>
            <h2>Link inválido</h2>
            <p>Esse link expirou ou já foi usado. Peça um novo.</p>
            <Link className="btn" href="/login">Voltar</Link>
          </>
        ) : (
          <form action={verifyLogin} className="stack">
            <h2>Quase lá!</h2>
            <p>Toque no botão para entrar no sítio.</p>
            <input type="hidden" name="token" value={token} />
            <button className="btn big">Entrar</button>
          </form>
        )}
      </div>
    </main>
  );
}
