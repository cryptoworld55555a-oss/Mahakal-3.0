import React, { useEffect, useState, useCallback } from "react";
import { Pickaxe, AlertCircle, Database, History, RefreshCw, Loader2 } from "lucide-react";
import SectionLabel from "@/components/SectionLabel";
import { useWallet } from "@/context/WalletContext";
import { toast } from "sonner";
import { getAccount, claimAllRewards, renewOnChain, sellOnChain } from "@/lib/chain";
import { notifySuccess } from "@/lib/notify";
import { getRewardUser } from "@/lib/api";

const usd4 = (n) => Number(n || 0).toFixed(4);
const usd2 = (n) => Number(n || 0).toFixed(2);
const fromWei = (n) => Number(n || 0) / 1e18;

function Gauge({ pct = 0 }) {
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circ = Math.PI * r; // semicircle length
  const dash = (pct / 100) * circ;
  return (
    <div className="relative mx-auto h-[100px] w-[160px]">
      <svg viewBox="0 0 160 90" className="h-full w-full">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(60,107,51,0.35)" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#34D07A" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <div className="text-3xl font-extrabold text-white">{pct.toFixed(1)}%</div>
        <div className="text-xs text-white/45">utilized</div>
      </div>
    </div>
  );
}

function Stat({ label, value, gold }) {
  return (
    <div className="card-glow p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className={`text-lg font-bold ${gold ? "text-[#D6C51E]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function SellCard({ address, onSold }) {
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const sell = async () => {
    const v = Number(amt);
    if (!v || v <= 0) return toast.error("Enter TTN amount to sell");
    setBusy(true);
    try {
      await sellOnChain(v, address);
      notifySuccess("Sell Successful", `${v} TTN → USDT received in your wallet`);
      setAmt("");
      onSold?.();
    } catch (e) {
      toast.error(e?.shortMessage || e?.message || "Sell failed");
    } finally { setBusy(false); }
  };
  return (
    <div data-testid="sell-card" className="card-glow p-5">
      <div className="mb-1 flex items-center gap-2">
        <Database size={16} className="text-[#34D07A]" />
        <span className="text-base font-bold grad-title">Sell TTN → USDT</span>
      </div>
      <p className="mb-3 text-xs text-white/50">Sells at live PancakeSwap price. Cap reduces by the USDT you receive.</p>
      <div className="mb-3 flex items-center rounded-xl border border-white/10 bg-black/30 px-4">
        <input data-testid="sell-amount-input" type="number" inputMode="decimal" value={amt}
          onChange={(e) => setAmt(e.target.value)} placeholder="0.0"
          className="w-full bg-transparent py-3 pl-1 text-base font-semibold text-white outline-none placeholder:text-white/30" />
        <span className="text-xs font-semibold text-white/40">TTN</span>
      </div>
      <button data-testid="sell-submit-btn" disabled={busy} onClick={sell}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D6C51E] to-[#FFA000] font-bold text-black active:scale-[0.98] disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : "Sell TTN"}
      </button>
    </div>
  );
}

export default function MiningPage() {
  const { me, user, address } = useWallet();
  const [reward, setReward] = useState(0);
  const [cap, setCap] = useState(0);
  const [staked, setStaked] = useState(0);
  const [renewalDue, setRenewalDue] = useState(false);
  const [busy, setBusy] = useState("");
  const canMine = reward >= 1;
  const usedCap = Math.max(0, staked * 2 - cap); // 200% basis (display)
  const capPct = staked > 0 ? Math.min(100, (usedCap / (staked * 2)) * 100) : 0;

  const load = useCallback(async () => {
    if (!address) return;
    try {
      const acc = await getAccount(address);
      setCap(fromWei(acc.miningCap));
      setStaked(fromWei(acc.totalStaked));
      setRenewalDue(acc.renewalDue);
    } catch (e) { /* wallet not connected on-chain */ }
    try {
      const r = await getRewardUser(address);
      setReward(r?.breakdown?.total_claimable_usd || 0);
    } catch (e) { setReward(0); }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const doClaim = async () => {
    setBusy("claim");
    try {
      const hashes = await claimAllRewards(address);
      const labels = hashes.map((h) => h.label).join(", ");
      notifySuccess("Claim Successful", `${labels} · TTN in your wallet`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.shortMessage || e?.message || "Claim failed");
    } finally { setBusy(""); }
  };

  const doRenew = async () => {
    setBusy("renew");
    try {
      await renewOnChain(address);
      notifySuccess("Renewal Successful", "ID renewed for another 200 days ($10)");
      await load();
    } catch (e) {
      toast.error(e?.shortMessage || e?.message || "Renew failed");
    } finally { setBusy(""); }
  };

  return (
    <div data-testid="mining-page" className="flex flex-col gap-4 px-4 pt-4 pb-4">
      <SectionLabel center>Mining &amp; Rewards</SectionLabel>

      {renewalDue && (
        <div data-testid="renew-banner" className="card-glow flex items-center justify-between border border-[#D6C51E]/40 bg-[#D6C51E]/10 p-4">
          <div className="flex items-center gap-2 text-sm text-white">
            <AlertCircle size={16} className="text-[#D6C51E]" /> Your ID renewal is due (200 days)
          </div>
          <button data-testid="renew-btn" onClick={doRenew} disabled={busy === "renew"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0AA84F] to-[#D6C51E] px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
            {busy === "renew" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Renew $10
          </button>
        </div>
      )}

      {/* Claim mining reward */}
      <div data-testid="claim-reward-card" className="card-glow p-5">
        <div className="mb-3 flex items-center gap-2">
          <Pickaxe size={16} className="text-[#34D07A]" />
          <span className="text-base font-bold grad-title">Claim Mining Reward</span>
        </div>
        <div className="rounded-xl border border-[#3C6B33]/50 bg-black/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-[#34D07A]">Generated Mining Reward</span>
            <AlertCircle size={16} className="text-[#D6C51E]" />
          </div>
          <div data-testid="generated-reward" className="mt-1 text-3xl font-extrabold text-white">
            ${usd4(reward)} <span className="text-sm text-white/40">USDT</span>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#D6C51E]/30 bg-[#D6C51E]/8 p-3 text-xs text-white/70">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-[#D6C51E]" />
          Claim buys TTN at live PancakeSwap price into your wallet. Minimum $1. Currently: ${usd4(reward)}.
        </div>
        <button
          data-testid="mine-claim-btn"
          disabled={!canMine || busy === "claim"}
          onClick={doClaim}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] font-bold text-black active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#3C6B33]/30 disabled:text-white/50"
        >
          {busy === "claim" ? <Loader2 size={16} className="animate-spin" /> : <Pickaxe size={16} />}
          {canMine ? "Claim Reward" : "Mining Not Available"}
        </button>
      </div>

      {/* Mining cap utilization */}
      <div data-testid="cap-utilization-card" className="card-glow p-5">
        <div className="text-base font-bold grad-title">Mining Cap Utilization</div>
        <div className="mb-2 text-xs text-white/50">Based on ${usd2(staked)} Stake · reduces on sell</div>
        <Gauge pct={capPct} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#3C6B33]/50 p-3 text-center">
            <div className="text-xs text-white/50">Used Cap</div>
            <div data-testid="used-cap" className="text-lg font-bold text-white">${usd2(usedCap)}</div>
          </div>
          <div className="rounded-xl border border-[#3C6B33]/50 p-3 text-center">
            <div className="text-xs text-white/50">Remaining Cap</div>
            <div data-testid="remaining-cap" className="text-lg font-bold text-[#D6C51E]">${usd2(cap)}</div>
          </div>
        </div>
      </div>

      {/* Sell TTN -> USDT (reduces cap by actual USDT received) */}
      <SellCard address={address} onSold={load} />

      {/* On-chain reward accounting */}
      <div data-testid="reward-accounting-card">
        <div className="mb-2 flex items-center gap-2">
          <Database size={16} className="text-[#34D07A]" />
          <span className="text-base font-bold grad-title">On-chain Reward Accounting</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="TTN Holding" value={`${usd2(me?.holding?.ttn)} TTN`} />
          <Stat label="Mined Value" value="$0.00" />
          <Stat label="Appreciation Value" value="$0.00" gold />
          <Stat label="Loss Restored" value="$0.00" />
        </div>
      </div>

      {/* Mining claim history */}
      <div data-testid="mining-history" className="card-glow p-5">
        <div className="mb-1 flex items-center gap-2">
          <History size={16} className="text-[#34D07A]" />
          <span className="text-base font-bold grad-title">Mining Claim History</span>
        </div>
        <p className="mb-3 text-xs text-[#34D07A]">0 confirmed mining claims</p>
        <div className="grid grid-cols-3 gap-2 border-t border-white/5 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#D6C51E]">
          <span>Date</span>
          <span className="text-center">Reward</span>
          <span className="text-right">Tx</span>
        </div>
        <div className="border-t border-white/5 py-6 text-center text-xs text-white/45">
          No confirmed mining claims found for this wallet.
        </div>
      </div>
    </div>
  );
}
