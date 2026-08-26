import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, History, XCircle, CheckCircle2, Info, X } from "lucide-react";
import { getDashboardStats, getPools } from "@/lib/api";
import { claimCategory } from "@/lib/chain";
import { notifySuccess } from "@/lib/notify";
import { toast } from "sonner";
import { useWallet } from "@/context/WalletContext";
import SectionLabel from "@/components/SectionLabel";

const usd = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
const usd2 = (n) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function fmtCountdown(secs) {
  if (secs == null || secs <= 0) return "00:00:00";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (x) => String(x).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function fmtOpenAt(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function ReqRow({ label, have, need, suffix = "" }) {
  const ok = have >= need;
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-white/60">{label}</span>
      <span className={`flex items-center gap-1.5 font-semibold ${ok ? "text-[#34D07A]" : "text-red-400"}`}>
        {suffix}{have}/{need}{suffix ? "" : ""}
        {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      </span>
    </div>
  );
}

function PoolCard({ p, onInfo, onHistory, onClaim, busy, now }) {
  const est = p.estimate != null ? p.estimate : (p.achievers >= 0 ? p.balance / (p.achievers + 1) : 0);
  const qualified = p.reqs ? p.reqs.every((r) => r.ok) : (p.directsHave >= p.directsNeed && p.capHave >= p.capNeed);
  // Cycle-gated claim: pool shares are frozen & claimable ONLY after the cycle countdown ends.
  const claim = p.claim || {};
  const settled = Number(claim.settled_usd || 0);
  const secsLeft = claim.unlock_at ? Math.max(0, Math.floor((new Date(claim.unlock_at).getTime() - now) / 1000)) : (claim.seconds_left ?? null);
  const claimOpen = !!claim.open && settled > 0;
  const canClaim = claimOpen;
  return (
    <div data-testid={`pool-${p.key}`} className="card-glow p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold grad-title">{p.title}</div>
          <div className="text-[11px] text-white/45">{p.period}</div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${qualified ? "border-[#0AA84F]/50 bg-[#0AA84F]/15 text-[#34D07A]" : "border-red-500/45 bg-red-500/15 text-red-400"}`}>
          {qualified ? "Qualified" : "Not qualified"}
        </span>
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wide text-white/45">Current Pool Balance</div>
      <div className="text-3xl font-extrabold text-white">${usd2(p.balance)}</div>

      <div className="mt-3 rounded-xl border border-[#3C6B33]/50 p-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
          <span className="text-white/60">Estimated if you qualify</span>
          <span className="font-bold text-[#D6C51E]">${usd2(est)}</span>
        </div>
        <div className="flex items-center justify-between pt-2 text-sm">
          <span className="text-white/60">On-chain achievers</span>
          <span className="font-bold text-[#34D07A]">{p.achievers}</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[#3C6B33]/50 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-white">Qualification</span>
          <span className={`text-xs font-semibold ${(p.pending ?? 0) > 0 ? "text-red-400" : "text-[#34D07A]"}`}>
            {(p.pending ?? 0) > 0 ? `${p.pending} pending` : "All met"}
          </span>
        </div>
        {p.reqs ? (
          p.reqs.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-1 text-xs">
              <span className="text-white/60">{r.label}</span>
              <span className={`flex items-center gap-1.5 font-semibold ${r.ok ? "text-[#34D07A]" : "text-red-400"}`}>
                {r.val} {r.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              </span>
            </div>
          ))
        ) : (          <>
            <ReqRow label={p.directsLabel} have={p.directsHave} need={p.directsNeed} />
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="text-white/60">Available mining cap</span>
              <span className="flex items-center gap-1.5 font-semibold text-red-400">
                ${p.capHave}/${p.capNeed} <XCircle size={14} />
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-[#3C6B33]/50 p-3">
        {claimOpen ? (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide text-white/45">
              <CheckCircle2 size={13} className="text-[#34D07A]" /> Your qualified share
            </div>
            <div data-testid={`pool-${p.key}-settled`} className="mt-1 text-2xl font-extrabold text-[#34D07A]">${usd2(settled)}</div>
            <div className="mt-0.5 text-[10px] text-white/40">Cycle closed · ready to claim as TTN</div>
          </div>
        ) : (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide text-white/45">
              <Clock size={13} className="text-[#D6C51E]" /> Claim opens when cycle ends
            </div>
            <div data-testid={`pool-${p.key}-countdown`} className="mt-1 font-mono text-2xl font-extrabold text-[#D6C51E]">
              {fmtCountdown(secsLeft)}
            </div>
            <div className="mt-0.5 text-[10px] text-white/40">
              Closes {fmtOpenAt(claim.unlock_at)} · then all qualifiers split the pool
            </div>
          </div>
        )}
      </div>

      <button
        data-testid={`pool-${p.key}-btn`}
        disabled={!canClaim || busy}
        onClick={() => onClaim(p)}
        className="mt-3 h-11 w-full rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] text-sm font-bold text-black active:scale-[0.98] disabled:bg-none disabled:bg-[#3C6B33]/30 disabled:text-white/50"
      >
        {busy ? "Claiming…" : claimOpen ? `Claim $${usd2(settled)}` : `Locked · ${fmtCountdown(secsLeft)}`}
      </button>

      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
        {p.reducesCap ? (
          <span className="text-[11px] text-red-400">REDUCES mining cap</span>
        ) : (
          <span className="text-[11px] text-[#34D07A]">Does NOT reduce mining cap</span>
        )}
        <div className="flex items-center gap-2">
          <button
            data-testid={`pool-${p.key}-history`}
            onClick={() => onHistory(p)}
            className="flex items-center gap-1 rounded-lg border border-[#D6C51E]/40 px-2.5 py-1 text-[11px] font-semibold text-[#D6C51E] active:scale-95"
          >
            <History size={12} /> History
          </button>
          <button
            data-testid={`pool-${p.key}-info`}
            onClick={() => onInfo(p)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#34D07A]/40 text-[#34D07A] active:scale-95"
          >
            <Info size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PoolsPage() {
  const { me, address } = useWallet();
  const [stats, setStats] = useState(null);
  const [live, setLive] = useState(null); // real per-user pool data
  const [claiming, setClaiming] = useState(""); // pool key being claimed
  const [modal, setModal] = useState(null); // {type:'info'|'history', pool}
  const [now, setNow] = useState(Date.now());
  useEffect(() => { getDashboardStats().then(setStats).catch(() => {}); }, []);
  useEffect(() => {
    if (address) getPools(address).then(setLive).catch(() => setLive(null));
  }, [address]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const doClaim = async (pool) => {
    if (pool.category == null) return;
    const claim = pool.claim || {};
    if (!claim.open || Number(claim.settled_usd || 0) <= 0) {
      toast.error("Claim is locked — it opens after the cycle countdown ends");
      return;
    }
    setClaiming(pool.key);
    try {
      const hash = await claimCategory(address, pool.category);
      notifySuccess(`${pool.title} Claim Successful`, `Tx: ${hash.slice(0, 10)}… · TTN in your wallet`);
      const fresh = await getPools(address);
      setLive(fresh);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.shortMessage || e?.message || "Claim failed");
    } finally {
      setClaiming("");
    }
  };

  const day = Math.floor(Date.now() / 86400000) % 1000;
  const fmtReq = (r) =>
    r.text ? r.text : r.usd ? `$${usd(r.have)}/$${usd(r.need)}` : `${r.have}/${r.need}`;
  const toReqs = (arr) => (arr || []).map((r) => ({ label: r.label, val: fmtReq(r), ok: r.ok }));
  const pendingOf = (arr) => (arr || []).filter((r) => !r.ok).length;

  const meta = stats?.pool_meta || {};
  const pools = live
    ? [
        { key: "daily", title: "Daily TITAN Pool", period: `Current on-chain day · ID ${day}`,
          balance: live.daily.balance, achievers: live.daily.achievers, estimate: live.daily.estimate,
          claim: live.daily.claim,
          reqs: toReqs(live.daily.reqs), pending: pendingOf(live.daily.reqs) },
        { key: "weekly", title: "Weekly Champion Pool", period: "Current on-chain week · ID 1",
          balance: live.weekly.balance, achievers: live.weekly.achievers, estimate: live.weekly.estimate,
          claim: live.weekly.claim,
          reqs: toReqs(live.weekly.reqs), pending: pendingOf(live.weekly.reqs) },
        { key: "monthly", title: "Monthly Owner Club Reward", period: "Current on-chain month · ID 1",
          balance: live.monthly.balance, achievers: live.monthly.achievers, estimate: live.monthly.estimate,
          claim: live.monthly.claim,
          reqs: [...toReqs(live.monthly.reqs), { label: "On-chain qualification", val: live.monthly.qualified ? "Submitted" : "Pending", ok: live.monthly.qualified }],
          pending: pendingOf(live.monthly.reqs) + (live.monthly.qualified ? 0 : 1) },
      ]
    : [
        { key: "daily", title: "Daily TITAN Pool", period: `Current on-chain day · ID ${day}`, balance: stats?.pools?.daily_usdt || 0, achievers: meta.daily?.qualified_ids || 0, reqs: [{ label: "Direct with 50+ Stake today", val: "0/1", ok: false }, { label: "Available mining cap", val: "$0/$100", ok: false }], pending: 2 },
        { key: "weekly", title: "Weekly Champion Pool", period: "Current on-chain week · ID 1", balance: stats?.pools?.weekly_usdt || 0, achievers: meta.weekly?.qualified_ids || 0, reqs: [{ label: "Directs with 50+ Stake this week", val: "0/5", ok: false }, { label: "Available mining cap", val: "$0/$200", ok: false }], pending: 2 },
        { key: "monthly", title: "Monthly Owner Club Reward", period: "Current on-chain month · ID 1", balance: stats?.pools?.monthly_usdt || 0, achievers: meta.monthly?.qualified_ids || 0, pending: 8, reqs: [
          { label: "Active membership", val: "Not active", ok: false },
          { label: "Active directs (min $50)", val: "0/10", ok: false },
          { label: "Direct business", val: "$0/$2,000", ok: false },
          { label: "Left qualified IDs", val: "0/25", ok: false },
          { label: "Right qualified IDs", val: "0/25", ok: false },
          { label: "Left matching carry", val: "$0/$5,000", ok: false },
          { label: "Right matching carry", val: "$0/$5,000", ok: false },
          { label: "On-chain qualification", val: "Pending", ok: false },
        ] },
      ];

  const POOL_CAT = { daily: 2, weekly: 3, monthly: 4 };
  return (
    <div data-testid="pools-page" className="flex flex-col gap-4 px-4 pt-4 pb-4">
      <SectionLabel center>Reward Pools</SectionLabel>
      {pools.map((p) => (
        <PoolCard
          key={p.key}
          p={{ ...p, category: POOL_CAT[p.key] }}
          busy={claiming === p.key}
          now={now}
          onClaim={doClaim}
          onInfo={(pool) => setModal({ type: "info", pool })}
          onHistory={(pool) => setModal({ type: "history", pool })}
        />
      ))}

      {modal && createPortal(
        <div data-testid="pool-modal" className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/75 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="max-h-[80vh] w-full max-w-[380px] overflow-y-auto rounded-3xl border border-[#3C6B33]/60 bg-[#0A1710] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold grad-title">
                {modal.pool.title} · {modal.type === "info" ? "Rules" : "History"}
              </h3>
              <button data-testid="pool-modal-close" onClick={() => setModal(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/60">
                <X size={16} />
              </button>
            </div>
            {modal.type === "info" ? (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[#3C6B33]/50 p-3">
                    <div className="text-[10px] uppercase text-white/45">Pool Balance</div>
                    <div className="text-lg font-bold text-white">${usd2(modal.pool.balance)}</div>
                  </div>
                  <div className="rounded-xl border border-[#3C6B33]/50 p-3">
                    <div className="text-[10px] uppercase text-white/45">Your Est. Reward</div>
                    <div className="text-lg font-bold text-[#D6C51E]">${usd2(modal.pool.estimate != null ? modal.pool.estimate : modal.pool.balance / (modal.pool.achievers + 1))}</div>
                  </div>
                </div>
                <div className="mb-3 flex items-center justify-between rounded-xl border border-[#3C6B33]/50 p-3">
                  <span className="text-xs text-white/60">On-chain qualified users</span>
                  <span data-testid="pool-modal-achievers" className="text-sm font-bold text-[#34D07A]">{modal.pool.achievers}</span>
                </div>
                <div className="mb-3 flex items-center justify-between rounded-xl border border-[#3C6B33]/50 p-3">
                  <span className="text-xs text-white/60">Are you qualified?</span>
                  {(modal.pool.reqs ? modal.pool.reqs.every((r) => r.ok) : (modal.pool.directsHave >= modal.pool.directsNeed && modal.pool.capHave >= modal.pool.capNeed)) ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-[#34D07A]"><CheckCircle2 size={14} /> Qualified</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-red-400"><XCircle size={14} /> Not qualified</span>
                  )}
                </div>
                {/* Live per-requirement checklist for THIS pool */}
                <div className="mb-3 rounded-xl border border-[#3C6B33]/50 p-3">
                  {(modal.pool.reqs || []).map((r) => (
                    <div key={r.label} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-white/60">{r.label}</span>
                      <span className={`flex items-center gap-1.5 font-semibold ${r.ok ? "text-[#34D07A]" : "text-red-400"}`}>
                        {r.val} {r.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      </span>
                    </div>
                  ))}
                </div>
                <ul className="space-y-2 text-xs text-white/70">
                  <li>• Share = pool balance split equally among all on-chain achievers.</li>
                  {modal.pool.key === "monthly" ? (
                    <li>• Funded by a <b className="text-[#D6C51E]">10%</b> deduction from all Direct, Level, Daily &amp; Weekly rewards across the network.</li>
                  ) : (
                    <li>• A <b className="text-[#D6C51E]">10%</b> deduction funds the Monthly Owner Club pool — you receive the net <b className="text-[#34D07A]">90%</b>.</li>
                  )}
                  <li>• Reward is bought as TTN at the live PancakeSwap rate into your wallet.</li>
                  <li>• Claiming <b className="text-[#34D07A]">does NOT reduce</b> your mining cap — the cap only reduces when you SELL TTN for USDT.</li>
                  <li>• Estimate is live; final amount locks when the pool closes at 00:00 UTC.</li>
                </ul>
              </>
            ) : (
              <div className="py-6 text-center text-xs text-white/45">
                No confirmed {modal.pool.title.toLowerCase()} claims found for this wallet.
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
