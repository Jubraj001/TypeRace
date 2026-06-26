import { useEffect, useRef, useState } from "react";
import TypingArea from "./TypingArea";
import type { KeyLike } from "../engine/useTyping";

interface Props {
  target: string;
  typed: string;
  cursor: number;
  /** caret blink stops while running */
  active: boolean;
  /** engine handleKey — fed synthetic key events from real input */
  onKey: (e: KeyLike) => void;
  /** Tab / Escape (solo restart / new test) */
  onControl?: (key: "Tab" | "Escape") => void;
  /** hint shown over the (blurred) text when unfocused */
  idleHint?: string;
}

/**
 * Wraps the visual TypingArea with a hidden, focusable <input> so the app works
 * with both physical and on-screen (mobile) keyboards.
 *
 * Why an input + beforeinput instead of window keydown:
 *  - Mobile keyboards (esp. Android/Gboard) don't emit reliable `keydown` for
 *    letters — they fire `beforeinput`. So characters are read from `beforeinput`.
 *  - The input's native value mirrors `typed` (with the caret kept at the end),
 *    so Backspace / word-delete / line-delete fire `beforeinput` delete events
 *    on mobile (they wouldn't on an empty field).
 *  - Focusing the input from a tap (user gesture) is what opens the keyboard.
 */
export default function TypingField({
  target,
  typed,
  cursor,
  active,
  onKey,
  onControl,
  idleHint = "tap to type",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;

  const fk = (
    key: string,
    mods: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {}
  ): KeyLike => ({
    key,
    ctrlKey: !!mods.ctrl,
    metaKey: !!mods.meta,
    altKey: !!mods.alt,
    preventDefault() {},
  });

  // Read characters & deletions from beforeinput (works across mobile keyboards).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const ie = e as InputEvent;
      const t = ie.inputType || "";
      if (t.startsWith("insert")) {
        if (ie.data) for (const ch of ie.data) onKeyRef.current(fk(ch));
        ie.preventDefault();
      } else if (t === "deleteWordBackward") {
        onKeyRef.current(fk("Backspace", { alt: true }));
        ie.preventDefault();
      } else if (t === "deleteSoftLineBackward" || t === "deleteHardLineBackward") {
        onKeyRef.current(fk("Backspace", { meta: true }));
        ie.preventDefault();
      } else if (t.startsWith("delete")) {
        onKeyRef.current(fk("Backspace"));
        ie.preventDefault();
      }
    };
    el.addEventListener("beforeinput", handler);
    return () => el.removeEventListener("beforeinput", handler);
  }, []);

  // Keep the native value mirroring `typed`, caret at the end — so the next
  // delete has something to delete and targets the right spot.
  useEffect(() => {
    const el = inputRef.current;
    if (el && el.value !== typed) {
      el.value = typed;
      try {
        el.setSelectionRange(typed.length, typed.length);
      } catch {
        /* some input types disallow selection — ignore */
      }
    }
  }, [typed]);

  // Focus on mount and whenever a new test starts (target changes). On mobile the
  // OS may ignore programmatic focus until a tap — that's fine, the hint shows.
  useEffect(() => {
    inputRef.current?.focus();
  }, [target]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      onControl?.("Tab");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onControl?.("Escape");
    }
    // characters & backspace come through beforeinput
  };

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        defaultValue=""
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="typing input"
        // cover the text so a tap anywhere focuses it; 16px font avoids iOS zoom
        className="absolute inset-0 z-10 w-full h-full opacity-0"
        style={{ fontSize: 16, caretColor: "transparent" }}
      />
      <TypingArea target={target} typed={typed} cursor={cursor} active={active} focused={focused} />
      {!focused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sub text-sm font-display uppercase tracking-wider">
            {idleHint}
          </span>
        </div>
      )}
    </div>
  );
}
