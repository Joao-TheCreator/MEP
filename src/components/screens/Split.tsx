"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Lying-down layout for a tab (issue #22, roadmap 7b): what matters most stays
 * on the left (<SplitMain>) and the rest sits in tabbed panes on the right
 * (<Pane>). Standing up the wrapper vanishes (CSS display: contents) and every
 * pane shows one under the other, in the order of the markup, as before.
 * Only CSS decides which layout is used, so nothing flickers on load.
 */

const Active = createContext<string>("");

export function Split({
  tabs,
  active,
  onPick,
  className = "",
  children,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onPick: (key: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Active.Provider value={active}>
      <div className={`split ${className}`}>
        {tabs.length > 1 && (
          <div className="seg pane-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" className="btn small" aria-pressed={active === t.key} onClick={() => onPick(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        {children}
      </div>
    </Active.Provider>
  );
}

/** The left column lying down: always visible. */
export function SplitMain({ children }: { children: ReactNode }) {
  return <div className="split-main">{children}</div>;
}

/** One pane of the right column lying down: shown when its tab is picked. */
export function Pane({ name, children }: { name: string; children: ReactNode }) {
  const active = useContext(Active);
  return (
    <div className={`pane ${active === name ? "active" : ""}`} data-pane={name}>
      {children}
    </div>
  );
}
