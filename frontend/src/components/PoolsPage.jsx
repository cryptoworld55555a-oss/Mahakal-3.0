import React, { useEffect, useState } from "react";
import { Clock, History, XCircle, CheckCircle2 } from "lucide-react";
import { getDashboardStats } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import SectionLabel from "@/components/SectionLabel";

const usd = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
const usd2 = (n) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function ReqRow({ label, have, need, suffix = "" }) {
  const ok = have >= need;
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-white/60">{label}</span>
      <span className={`flex items-center gap-1.5 font-semibold ${ok ? "text-[#34D07A]" : "text-red-400"}`}>
        {suffix}{have}/{need}{suffix ? "" : ""}
        {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      </span>
    </div>
  );
}

function PoolCard({ p }) {
  const est = p.achievers >= 0 ? p.balance / (p.achievers + 1) : 0;
  const qualified = p.directsHave >= p.directsNeed && p.capHave >= p.capNeed;
  return (
    <div data-testid={`pool-${p.key}`} className="card-glow p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold grad-title">{p.title}</div>
          <div className="text-[11px] text-white/45">{p.period}</div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${qualified ? "border-[#0AA84F]/50 bg-[#0AA84F]/15 text-[#34D07A]" : "border-red-500/45 bg-red-500/15 text-red-400"}`}>
          {qualified ? "Qualified" : "Not qualified"}
        </span>
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wide text-white/45">Current Pool Balance</div>
      <div className="text-3xl font-extrabold text-white">${usd(p.balance)}</div>

      <div className="mt-3 rounded-xl border border-[#3C6B33]/50 p-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
          <span className="text-white/60">Estimated if you qualify</span>
          <span className="font-bold text-[#D6C51E]">${usd2(est)}</span>
        </div>
        <div className="flex items-center justify-between pt-2 text-sm">
          <span className="text-white/60">On-chain achievers</span>
          <span className="font-bold text-[#34D07A]">{p.achievers}</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[#3C6B33]/50 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-white">Qualification</span>
          <span className="text-xs font-semibold text-red-400">2 pending</span>
        </div>
        <ReqRow label={p.directsLabel} have={p.directsHave} need={p.directsNeed} />
        <div className="flex items-center justify-between py-1 text-xs">
          <span className="text-white/60">Available mining cap</span>
          <span className="flex items-center gap-1.5 font-semibold text-red-400">
            ${p.capHave}/${p.capNeed} <XCircle size={14} />
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-white/70">
        <Clock size={13} className="text-[#D6C51E]" /> Live estimate; finalized when pool closes
      </div>

      <button
        data-testid={`pool-${p.key}-btn`}
        disabled={!qualified}
        className="mt-3 h-11 w-full rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] text-sm font-bold text-black active:scale-[0.98] disabled:bg-none disabled:bg-[#3C6B33]/30 disabled:text-white/50"
      >
        {qualified ? "Claim Share" : "Not qualified"}
      </button>

      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-[11px] text-[#34D07A]">Does NOT reduce mining cap</span>
        <span className="flex items-center gap-1 rounded-lg border border-[#D6C51E]/40 px-2.5 py-1 text-[11px] font-semibold text-[#D6C51E]">
          <History size={12} /> History
        </span>
      </div>
    </div>
  );
}

export default function PoolsPage() {
  const { me } = useWallet();
  const [stats, setStats] = useState(null);
  useEffect(() => { getDashboardStats().then(setStats).catch(() => {}); }, []);

  const meta = stats?.pool_meta || {};
  const day = Math.floor(Date.now() / 86400000) % 1000;
  const pools = [
    { key: "daily", title: "Daily TITAN Pool", period: `Current on-chain day · ID ${day}`, balance: stats?.pools?.daily_usdt || 0, achievers: meta.daily?.qualified_ids || 0, directsLabel: "Direct with 50+ Stake today", directsHave: 0, directsNeed: 1, capHave: 0, capNeed: 100 },
    { key: "weekly", title: "Weekly Champion Pool", period: "Current on-chain week · ID 1", balance: stats?.pools?.weekly_usdt || 0, achievers: meta.weekly?.qualified_ids || 0, directsLabel: "Directs with 50+ Stake this week", directsHave: 0, directsNeed: 5, capHave: 0, capNeed: 200 },
    { key: "monthly", title: "Monthly Owner Club Reward", period: "Current on-chain month · ID 1", balance: stats?.pools?.monthly_usdt || 0, achievers: meta.monthly?.qualified_ids || 0, directsLabel: "Directs with 50+ Stake this month", directsHave: 0, directsNeed: 10, capHave: 0, capNeed: 500 },
  ];

  return (
    <div data-testid="pools-page" className="flex flex-col gap-4 px-4 pt-4 pb-4">
      <SectionLabel center>Reward Pools</SectionLabel>
      {pools.map((p) => <PoolCard key={p.key} p={p} />)}
    </div>
  );
}
