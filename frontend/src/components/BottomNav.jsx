import React from "react";
import { ArrowRightLeft, Layers, LayoutDashboard, Pickaxe, Users } from "lucide-react";

const tabs = [
  { id: "stake", label: "Stake", icon: ArrowRightLeft },
  { id: "pools", label: "Pools", icon: Layers },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "mining", label: "Mining", icon: Pickaxe },
  { id: "team", label: "My Team", icon: Users },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 z-50 flex h-20 w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-white/10 bg-[#05080F]/90 px-2 backdrop-blur-2xl"
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            data-testid={`nav-${t.id}`}
            onClick={() => onChange(t.id)}
            className={`flex h-full w-16 flex-col items-center justify-center gap-1.5 text-[10px] font-medium transition-colors ${
              isActive ? "text-[#4F8DFF]" : "text-white/40"
            }`}
          >
            {isActive ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F6BFF]/15 drop-shadow-[0_0_8px_rgba(47,107,255,0.6)]">
                <Icon size={20} strokeWidth={2.2} />
              </span>
            ) : (
              <Icon size={22} strokeWidth={1.8} />
            )}
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
