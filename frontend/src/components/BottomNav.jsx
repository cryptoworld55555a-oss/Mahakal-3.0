import React from "react";
import { ArrowRightLeft, Layers, Pickaxe, Users } from "lucide-react";
import { LOGO_URL } from "@/config";

const left = [
  { id: "stake", label: "Stake", icon: ArrowRightLeft },
  { id: "pools", label: "Pools", icon: Layers },
];
const right = [
  { id: "mining", label: "Mining", icon: Pickaxe },
  { id: "team", label: "My Team", icon: Users },
];

function Tab({ t, active, onChange }) {
  const Icon = t.icon;
  const isActive = active === t.id;
  return (
    <button
      data-testid={`nav-${t.id}`}
      onClick={() => onChange(t.id)}
      className={`flex h-full w-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
        isActive ? "text-[#4F8DFF]" : "text-white/40"
      }`}
    >
      <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
      {t.label}
    </button>
  );
}

export default function BottomNav({ active, onChange }) {
  const dashActive = active === "dashboard";
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 z-50 flex h-20 w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-white/10 bg-[#05080F]/90 px-2 backdrop-blur-2xl"
    >
      {left.map((t) => <Tab key={t.id} t={t} active={active} onChange={onChange} />)}

      {/* Center Dashboard logo */}
      <button
        data-testid="nav-dashboard"
        onClick={() => onChange("dashboard")}
        className="relative flex w-16 flex-col items-center"
      >
        <span
          className={`absolute -top-7 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full ring-2 transition-all ${
            dashActive ? "ring-[#2F6BFF] shadow-[0_0_18px_rgba(47,107,255,0.7)]" : "ring-white/15"
          }`}
        >
          <img src={LOGO_URL} alt="TITAN" className="h-full w-full object-cover" />
        </span>
        <span className={`mt-8 text-[10px] font-semibold ${dashActive ? "text-[#4F8DFF]" : "text-white/40"}`}>
          Dashboard
        </span>
      </button>

      {right.map((t) => <Tab key={t.id} t={t} active={active} onChange={onChange} />)}
    </nav>
  );
}
