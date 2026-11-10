import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { Sprite } from "@/art/pixel";
import { LOGO } from "@/art/sprites";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <main className="shell">
      <div className="hero">
        <Sprite sprite={LOGO} scale={6} title="Logo" />
        <h1>Sítio Dae Han</h1>
        <p>Cuide do sítio junto com os amigos.</p>
      </div>
      <LoginForm />
    </main>
  );
}
