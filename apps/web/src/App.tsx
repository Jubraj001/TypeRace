import { Link, Outlet, useLocation } from "react-router-dom";
import { getTheme, setTheme } from "./lib/storage";
import { useState } from "react";

const THEMES = ["neon-tokyo", "synthwave", "akira", "matrix"];

export default function App() {
  const loc = useLocation();
  const [theme, setThemeState] = useState(getTheme());

  const cycleTheme = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    setThemeState(next);
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl w-full mx-auto">
        <Link
          to="/"
          onClick={() => {
            // Monkeytype-style: clicking the logo always starts a fresh test.
            // The Link handles navigation when elsewhere; this event tells the
            // solo page to restart when we're already on it.
            window.dispatchEvent(new Event("typingninja:restart"));
          }}
          className="flex items-baseline gap-2 group"
        >
          <span className="font-display text-2xl font-black flicker">
            <span className="neon-text">typing</span>
            <span className="text-accent glow-accent">Ninja</span>
          </span>
          <span className="text-accent text-xs glow-accent tracking-widest">
            タイピング忍者
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-display uppercase tracking-wider">
          <Link
            to="/"
            className={
              loc.pathname === "/"
                ? "text-main neon-text"
                : "text-sub hover:text-accent transition-colors"
            }
          >
            solo
          </Link>
          <Link
            to="/race"
            className={
              loc.pathname.startsWith("/race")
                ? "text-main neon-text"
                : "text-sub hover:text-accent transition-colors"
            }
          >
            versus
          </Link>
          <button
            onClick={cycleTheme}
            className="text-accent/80 hover:text-accent glow-accent transition-colors"
            title="Switch theme"
          >
            ◑ {theme}
          </button>
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
