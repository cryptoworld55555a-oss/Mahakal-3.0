import React from "react";
import { CalendarDays, Trophy, Gift } from "lucide-react";
import Countdown from "@/components/Countdown";
import SectionLabel from "@/components/SectionLabel";

const usd = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
const usd2 = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n || 0);

function PoolCard({ testid, icon: Icon, title, amount, qualified, sharing, reset, resetTestid, eligible, full }) {
  return (
    <div data-testid={testid} className={`card-glow p-4 ${full ? "col-span-2" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="grad-label">{title}</span>
        <Icon size={18} className="text-[#34D07A]" />
      </div>
      <div className="truncate text-xl font-extrabold text-white" style={{ fontFamily: "Unbounded, Inter, sans-serif" }}>
        ${usd(amount)}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-white/50">Qualified IDs</span>
          <b className="text-white/80">{qualified ?? 0}</b>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/50">Sharing</span>
          <b className="text-[#34D07A]">${usd2(sharing)}</b>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-[10px] text-white/40">
          <span className="shrink-0">resets</span>
          <Countdown target={reset} testid={resetTestid} />
        </span>
        <span
          data-testid={`${testid}-eligibility`}
          className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${
            eligible
              ? "bg-[#0AA84F]/15 text-[#22C55E] border border-[#0AA84F]/50"
              : "bg-red-500/15 text-red-400 border border-red-500/45"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${eligible ? "bg-[#22C55E]" : "bg-red-400"}`} />
          {eligible ? "Eligible" : "Not Eligible"}
        </span>
      </div>
    </div>
  );
}

export default function GlobalBusiness({ stats, me }) {
  const eligible = Boolean(me?.is_active);
  const meta = stats?.pool_meta || {};
  return (
    <div>
      <SectionLabel>Global Business</SectionLabel>
      <div className="flex flex-col gap-3">
        <PoolCard
          testid="gb-daily-pool" icon={CalendarDays} title="Daily Pool" full
          amount={stats?.pools?.daily_usdt} qualified={meta.daily?.qualified_ids} sharing={meta.daily?.sharing_usdt}
          reset={stats?.resets?.daily} resetTestid="gb-daily-countdown" eligible={eligible}
        />
        <PoolCard
          testid="gb-weekly-pool" icon={Trophy} title="Weekly Pool" full
          amount={stats?.pools?.weekly_usdt} qualified={meta.weekly?.qualified_ids} sharing={meta.weekly?.sharing_usdt}
          reset={stats?.resets?.weekly} resetTestid="gb-weekly-countdown" eligible={eligible}
        />
        <PoolCard
          testid="gb-monthly-pool" icon={Gift} title="Monthly Pool" full
          amount={stats?.pools?.monthly_usdt} qualified={meta.monthly?.qualified_ids} sharing={meta.monthly?.sharing_usdt}
          reset={stats?.resets?.monthly} resetTestid="gb-monthly-countdown" eligible={eligible}
        />
      </div>
    </div>
  );
}
