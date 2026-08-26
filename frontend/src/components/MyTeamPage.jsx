import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, User, Copy, Share2, Star, Award, Trophy, Gem, Lock, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronDown, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { getTeam } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import SectionLabel from "@/components/SectionLabel";

const usd = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
const usd2 = (n) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const copy = (text, msg) => {
  navigator.clipboard?.writeText(text).then(() => toast.success(msg)).catch(() => toast.error("Copy failed"));
};

const TIER = {
  level1: { Icon: User, color: "#34D07A" },
  star: { Icon: Star, color: "#65B82E" },
  silver: { Icon: Award, color: "#AEB6BE" },
  gold: { Icon: Trophy, color: "#D6C51E" },
  diamond: { Icon: Gem, color: "#FFA000" },
};

function StructCard({ side, data, testid }) {
  return (
    <div data-testid={testid} className="card-glow p-4">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#34D07A]">{side} total business</div>
      <div className="text-2xl font-extrabold text-[#D6C51E]">${usd(data.business_usdt)}</div>
      <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
        <span className="text-white/50">Team size</span>
        <span className="font-bold text-white">{data.team_size}</span>
      </div>
    </div>
  );
}

function LevelCard({ lv }) {
  const { Icon, color } = TIER[lv.tier] || TIER.star;
  return (
    <div data-testid={`team-level-${lv.tier}`} className="card-glow p-4" style={{ borderColor: `${color}55` }}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
          style={{ borderColor: `${color}77`, backgroundColor: `${color}1A`, boxShadow: `0 0 16px ${color}44` }}
        >
          <Icon size={24} style={{ color }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-bold grad-title">{lv.name}</span>
            {lv.unlocked ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#34D07A]"><CheckCircle2 size={13} /> {lv.status || "Unlocked"}</span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-white/40"><Lock size={12} /> Locked</span>
            )}
          </div>
          <div className="text-[11px] text-white/45">{lv.sub}</div>
          {lv.reqs?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lv.reqs.map((r) => {
                const ok = r.have >= r.need;
                const val = r.money ? `$${usd(r.have)}/$${usd(r.need)}` : `${r.have}/${r.need}`;
                return (
                  <span key={r.label} className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${ok ? "border-[#0AA84F]/45 bg-[#0AA84F]/12 text-[#34D07A]" : "border-white/10 bg-white/5 text-white/55"}`}>
                    {r.label}: <b className={ok ? "text-[#34D07A]" : "text-[#FFA000]"}>{val}</b>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyTeamPage() {
  const { address, user } = useWallet();
  const [team, setTeam] = useState(null);
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (address) getTeam(address).then(setTeam).catch(() => {});
  }, [address]);

  useEffect(() => { setPage(1); }, [tab]);

  const refLinks = useMemo(() => {
    const code = team?.referral_code || user?.uid || "";
    if (!code) return { left: "", right: "" };
    const base = `${window.location.origin}/?ref=${code}`;
    return { left: `${base}&leg=left`, right: `${base}&leg=right` };
  }, [team, user]);

  if (!address) {
    return (
      <div data-testid="team-page" className="flex flex-col gap-4 px-4 pt-4 pb-4">
        <SectionLabel center>Network &amp; Referral</SectionLabel>
        <div className="card-glow p-8 text-center text-sm text-white/55">
          Connect your wallet to view your team, sponsor and network rewards.
        </div>
      </div>
    );
  }

  const t = team || {};
  const st = t.structure || { left: {}, right: {} };
  const d = t.directs || {};
  const ls = t.level_summary || {};
  const acc = t.accounting || {};
  const q = t.qualification || { unlocked: 0, total: 15, levels: [] };

  const PAGE_SIZE = 10;
  const allMembers = t.members || [];
  const filteredMembers = tab === "all" ? allMembers : allMembers.filter((m) => (m.side || "").toLowerCase() === tab);
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageStart = (curPage - 1) * PAGE_SIZE;
  const pageMembers = filteredMembers.slice(pageStart, pageStart + PAGE_SIZE);
  const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

  return (
    <div data-testid="team-page" className="flex flex-col gap-4 px-4 pt-4 pb-4">
      <SectionLabel center>Network &amp; Referral</SectionLabel>

      {/* My Sponsor */}
      <div data-testid="team-sponsor" className="card-glow flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3C6B33]/60 bg-[#0AA84F]/12">
            <User size={20} className="text-[#34D07A]" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#34D07A]">My Sponsor</div>
            <div className="truncate font-mono text-sm font-bold text-white">{t.sponsor ? shortAddr(t.sponsor) : "—"}</div>
          </div>
        </div>
        <button
          data-testid="team-sponsor-copy"
          onClick={() => copy(t.sponsor || "", "Sponsor address copied")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D6C51E]/40 text-[#D6C51E] active:scale-95"
        >
          <Copy size={15} />
        </button>
      </div>

      {/* Referral links - Left & Right legs */}
      <div data-testid="team-referral" className="card-glow p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#34D07A]">
          <Share2 size={14} /> Your Referral Links
        </div>

        {/* Left leg */}
        <div className="mb-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#34D07A]">Left Leg</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-lg border border-[#3C6B33]/50 bg-black/30 px-3 py-2 font-mono text-xs text-white/70">
              {refLinks.left || "—"}
            </div>
            <button
              data-testid="team-referral-copy-left"
              onClick={() => copy(refLinks.left, "Left referral link copied")}
              className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[#0AA84F] to-[#34D07A] px-3 text-xs font-bold text-black active:scale-95"
            >
              <Copy size={14} /> Copy
            </button>
          </div>
        </div>

        {/* Right leg */}
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#D6C51E]">Right Leg</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-lg border border-[#3C6B33]/50 bg-black/30 px-3 py-2 font-mono text-xs text-white/70">
              {refLinks.right || "—"}
            </div>
            <button
              data-testid="team-referral-copy-right"
              onClick={() => copy(refLinks.right, "Right referral link copied")}
              className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[#D6C51E] to-[#0AA84F] px-3 text-xs font-bold text-black active:scale-95"
            >
              <Copy size={14} /> Copy
            </button>
          </div>
        </div>
      </div>

      {/* My Team Structure (binary) */}
      <div className="flex items-center gap-2 px-1">
        <GitBranch size={15} className="text-[#34D07A]" />
        <span className="grad-label">My Team Structure</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StructCard side="Left" data={st.left || {}} testid="team-left" />
        <StructCard side="Right" data={st.right || {}} testid="team-right" />
      </div>

      {/* Direct Referrals */}
      <div data-testid="team-directs" className="card-glow p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-white">Direct Referrals</div>
            <div className="text-xl font-extrabold text-[#D6C51E]">${usd(d.reward_usdt)}<span className="text-sm text-white/40">/{d.count || 0}</span></div>
          </div>
          <button
            data-testid="team-view-directs"
            onClick={() => toast("Direct list goes live in the next module")}
            className="rounded-lg border border-[#34D07A]/45 px-3 py-2 text-xs font-semibold text-[#34D07A] active:scale-95"
          >
            View directs
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#34D07A] shadow-[0_0_6px_rgba(52,208,122,0.8)]" />
            <span className="text-white/55">Active</span>
            <span className="ml-auto font-bold text-white">{d.active || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]" />
            <span className="text-white/55">Inactive</span>
            <span className="ml-auto font-bold text-white">{d.inactive || 0}</span>
          </div>
        </div>
      </div>

      {/* 15-Level Team Summary */}
      <div data-testid="team-15level" className="card-glow p-4">
        <div className="mb-2 flex items-center gap-2">
          <Users size={15} className="text-[#34D07A]" />
          <span className="grad-label">15-Level Team Summary</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#3C6B33]/50 p-3">
            <div className="text-[10px] uppercase text-white/45">Total team size</div>
            <div className="text-lg font-bold text-white">{ls.total_team_size || 0}</div>
          </div>
          <div className="rounded-xl border border-[#3C6B33]/50 p-3">
            <div className="text-[10px] uppercase text-white/45">Total team business</div>
            <div className="text-lg font-bold text-[#D6C51E]">${usd(ls.total_team_business_usdt)}</div>
          </div>
        </div>
      </div>

      {/* Team Accounting */}
      <div data-testid="team-accounting" className="card-glow p-4">
        <div className="mb-1 text-base font-bold grad-title">Team Accounting</div>
        <p className="mb-3 text-[11px] text-white/45">Business and reward overview</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#3C6B33]/50 p-3">
            <div className="text-[10px] uppercase text-white/45">Direct-Level rewards</div>
            <div className="text-lg font-bold text-[#34D07A]">${usd2(acc.direct_level_rewards_usdt)}</div>
          </div>
          <div className="rounded-xl border border-[#3C6B33]/50 p-3">
            <div className="text-[10px] uppercase text-white/45">Lapsed (Direct-Level)</div>
            <div className="text-lg font-bold text-[#FFA000]">${usd2(acc.lapsed_usdt)}</div>
          </div>
        </div>
      </div>

      {/* Level Qualification Progress */}
      <div data-testid="team-qualification-header" className="card-glow flex items-center justify-between p-4">
        <div>
          <div className="text-base font-bold grad-title">Level Qualification Progress</div>
          <p className="text-[11px] text-white/45">Network reward qualification</p>
        </div>
        <span data-testid="team-unlocked-count" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D6C51E]/60 bg-[#D6C51E]/12 text-sm font-extrabold text-[#D6C51E]">
          {q.unlocked}/{q.total}
        </span>
      </div>
      <div data-testid="team-qualification" className="flex flex-col gap-3">
        {(q.levels || []).map((lv) => (
          <LevelCard key={lv.tier} lv={lv} />
        ))}
      </div>

      {/* Total Team */}
      <div data-testid="team-total" className="card-glow p-4">
        <div className="mb-1 flex items-center gap-2">
          <Users size={15} className="text-[#34D07A]" />
          <span className="grad-label">Total Team</span>
        </div>
        <p className="mb-3 text-[11px] text-white/45">{t.total_members || 0} team members</p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {["all", "left", "right"].map((k) => (
            <button
              key={k}
              data-testid={`team-filter-${k}`}
              onClick={() => setTab(k)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-all active:scale-95 ${
                tab === k ? "border-[#D6C51E] bg-[#D6C51E]/15 text-[#D6C51E]" : "border-[#3C6B33]/50 bg-white/5 text-white/55"
              }`}
            >
              {k}
            </button>
          ))}
          <button className="ml-auto flex items-center gap-1 rounded-lg border border-[#3C6B33]/50 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/55">
            All Levels <ChevronDown size={13} />
          </button>
        </div>

        <div className="grid grid-cols-[1.4fr_0.7fr_0.5fr_0.8fr_0.9fr] gap-1 border-t border-white/5 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#D6C51E]">
          <span>Name</span>
          <span className="text-center">Side</span>
          <span className="text-center">Lvl</span>
          <span className="text-right">Stake</span>
          <span className="text-right">Status</span>
        </div>

        {pageMembers.length === 0 ? (
          <div className="border-t border-white/5 py-8 text-center text-xs text-white/45">
            No team members yet. Share your referral link to start building your network.
          </div>
        ) : (
          <div data-testid="team-member-list" className="divide-y divide-white/5">
            {pageMembers.map((m) => (
              <div
                key={m.address}
                data-testid={`team-member-${m.uid}`}
                className="grid grid-cols-[1.4fr_0.7fr_0.5fr_0.8fr_0.9fr] items-center gap-1 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-bold text-white">{m.uid}</div>
                  <div className="truncate font-mono text-[10px] text-white/40">{shortAddr(m.address)}</div>
                </div>
                <span className="text-center">
                  {m.side ? (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold capitalize ${m.side === "left" ? "bg-[#0AA84F]/15 text-[#34D07A]" : "bg-[#D6C51E]/15 text-[#D6C51E]"}`}>
                      {m.side}
                    </span>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                </span>
                <span className="text-center text-white/60">{m.level || 1}</span>
                <span className="text-right font-semibold text-white">${usd2(m.stake_usdt)}</span>
                <span className="text-right">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${m.active ? "bg-[#0AA84F]/15 text-[#34D07A]" : "bg-red-500/15 text-red-400"}`}>
                    {m.active ? "Active" : "Inactive"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs text-white/55">
          <button
            data-testid="team-page-prev"
            disabled={curPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#3C6B33]/50 text-white/40 disabled:opacity-30 active:scale-95"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Showing {filteredMembers.length === 0 ? 0 : pageStart + 1}-{pageStart + pageMembers.length} of {filteredMembers.length}
          </span>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D6C51E]/50 bg-[#D6C51E]/12 font-bold text-[#D6C51E]">{curPage}</span>
            <button
              data-testid="team-page-next"
              disabled={curPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#3C6B33]/50 text-white/40 disabled:opacity-30 active:scale-95"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
