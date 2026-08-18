import React from "react";
import { User, Users, ExternalLink } from "lucide-react";
import SectionLabel from "@/components/SectionLabel";
import { config } from "@/config";

const usd = (n) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function TeamReward({ me }) {
  const team = me?.team || {};
  const explorer = `${config.explorer}/address/${config.mainProtocolAddress}`;
  return (
    <div>
      <SectionLabel>Team Reward</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <div data-testid="direct-reward-card" className="card-glow p-4">
          <User size={16} className="mb-2 text-[#34D07A]" />
          <div className="grad-label">Direct Reward</div>
          <div className="text-xl font-extrabold text-white">${usd(team.direct_reward_usdt)}</div>
        </div>
        <div data-testid="level-reward-card" className="card-glow p-4">
          <Users size={16} className="mb-2 text-[#34D07A]" />
          <div className="grad-label">Level Reward</div>
          <div className="text-xl font-extrabold text-white">${usd(team.level_reward_usdt)}</div>
        </div>
      </div>

      <a
        data-testid="onchain-data-link"
        href={explorer}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex items-center justify-between rounded-xl border border-[#3C6B33]/50 bg-[#0A1710] px-4 py-3 text-xs font-semibold text-white/60 active:scale-[0.99]"
      >
        MINING CONTRACT ON-CHAIN DATA
        <ExternalLink size={14} className="text-[#34D07A]" />
      </a>
    </div>
  );
}
