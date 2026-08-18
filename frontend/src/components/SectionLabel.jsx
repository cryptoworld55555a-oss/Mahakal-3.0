import React from "react";

export default function SectionLabel({ children, center = false }) {
  if (center) {
    return (
      <div className="mb-3 mt-2 flex w-full items-center gap-3 px-1">
        <span className="h-px flex-1 bg-gradient-to-l from-[#D6C51E]/50 via-[#0AA84F]/40 to-transparent" />
        <span className="grad-label whitespace-nowrap">{children}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-[#D6C51E]/50 via-[#0AA84F]/40 to-transparent" />
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
