import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Coins, Users, CalendarDays, CalendarRange, CalendarClock, HeartHandshake } from "lucide-react";
import { getDashboardStats } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import ActivateCard from "@/components/ActivateCard";
import Countdown from "@/components/Countdown";

const COIN_URL =
  "https://static.prod-images.emergentagent.com/jobs/3867ed87-dcc2-48ad-adde-0ee1b9542d8a/images/2859d9f0416d04032fb0a030f9b68fd980a3a10fe9c7b40be7b277fa216d5e8f.jpeg";

const usd = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
const num = (n) => new Intl.NumberFormat("en-US").format(n || 0);

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, ease: [0.16, 1, 0.3, 1] } }),
};

function PoolCard({ testid, icon: Icon, label, amount, index, reset, resetTestid, onExpire }) {
  return (
    <motion.div
      data-testid={testid}
      custom={index}
      variants={fade}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-[#0A1120] p-4 active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
          {label}
        </span>
        <Icon size={18} className="text-[#4F8DFF]" />
      </div>
      <span className="text-xl font-bold text-white">${usd(amount)}</span>
      {reset !== undefined ? (
        <span className="flex items-center gap-1 text-[11px] text-[#4F8DFF]/80">
          <span className="text-white/40">resets in</span>
          <Countdown target={reset} testid={resetTestid} onExpire={onExpire} />
        </span>
      ) : (
        <span className="text-[11px] font-semibold text-[#4F8DFF]">USDT</span>
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

      {/* Hero: Total token supply with 3D coin */}
      <motion.div
        data-testid="total-supply-card"
        custom={0}
        variants={fade}
        initial="hidden"
        animate="show"
        className="relative min-h-[184px] overflow-hidden rounded-3xl border border-[#2F6BFF]/20 bg-gradient-to-br from-[#0B1530] to-[#070C1A] p-6 shadow-[0_8px_32px_rgba(47,107,255,0.12)]"
      >
        <img
          src={COIN_URL}
          alt="TTN coin"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="pointer-events-none absolute -right-3 top-1/2 w-48 -translate-y-1/2 select-none opacity-95 mix-blend-screen"
        />
        <div className="relative z-10 max-w-[64%]">
          <div className="mb-3 flex items-center gap-2">
            <Coins size={16} className="text-[#4F8DFF]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Total Token Supply
            </span>
          </div>
          <div
            data-testid="total-supply-value"
            className="text-4xl font-extrabold leading-none tracking-tight text-white"
            style={{ fontFamily: "Unbounded, Inter, sans-serif" }}
          >
            {stats ? num(stats.total_supply_ttn) : "200,000"}{" "}
            <span className="text-[#3B82F6]">TTN</span>
          </div>
          <span className="mt-2 block text-xs text-white/40">Fixed supply · No infinite mint</span>
        </div>
      </motion.div>

      {/* Creator balance */}
      <motion.div
        data-testid="creator-balance-card"
        custom={1}
        variants={fade}
        initial="hidden"
        animate="show"
        className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#0A1120] p-6"
      >
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#2F6BFF]/10 blur-2xl" />
        <div className="mb-3 flex items-center gap-2">
          <Crown size={16} className="text-[#4F8DFF]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
            Creator Balance
          </span>
        </div>
        <div
          data-testid="creator-balance-value"
          className="bg-gradient-to-r from-[#6AA0FF] to-[#2F6BFF] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
          style={{ fontFamily: "Unbounded, Inter, sans-serif" }}
        >
          ${stats ? usd(stats.creator_balance_usdt) : "—"}
        </div>
        <span className="mt-1 block text-xs text-white/40">USDT · Protocol treasury</span>
      </motion.div>

      {/* Pools */}
      <div>
        <h2 className="mb-3 px-1 text-base font-semibold text-white">Reward Pools</h2>
        <div className="grid grid-cols-2 gap-3">
          <PoolCard testid="daily-pool-card" icon={CalendarDays} label="Daily Pool" amount={stats?.pools?.daily_usdt} index={2} reset={stats?.resets?.daily} resetTestid="daily-pool-countdown" onExpire={load} />
          <PoolCard testid="weekly-pool-card" icon={CalendarRange} label="Weekly Pool" amount={stats?.pools?.weekly_usdt} index={3} reset={stats?.resets?.weekly} resetTestid="weekly-pool-countdown" onExpire={load} />
          <PoolCard testid="monthly-pool-card" icon={CalendarClock} label="Monthly Pool" amount={stats?.pools?.monthly_usdt} index={4} reset={stats?.resets?.monthly} resetTestid="monthly-pool-countdown" onExpire={load} />
          <PoolCard testid="community-fund-card" icon={HeartHandshake} label="Community Fund" amount={stats?.community_fund_usdt} index={5} />
        </div>
      </div>

      {/* Total activated users */}
      <motion.div
        data-testid="activated-users-card"
        custom={6}
        variants={fade}
        initial="hidden"
        animate="show"
        className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0A1120] p-5"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2F6BFF]/12">
            <Users size={20} className="text-[#4F8DFF]" />
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
        <span className="text-xs font-semibold text-[#4F8DFF]" data-testid="total-users-value">
          {stats ? `${num(stats.total_users)} joined` : ""}
        </span>
      </motion.div>
    </div>
  );
}
