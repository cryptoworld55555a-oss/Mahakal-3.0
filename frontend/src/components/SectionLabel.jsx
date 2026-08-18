import React from "react";

export default function SectionLabel({ children, center = false }) {
  if (center) {
    return (
      <div className="mb-3 mt-2 flex w-full items-center gap-2 px-1">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D6C51E] shadow-[0_0_6px_rgba(214,197,30,0.8)]" />
        <span className="h-px flex-1 bg-gradient-to-l from-[#D6C51E]/50 via-[#0AA84F]/40 to-transparent" />
        <span className="grad-label whitespace-nowrap px-1">{children}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-[#D6C51E]/50 via-[#0AA84F]/40 to-transparent" />
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D6C51E] shadow-[0_0_6px_rgba(214,197,30,0.8)]" />
      </div>
    );
  }
  return (
    <div className="mb-3 mt-2 flex items-center gap-3 px-1">
      <span className="grad-label whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-[#D6C51E]/50 via-[#0AA84F]/40 to-transparent" />
    </div>
  );
}
