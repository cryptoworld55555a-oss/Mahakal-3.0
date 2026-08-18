import React, { useEffect, useState } from "react";

function diff(target) {
  if (!target) return null;
  const ms = new Date(target).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const pad = (n) => String(n).padStart(2, "0");

export default function Countdown({ target, testid, onExpire }) {
  const [t, setT] = useState(() => diff(target));

  useEffect(() => {
    if (!target) return;
    setT(diff(target));
    const id = setInterval(() => {
      const next = diff(target);
      setT(next);
      if (!next && onExpire) onExpire();
    }, 1000);
    return () => clearInterval(id);
  }, [target, onExpire]);

  if (!target || !t) {
    return (
      <span data-testid={testid} className="font-mono text-[11px] text-white/40">
        --:--:--
      </span>
    );
  }

  return (
    <span data-testid={testid} className="font-mono text-[11px] tabular-nums text-white/60">
      {t.d > 0 ? `${t.d}d ` : ""}
      {pad(t.h)}:{pad(t.m)}:{pad(t.s)}
    </span>
  );
}
