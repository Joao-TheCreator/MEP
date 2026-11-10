import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { loadGameState } from "@/server/game";
import { Game } from "@/components/Game";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const state = await loadGameState(user.id);
  if (!state) redirect("/onboarding");
  return <Game state={state} />;
}
