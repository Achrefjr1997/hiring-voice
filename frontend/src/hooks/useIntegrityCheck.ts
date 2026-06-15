import { useEffect, useRef, useState } from "react";
import type { IntegrityViolation } from "../types";

const VIOLATION_WEIGHTS: Record<string, number> = {
  TAB_SWITCH: 1,
  WINDOW_BLUR: 1,
  COPY_ATTEMPT: 2,
  CUT_ATTEMPT: 2,
  PASTE_ATTEMPT: 5,
  CONTEXT_MENU: 1,
  DEVTOOLS_SHORTCUT: 3,
  EXIT_FULLSCREEN: 2,
};

export function useIntegrityCheck(
  sessionId: string | null,
  enabled: boolean,
) {
  const [count, setCount] = useState(0);
  const violationsRef = useRef<IntegrityViolation[]>([]);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const record = (type: IntegrityViolation["type"], severity: IntegrityViolation["severity"]) => {
      const v: IntegrityViolation = {
        type,
        timestamp: Date.now(),
        severity,
        points: VIOLATION_WEIGHTS[type] ?? 1,
      };
      violationsRef.current = [...violationsRef.current, v];
      setCount((c) => c + 1);
      fetch(`/session/${sessionId}/integrity-violation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      }).catch(() => {});
    };

    const onVisibility = () => { if (document.hidden) record("TAB_SWITCH", "warning"); };
    const onBlur = () => record("WINDOW_BLUR", "warning");
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); record("COPY_ATTEMPT", "severe"); };
    const onCut = (e: ClipboardEvent) => { e.preventDefault(); record("CUT_ATTEMPT", "severe"); };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); record("PASTE_ATTEMPT", "severe"); };
    const onContextMenu = (e: MouseEvent) => { e.preventDefault(); record("CONTEXT_MENU", "warning"); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C"))) {
        e.preventDefault();
        record("DEVTOOLS_SHORTCUT", "severe");
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        record("EXIT_FULLSCREEN", "warning");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [sessionId, enabled]);

  return count;
}
