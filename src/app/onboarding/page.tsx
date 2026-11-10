import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { getPlayer } from "@/server/game";
import { Onboarding } from "./Onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (await getPlayer(user.id)) redirect("/");
  const { code } = await searchParams;
  return (
    <main className="shell">
      <div className="hero"><h1>Bem-vindo!</h1><p>Escolha como você vai ajudar o sítio.</p></div>
      <Onboarding initialCode={code ?? ""} />
    </main>
  );
}
