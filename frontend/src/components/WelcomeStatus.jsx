import React from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { UserCircle2, TrendingUp } from "lucide-react";
import { LOGO_URL } from "@/config";

const money = (n) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n || 0);

export default function WelcomeStatus({ stats, me }) {
  const spark = (stats?.price_spark || []).map((v, i) => ({ i, v }));
  const price = stats?.price_usd ?? 10;

  return (
    <div data-testid="welcome-status-card" className="card-glow relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0AA84F]/14 via-transparent to-[#FFA000]/12" />
      <img
        src={LOGO_URL}
        alt="TITAN"
        onError={(e) => (e.currentTarget.style.display = "none")}
        className="pointer-events-none absolute right-2 top-4 h-24 w-24 rounded-full object-cover opacity-95 shadow-[0_0_24px_rgba(10,168,79,0.4)]"
      />
      <div className="relative z-10 max-w-[68%]">
        <div className="flex items-center gap-2.5">
          <UserCircle2 size={30} className="text-[#34D07A]" />
          <div className="leading-tight">
            <div className="text-xs text-white/50">Welcome back,</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/50">UID</span>
              <span data-testid="welcome-uid" className="font-bold text-[#34D07A]">
                {me?.uid || "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-white/50">STATUS</span>
          {me?.is_active ? (
            <span data-testid="welcome-status" className="font-bold text-[#34D07A]">Active</span>
          ) : (
            <span data-testid="welcome-status" className="font-bold text-white/60">Inactive</span>
          )}
        </div>

        <div className="mt-4">
          <div className="text-[11px] text-white/40">1 TTN =</div>
          <div className="flex items-end gap-2">
            <span data-testid="ttn-price" className="text-2xl font-extrabold text-white" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
              ${money(price)}
            </span>
            <TrendingUp size={16} className="mb-1 text-[#34D07A]" />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-3 h-12 w-full" data-testid="price-sparkline">
        <ResponsiveContainer width="99%" height="100%" minWidth={0}>
          <LineChart data={spark} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0AA84F" />
                <stop offset="55%" stopColor="#65B82E" />
                <stop offset="100%" stopColor="#FFC400" />
              </linearGradient>
            </defs>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Line
              type="monotone"
              dataKey="v"
              stroke="url(#sparkGrad)"
              strokeWidth={2.5}
              isAnimationActive={false}
              activeDot={false}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (index !== spark.length - 1 || cx == null || cy == null) return null;
                return (
                  <g key="live-dot" data-testid="price-live-dot">
                    <circle cx={cx} cy={cy} r={7} fill="#D6C51E" className="spark-live-glow" />
                    <circle cx={cx} cy={cy} r={3.4} fill="#FFFDE7" stroke="#22C55E" strokeWidth={1.6} />
                  </g>
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
