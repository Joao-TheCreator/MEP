import type { ActionResult } from "@/app/actions";
import type { GameState } from "@/server/game";

/** What every game screen receives from the Game shell. */
export interface ScreenProps {
  state: GameState;
  /** Client clock aligned to the server, ticking every second. */
  now: Date;
  /** Runs a server action and shows its result as a toast. */
  act: (fn: () => Promise<ActionResult>) => void;
  pending: boolean;
  /** Opens the Night tab (the campfire on the map uses it). */
  openNight: () => void;
}
