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
function TypingArea({ target, typed, cursor, active, focused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const placedRef = useRef(false);

  const statuses = charStatuses(target, typed);

  // Position the caret over the current character. The smooth glide comes from a
  // CSS transition on `transform` (see .race-caret) — no rAF, so it's reliable.
  // `animate=false` snaps without transition (first paint + resize jumps).
  const positionCaret = (animate: boolean) => {
    const container = containerRef.current;
    const caret = caretRef.current;
    if (!container || !caret) return;
    const atEnd = cursor >= target.length;
    const el = charRefs.current[cursor] ?? charRefs.current[target.length - 1];
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = (atEnd ? r.right : r.left) - cRect.left;
    const y = r.top - cRect.top + r.height * 0.11;
    const h = r.height * 0.78;

    if (!animate) caret.style.transition = "none";
    caret.style.height = `${h}px`;
    caret.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (!animate) {
      void caret.offsetWidth; // flush, so the next move animates from here
      caret.style.transition = "";
    }
  };

  // Reposition before paint on every cursor/target change.
  useLayoutEffect(() => {
    positionCaret(placedRef.current);
    placedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, target]);

  // On resize the line layout changes — snap (no glide) to the new position.
  useEffect(() => {
    const onResize = () => positionCaret(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
