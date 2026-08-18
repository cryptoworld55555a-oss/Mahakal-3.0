import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Layers, Pickaxe, Coins, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import SectionLabel from "@/components/SectionLabel";

const usd = (n) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const soon = (f) => toast(`${f} — coming in the next module`);

export default function MyBusiness({ me }) {
  const mining = me?.mining || {};
  const holding = me?.holding || {};
  const sources = me?.profit_sources || [];
  const pieData = sources.map((s) => ({ ...s, value: s.value || 0.0001 }));

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>My Business</SectionLabel>

      {/* Stake participation */}
      <div data-testid="stake-card" className="card-glow p-5">
        <div className="mb-2 flex items-center gap-2">
          <Layers size={16} className="text-[#34D07A]" />
          <span className="grad-label">Stake Participation</span>
        </div>
        <div className="text-xs text-white/50">My total stake</div>
        <div className="mb-3 text-2xl font-extrabold text-white" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
          ${usd(me?.stake_usdt)} <span className="text-sm text-white/40">USDT</span>
        </div>
        <button data-testid="stake-btn" onClick={() => soon("Staking")} className="w-full rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#FFA000] py-3 text-sm font-bold text-black active:scale-[0.98]">
          Stake
        </button>
      </div>

      {/* Mining */}
      <div className="grid grid-cols-2 gap-3">
        <div data-testid="mining-cap-card" className="card-glow p-4">
          <Pickaxe size={16} className="mb-2 text-[#34D07A]" />
          <div className="grad-label">Available Mining Cap</div>
          <div className="text-xl font-extrabold text-white">${usd(mining.available_cap_usdt)}</div>
        </div>
        <div data-testid="mining-reward-card" className="card-glow p-4">
          <Pickaxe size={16} className="mb-2 text-[#34D07A]" />
          <div className="grad-label">Generated Reward</div>
          <div className="mb-2 text-xl font-extrabold text-white">${usd(mining.generated_reward_usdt)}</div>
          <button data-testid="mine-btn" onClick={() => soon("Mining")} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0AA84F]/20 py-2 text-xs font-semibold text-[#34D07A] active:scale-95">
            <Pickaxe size={13} /> Mine
          </button>
          <div className="mt-1 text-center text-[10px] text-white/40">Requires ${usd(mining.requires_usdt)}</div>
        </div>
      </div>

      {/* Holding */}
      <div data-testid="holding-card" className="card-glow p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-[#34D07A]" />
            <span data-testid="holding-value" className="text-lg font-bold text-white">{usd(holding.ttn)} TTN</span>
          </div>
          <button data-testid="sell-btn" onClick={() => soon("Selling")} className="flex items-center gap-1 rounded-xl bg-[#0AA84F]/15 px-3 py-2 text-xs font-semibold text-[#34D07A] active:scale-95">
            Sell <ArrowRight size={13} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[10px] text-white/40">Mined value</div><div className="text-sm font-semibold text-white">${usd(holding.mined_value_usdt)}</div></div>
          <div><div className="text-[10px] text-white/40">Current value</div><div className="text-sm font-semibold text-white">${usd(holding.current_value_usdt)}</div></div>
          <div><div className="text-[10px] text-white/40">Appreciation</div><div className="text-sm font-semibold text-[#34D07A]">+${usd(holding.appreciation_usdt)}</div></div>
        </div>
      </div>

      {/* Total profit */}
      <div data-testid="total-profit-card" className="card-glow p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="grad-label">Total Profit</div>
            <div className="text-2xl font-extrabold text-white" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
              ${usd(me?.total_profit_usdt)}
            </div>
          </div>
          <div className="relative h-20 w-20">
            <ResponsiveContainer width="99%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={26} outerRadius={38} paddingAngle={2} stroke="none">
                  {pieData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white/60">
              5 SRC
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {sources.map((s) => (
            <div key={s.label} data-testid={`profit-legend-${s.label.toLowerCase().replace(/\s+/g, "-")}`} className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-white/60">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label}
              </span>
              <span className="text-white/80">${usd(s.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
