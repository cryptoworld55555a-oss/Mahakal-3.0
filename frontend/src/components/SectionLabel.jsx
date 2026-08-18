import React from "react";

export default function SectionLabel({ children }) {
  return (
    <div className="mb-3 mt-2 flex items-center gap-3 px-1">
      <span className="section-label whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-[#0AA84F]/40 to-transparent" />
    </div>
  );
}
