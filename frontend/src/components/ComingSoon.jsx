import React from "react";
import { Construction } from "lucide-react";

export default function ComingSoon({ title, module }) {
  return (
    <div
      data-testid="coming-soon"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pt-24 text-center"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#9D4EDD]/30 bg-[#9D4EDD]/10">
        <Construction size={28} className="text-[#9D4EDD]" />
      </span>
      <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Unbounded, Inter, sans-serif" }}>
        {title}
      </h2>
      <p className="max-w-[260px] text-sm text-white/50">
        {module} — landing soon. Activation is live now on the Dashboard; the rest of the protocol rolls out next.
      </p>
    </div>
  );
}
