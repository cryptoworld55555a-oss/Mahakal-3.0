import React, { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, Layers, Cpu, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import SectionLabel from "@/components/SectionLabel";

const QUICK = [10, 50, 100, 200, 500, 1000];
const MIN = 10;
const MAX = 1000;

const money = (n) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const whole = (n) => new Intl.NumberFormat("en-US").format(Math.round(n || 0));

function AllocRow({ pct, label, value, testid }) {
  return (
    <div className="flex items-center justify-between border-t border-white/5 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-white/60">
        <span className="font-bold text-[#D6C51E]">{pct}%</span>
        <span className="text-white/30">→</span>
        {label}
      </span>
      <span data-testid={testid} className="font-bold text-white">${money(value)}</span>
    </div>
  );
}

export default function StakePage() {
  const [amount, setAmount] = useState("10");
  const val = Math.min(MAX, Math.max(0, Number(amount) || 0));

  const buy = val * 0.6;
  const reward = val * 0.35;
  const dev = val * 0.05;
  const cap = val * 2;
  const daily = cap * 0.005;

  const stake = () => {
    if (val < MIN) return toast.error(`Minimum stake is $${MIN}`);
    if (val > MAX) return toast.error(`Maximum is $${MAX}/day`);
    if (val % 10 !== 0) return toast.error("Amount must be in multiples of $10");
    toast("Staking goes live in the next module");
  };

  return (
    <div data-testid="stake-page" className="flex flex-col gap-4 px-4 pt-4 pb-4">
      <SectionLabel center>Stake Participation</SectionLabel>

      {/* Wallet balance */}
      <div data-testid="stake-wallet-card" className="card-glow flex items-center justify-between p-4">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
          <Wallet size={16} className="text-[#34D07A]" /> Available Wallet Balance
        </span>
        <span data-testid="stake-wallet-balance" className="text-lg font-bold text-white">
          0 <span className="text-[#D6C51E]">USDT</span>
        </span>
      </div>

      {/* Amount input */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-glow p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Stake Amount (USDT)</span>
        </div>
        <p className="mb-4 text-[11px] text-white/45">
          Min <b className="text-[#D6C51E]">${MIN}</b> · Max <b className="text-[#D6C51E]">${whole(MAX)}/day</b> · multiples of <b className="text-[#D6C51E]">$10</b>
        </p>

        <div className="mb-4 flex items-center rounded-xl border border-[#3C6B33]/50 bg-black/30 px-4">
          <span className="text-sm text-white/40">$</span>
          <input
            data-testid="stake-amount-input"
            type="number"
            inputMode="numeric"
            min={MIN}
            max={MAX}
            step={10}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent py-3 pl-1 text-lg font-bold text-[#D6C51E] outline-none placeholder:text-white/30"
            placeholder="10"
          />
          <span className="text-xs font-semibold text-white/40">USDT</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              data-testid={`stake-quick-${q}`}
              onClick={() => setAmount(String(q))}
              className={`rounded-xl border py-2.5 text-sm font-bold transition-all active:scale-95 ${
                Number(amount) === q
                  ? "border-[#D6C51E] bg-[#D6C51E]/15 text-[#D6C51E] shadow-[0_0_12px_rgba(214,197,30,0.35)]"
                  : "border-[#3C6B33]/50 bg-white/5 text-white/60"
              }`}
            >
              ${q}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Allocation preview */}
      <div data-testid="stake-allocation" className="card-glow p-5">
        <div className="mb-1 flex items-center gap-2">
          <Layers size={15} className="text-[#34D07A]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Stake Allocation Preview</span>
        </div>
        <AllocRow pct={60} label="To Buy TTN" value={buy} testid="alloc-buy" />
        <AllocRow pct={35} label="For Reward" value={reward} testid="alloc-reward" />
        <AllocRow pct={5} label="For Development" value={dev} testid="alloc-dev" />
      </div>

      {/* Mining cap + daily generation */}
      <div className="grid grid-cols-2 gap-3">
        <div data-testid="mining-cap-granted" className="card-glow p-4">
          <Cpu size={16} className="mb-2 text-[#34D07A]" />
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Mining Cap Granted</div>
          <div data-testid="mining-cap-value" className="text-xl font-extrabold text-[#D6C51E]">${whole(cap)}</div>
          <div className="text-[11px] text-white/50">2× Standard</div>
        </div>
        <div data-testid="daily-generation" className="card-glow p-4">
          <TrendingUp size={16} className="mb-2 text-[#34D07A]" />
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Daily Generation</div>
          <div data-testid="daily-gen-value" className="text-xl font-extrabold text-white">${money(daily)}<span className="text-xs text-white/40">/day</span></div>
          <div className="text-[11px] text-white/50">0.5% of Cap</div>
        </div>
      </div>

      <button
        data-testid="stake-submit-btn"
        onClick={stake}
        className="mt-1 h-12 w-full rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] text-base font-bold text-black active:scale-[0.98] shadow-[0_0_18px_rgba(10,168,79,0.45)]"
      >
        Stake ${whole(val)}
      </button>
    </div>
  );
}
