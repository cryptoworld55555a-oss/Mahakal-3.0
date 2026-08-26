import React, { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import SectionLabel from "@/components/SectionLabel";
import { getHolders } from "@/lib/api";
import { config } from "@/config";

const shortAddr = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "");

export default function TopHolders() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    getHolders({ search, page, page_size: 10 }).then(setData).catch(() => {});
  }, [search, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div data-testid="top-holders">
      <SectionLabel center>Top TTN Holders</SectionLabel>
      <div className="card-glow p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-white/50">Ranked by staked TTN</span>
          <span data-testid="holders-count" className="rounded-full bg-[#0AA84F]/15 px-2.5 py-1 text-[10px] font-semibold text-[#34D07A]">
            {data?.total ?? 0} holders
          </span>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
          <Search size={15} className="text-white/40" />
          <input
            data-testid="holders-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search holder address"
            className="w-full bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-white/30"
          />
        </div>

        <div className="grid grid-cols-[0.5fr_1.4fr_1fr] gap-2 px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
          <span>Rank</span>
          <span>Address</span>
          <span className="text-right">TTN</span>
        </div>
        {(data?.holders || []).map((h) => (
          <div key={h.rank} data-testid={`holder-row-${h.rank}`} className="grid grid-cols-[0.5fr_1.4fr_1fr] items-center gap-2 border-t border-white/5 px-1 py-2.5 text-xs">
            <span className="font-semibold text-[#34D07A]">#{h.rank}</span>
            <a
              data-testid={`holder-link-${h.rank}`}
              href={`${config.explorer}/token/${config.tokenAddress}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1.5 font-mono text-[#34D07A] active:opacity-80"
            >
              <span className="truncate">{shortAddr(h.address)}</span>
              <ExternalLink size={12} className="shrink-0 text-[#34D07A]" />
            </a>
            <span className="text-right font-semibold text-white">
              {h.ttn} <span className="text-[#D6C51E]">TTN</span>
            </span>
          </div>
        ))}
        {data && data.holders.length === 0 && (
          <div className="py-4 text-center text-xs text-white/40">No holders found</div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs">
          <button
            data-testid="holders-prev"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!data || data.page <= 1}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-white/60 disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-white/50">Page {data?.page || 1} of {data?.pages || 1}</span>
          <button
            data-testid="holders-next"
            onClick={() => setPage((p) => (data && p < data.pages ? p + 1 : p))}
            disabled={!data || data.page >= data.pages}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-white/60 disabled:opacity-30"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
