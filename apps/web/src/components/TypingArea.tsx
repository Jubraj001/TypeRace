import { memo, useEffect, useLayoutEffect, useRef } from "react";
import { charStatuses } from "../engine/stats";

interface Props {
  target: string;
  typed: string;
  cursor: number;
  /** when true the test is running (caret stops blinking) */
  active: boolean;
  /** dim everything until focused */
  focused: boolean;
}

/**
 * Renders the target text with per-char correctness coloring and a smoothly
 * gliding neon caret positioned over the active character.
 *
 * Smoothness notes:
 *  - The caret transform is written DIRECTLY to the element via a ref (no React
 *    state / re-render per move), so the CSS transition animates uninterrupted.
 *  - The whole component is memoized; the rAF-driven WPM counter in the parent
 *    re-renders every frame but must NOT re-render the ~180 char spans here.
 */
interface Pos {
  x: number;
  y: number;
  h: number;
}

function TypingArea({ target, typed, cursor, active, focused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Caret animation state — interpolated every frame toward `goal`.
  const goalRef = useRef<Pos>({ x: 0, y: 0, h: 0 });
  const curRef = useRef<Pos>({ x: 0, y: 0, h: 0 });
  const rafRef = useRef<number | null>(null);
  const placedRef = useRef(false);

  const statuses = charStatuses(target, typed);

  // Measure where the caret should be for the current cursor.
  const measureGoal = (): Pos | null => {
    const container = containerRef.current;
    if (!container) return null;
    const atEnd = cursor >= target.length;
    const el = charRefs.current[cursor] ?? charRefs.current[target.length - 1];
    if (!el) return null;
    const cRect = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: (atEnd ? r.right : r.left) - cRect.left,
      y: r.top - cRect.top + r.height * 0.11,
      h: r.height * 0.78,
    };
  };

  const writeCaret = (p: Pos) => {
    const caret = caretRef.current;
    if (!caret) return;
    caret.style.height = `${p.h}px`;
    caret.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  };

  // rAF lerp: glides current → goal with a fixed easing factor each frame.
  // This is frame-rate-paced and independent of React renders, so fast typing
  // never makes the caret jump or stutter.
  const animate = () => {
    const cur = curRef.current;
    const goal = goalRef.current;
    const dx = goal.x - cur.x;
    const dy = goal.y - cur.y;
    const dh = goal.h - cur.h;
    const dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dh);

    if (dist < 0.4) {
      curRef.current = { ...goal };
      writeCaret(goal);
      rafRef.current = null; // settle: stop the loop until the next move
      return;
    }
    const k = 0.32; // smoothing — higher = snappier, lower = glidier
    cur.x += dx * k;
    cur.y += dy * k;
    cur.h += dh * k;
    writeCaret(cur);
    rafRef.current = requestAnimationFrame(animate);
  };

  const kick = () => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(animate);
  };

  // On cursor/target change: recompute goal, then either snap (first placement)
  // or kick off the lerp toward it.
  useLayoutEffect(() => {
    const goal = measureGoal();
    if (!goal) return;
    goalRef.current = goal;
    if (!placedRef.current) {
      curRef.current = { ...goal };
      writeCaret(goal);
      placedRef.current = true;
    } else {
      kick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, target]);

  // On resize the line layout changes — snap the caret to avoid a wild glide.
  useEffect(() => {
    const onResize = () => {
      const goal = measureGoal();
      if (!goal) return;
      goalRef.current = goal;
      curRef.current = { ...goal };
      writeCaret(goal);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, target]);

  return (
    <div
      ref={containerRef}
      className="relative text-2xl md:text-3xl leading-[2.1] tracking-wide select-none transition-[filter,opacity] duration-200"
      style={{
        filter: focused ? "none" : "blur(4px)",
        opacity: focused ? 1 : 0.55,
      }}
    >
      <span
        ref={caretRef}
        aria-hidden
        className={`race-caret absolute left-0 top-0 w-[3px] ${active ? "" : "caret-blink"}`}
        style={{ height: "1.4em" }}
      />
      <Words
        target={target}
        statuses={statuses}
        registerRef={(i, el) => (charRefs.current[i] = el)}
      />
    </div>
  );
}

function Words({
  target,
  statuses,
  registerRef,
}: {
  target: string;
  statuses: ReturnType<typeof charStatuses>;
  registerRef: (i: number, el: HTMLSpanElement | null) => void;
}) {
  const words: { text: string; start: number }[] = [];
  let start = 0;
  for (const w of target.split(" ")) {
    words.push({ text: w, start });
    start += w.length + 1;
  }
  const lastWord = words.length - 1;

  return (
    <>
      {words.map((w, wi) => {
        const spaceIdx = w.start + w.text.length;
        return (
          <span key={wi} className="inline-block whitespace-nowrap">
            {w.text.split("").map((ch, ci) => {
              const idx = w.start + ci;
              return (
                <span
                  key={ci}
                  ref={(el) => registerRef(idx, el)}
                  className={charClass(statuses[idx])}
                >
                  {ch}
                </span>
              );
            })}
            {wi < lastWord && (
              <span
                ref={(el) => registerRef(spaceIdx, el)}
                // whitespace-pre stops the trailing space being trimmed at the
                // edge of the inline-block (which would collapse word gaps)
                className={`whitespace-pre ${charClass(statuses[spaceIdx])}`}
              >
                {" "}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

function charClass(s: ReturnType<typeof charStatuses>[number]): string {
  // No per-char glow on correct text — text-shadow on ~180 chars repainted each
  // keystroke is a real cost and made the caret stutter. Keep it crisp instead.
  if (s === "correct") return "text-text";
  if (s === "incorrect") return "text-error underline decoration-error/70";
  return "text-sub";
}

export default memo(TypingArea);
