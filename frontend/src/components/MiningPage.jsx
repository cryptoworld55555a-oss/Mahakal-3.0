import React from "react";
import { Pickaxe, AlertCircle, Database, History } from "lucide-react";
import SectionLabel from "@/components/SectionLabel";
import { useWallet } from "@/context/WalletContext";

const usd4 = (n) => Number(n || 0).toFixed(4);
const usd2 = (n) => Number(n || 0).toFixed(2);

function Gauge({ pct = 0 }) {
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circ = Math.PI * r; // semicircle length
  const dash = (pct / 100) * circ;
  return (
    <div className="relative mx-auto h-[100px] w-[160px]">
      <svg viewBox="0 0 160 90" className="h-full w-full">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(60,107,51,0.35)" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#34D07A" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <div className="text-3xl font-extrabold text-white">{pct.toFixed(1)}%</div>
        <div className="text-xs text-white/45">utilized</div>
      </div>
    </div>
  );
}

function Stat({ label, value, gold }) {
  return (
    <div className="card-glow p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className={`text-lg font-bold ${gold ? "text-[#D6C51E]" : "text-white"}`}>{value}</div>
    </div>
  );
}

export default function MiningPage() {
  const { me } = useWallet();
  const reward = 0;
  const canMine = reward >= 1;

  return (
    <div data-testid="mining-page" className="flex flex-col gap-4 px-4 pt-4 pb-4">
      <SectionLabel center>Mining &amp; Rewards</SectionLabel>

      {/* Claim mining reward */}
      <div data-testid="claim-reward-card" className="card-glow p-5">
        <div className="mb-3 flex items-center gap-2">
          <Pickaxe size={16} className="text-[#34D07A]" />
          <span className="text-base font-bold text-white">Claim Mining Reward</span>
        </div>
        <div className="rounded-xl border border-[#3C6B33]/50 bg-black/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-[#34D07A]">Generated Mining Reward</span>
            <AlertCircle size={16} className="text-[#D6C51E]" />
          </div>
          <div data-testid="generated-reward" className="mt-1 text-3xl font-extrabold text-white">
            ${usd4(reward)} <span className="text-sm text-white/40">USDT</span>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#D6C51E]/30 bg-[#D6C51E]/8 p-3 text-xs text-white/70">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-[#D6C51E]" />
          Minimum mining reward is $1. Currently generated: ${usd4(reward)}.
        </div>
        <button
          data-testid="mine-claim-btn"
          disabled={!canMine}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] font-bold text-black active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#3C6B33]/30 disabled:text-white/50"
        >
          <Pickaxe size={16} /> {canMine ? "Claim Reward" : "Mining Not Available"}
        </button>
      </div>

      {/* Mining cap utilization */}
      <div data-testid="cap-utilization-card" className="card-glow p-5">
        <div className="text-base font-bold text-white">Mining Cap Utilization</div>
        <div className="mb-2 text-xs text-white/50">Standard · Based on $0.00 Stake</div>
        <Gauge pct={0} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#3C6B33]/50 p-3 text-center">
            <div className="text-xs text-white/50">Used Cap</div>
            <div className="text-lg font-bold text-white">$0.00</div>
          </div>
          <div className="rounded-xl border border-[#3C6B33]/50 p-3 text-center">
            <div className="text-xs text-white/50">Remaining Cap</div>
            <div className="text-lg font-bold text-[#D6C51E]">$0.00</div>
          </div>
        </div>
      </div>

      {/* On-chain reward accounting */}
      <div data-testid="reward-accounting-card">
        <div className="mb-2 flex items-center gap-2">
          <Database size={16} className="text-[#34D07A]" />
          <span className="text-base font-bold text-white">On-chain Reward Accounting</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="TTN Holding" value={`${usd2(me?.holding?.ttn)} TTN`} />
          <Stat label="Mined Value" value="$0.00" />
          <Stat label="Appreciation Value" value="$0.00" gold />
          <Stat label="Loss Restored" value="$0.00" />
        </div>
      </div>

      {/* Mining claim history */}
      <div data-testid="mining-history" className="card-glow p-5">
        <div className="mb-1 flex items-center gap-2">
          <History size={16} className="text-[#34D07A]" />
          <span className="text-base font-bold text-white">Mining Claim History</span>
        </div>
        <p className="mb-3 text-xs text-[#34D07A]">0 confirmed mining claims</p>
        <div className="grid grid-cols-3 gap-2 border-t border-white/5 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#D6C51E]">
          <span>Date</span>
          <span className="text-center">Reward</span>
          <span className="text-right">Tx</span>
        </div>
        <div className="border-t border-white/5 py-6 text-center text-xs text-white/45">
          No confirmed mining claims found for this wallet.
        </div>
      </div>
    </div>
  );
}
