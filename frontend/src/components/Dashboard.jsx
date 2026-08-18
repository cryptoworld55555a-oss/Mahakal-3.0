import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Coins, Users, CalendarDays, CalendarRange, CalendarClock, HeartHandshake } from "lucide-react";
import { getDashboardStats } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import ActivateCard from "@/components/ActivateCard";
import Countdown from "@/components/Countdown";

const usd = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
const num = (n) => new Intl.NumberFormat("en-US").format(n || 0);

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, ease: [0.16, 1, 0.3, 1] } }),
};

function PoolCard({ testid, icon: Icon, label, amount, accent, index, reset, resetTestid, onExpire }) {
  return (
    <motion.div
      data-testid={testid}
      custom={index}
      variants={fade}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-[#0A0D1C] p-4 active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
          {label}
        </span>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <span className="text-lg font-bold text-white">${usd(amount)}</span>
      {reset !== undefined ? (
        <span className="flex items-center gap-1 text-[11px] text-white/40">
          <span>resets in</span>
          <Countdown target={reset} testid={resetTestid} onExpire={onExpire} />
        </span>
      ) : (
        <span className="text-[11px] text-white/40">USDT</span>
      )}
    </motion.div>
  );
}

export default function Dashboard() {
  const { isConnected, user } = useWallet();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    getDashboardStats()
      .then((d) => {
        setStats(d);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div data-testid="dashboard-error" className="px-4 py-10 text-center text-sm text-white/50">
        Unable to load protocol data. Please retry.
      </div>
    );
  }

  const showActivate = isConnected && user && !user.is_active;

  return (
    <div data-testid="dashboard" className="flex flex-col gap-5 px-4 pt-5">
      {showActivate && (
        <ActivateCard min={stats?.min_activation_usdt || 10} onActivated={load} />
      )}

      {/* Hero: Creator balance + Total supply */}
      <div className="grid grid-cols-1 gap-4">
        <motion.div
          data-testid="creator-balance-card"
          custom={0}
          variants={fade}
          initial="hidden"
          animate="show"
          className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#161326] to-[#0A0D1C] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#D4AF37]/10 blur-2xl" />
          <div className="mb-3 flex items-center gap-2">
            <Crown size={16} className="text-[#D4AF37]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Creator Balance
            </span>
          </div>
          <div
            data-testid="creator-balance-value"
            className="bg-gradient-to-r from-[#D4AF37] to-[#FFDF73] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
            style={{ fontFamily: "Unbounded, Inter, sans-serif" }}
          >
            ${stats ? usd(stats.creator_balance_usdt) : "—"}
          </div>
          <span className="mt-1 block text-xs text-white/40">USDT · Protocol treasury</span>
        </motion.div>

        <motion.div
          data-testid="total-supply-card"
          custom={1}
          variants={fade}
          initial="hidden"
          animate="show"
          className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#0A0D1C] p-6"
        >
          <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-[#9D4EDD]/10 blur-2xl" />
          <div className="mb-3 flex items-center gap-2">
            <Coins size={16} className="text-[#00E5FF]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Total Token Supply
            </span>
          </div>
          <div
            data-testid="total-supply-value"
            className="text-3xl font-extrabold tracking-tight text-white"
            style={{ fontFamily: "Unbounded, Inter, sans-serif" }}
          >
            {stats ? num(stats.total_supply_ttn) : "200,000"} <span className="text-[#00E5FF]">TTN</span>
          </div>
          <span className="mt-1 block text-xs text-white/40">Fixed supply · No infinite mint</span>
        </motion.div>
      </div>

      {/* Pools */}
      <div>
        <h2 className="mb-3 px-1 text-sm font-semibold text-white/70">Reward Pools</h2>
        <div className="grid grid-cols-2 gap-3">
          <PoolCard testid="daily-pool-card" icon={CalendarDays} label="Daily Pool" amount={stats?.pools?.daily_usdt} accent="#00E5FF" index={2} reset={stats?.resets?.daily} resetTestid="daily-pool-countdown" onExpire={load} />
          <PoolCard testid="weekly-pool-card" icon={CalendarRange} label="Weekly Pool" amount={stats?.pools?.weekly_usdt} accent="#9D4EDD" index={3} reset={stats?.resets?.weekly} resetTestid="weekly-pool-countdown" onExpire={load} />
          <PoolCard testid="monthly-pool-card" icon={CalendarClock} label="Monthly Pool" amount={stats?.pools?.monthly_usdt} accent="#D4AF37" index={4} reset={stats?.resets?.monthly} resetTestid="monthly-pool-countdown" onExpire={load} />
          <PoolCard testid="community-fund-card" icon={HeartHandshake} label="Community Fund" amount={stats?.community_fund_usdt} accent="#00E5FF" index={5} />
        </div>
      </div>

      {/* Total activated users */}
      <motion.div
        data-testid="activated-users-card"
        custom={6}
        variants={fade}
        initial="hidden"
        animate="show"
        className="flex items-center justify-between rounded-2xl border border-white/5 bg-gradient-to-r from-[#0A0D1C] to-[#0F1326] p-5"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00E5FF]/10">
            <Users size={20} className="text-[#00E5FF]" />
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Total Activated Users
            </span>
            <span data-testid="activated-users-value" className="text-2xl font-bold text-white">
              {stats ? num(stats.total_activated_users) : "—"}
            </span>
          </div>
        </div>
        <span className="text-xs text-white/40" data-testid="total-users-value">
          {stats ? `of ${num(stats.total_users)} joined` : ""}
        </span>
      </motion.div>
    </div>
  );
}
