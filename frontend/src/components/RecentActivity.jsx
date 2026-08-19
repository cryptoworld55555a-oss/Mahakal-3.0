import React from "react";
import { ExternalLink } from "lucide-react";
import SectionLabel from "@/components/SectionLabel";
import { config } from "@/config";

const short = (h) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "—");

export default function RecentActivity({ me }) {
  const rows = me?.recent_activity || [];
  return (
    <div data-testid="recent-activity">
      <SectionLabel center>Recent Activity</SectionLabel>
      <div className="card-glow overflow-hidden p-0">
        <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
          <span>Label</span>
          <span>Amount</span>
          <span>Hash</span>
        </div>
        {rows.length === 0 && (
          <div className="px-4 py-4 text-center text-xs text-white/40">No activity yet</div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1.3fr_1fr_1fr] items-center gap-2 border-t border-white/5 px-4 py-3 text-xs">
            <div>
              <div className="font-semibold text-white">{r.label}</div>
              <div className="text-[10px] text-white/40">{r.date}</div>
            </div>
            <div className="text-white/70">{r.amount}</div>
            <a
              data-testid={`activity-hash-${i}`}
              href={`${config.explorer}/tx/${r.hash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-mono text-[#34D07A] transition-colors active:scale-95 hover:text-[#D6C51E]"
            >
              {short(r.hash)}
              <ExternalLink size={12} className="shrink-0 text-[#D6C51E]" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
