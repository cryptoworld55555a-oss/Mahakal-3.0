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
      className="fixed bottom-0 left-1/2 z-50 flex h-20 w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-white/10 bg-black/80 px-2 backdrop-blur-2xl"
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
              isActive
                ? "text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]"
                : "text-white/40"
            }`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
