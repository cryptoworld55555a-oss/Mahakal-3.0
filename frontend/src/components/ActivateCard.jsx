import React, { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, Loader2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { toast } from "sonner";

const QUICK = [10, 50, 100];

export default function ActivateCard({ min = 10, onActivated }) {
  const { activateId } = useWallet();
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const val = Number(amount);
    if (!val || val < min) {
      toast.error(`Minimum activation is $${min} USDT`);
      return;
    }
    setBusy(true);
    try {
      await activateId(val);
      onActivated?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Activation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      data-testid="activate-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-[#00E5FF]/25 bg-gradient-to-br from-[#0F1326] to-[#0A0D1C] p-5 shadow-[0_8px_32px_rgba(0,229,255,0.08)]"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[#00E5FF]/15 blur-2xl" />
      <div className="mb-1 flex items-center gap-2">
        <Rocket size={16} className="text-[#00E5FF]" />
        <span className="text-sm font-semibold text-white">Activate Your ID</span>
      </div>
      <p className="mb-4 text-xs text-white/50">
        Deposit USDT to activate (min ${min}, no upper cap).
      </p>

      <div className="mb-3 flex gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            data-testid={`activate-quick-${q}`}
            onClick={() => setAmount(String(q))}
            className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-all active:scale-95 ${
              Number(amount) === q
                ? "border-[#00E5FF]/40 bg-[#00E5FF]/10 text-[#00E5FF]"
                : "border-white/10 bg-white/5 text-white/60"
            }`}
          >
            ${q}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center rounded-xl border border-white/10 bg-black/30 px-4">
        <span className="text-sm text-white/40">$</span>
        <input
          data-testid="activation-amount-input"
          type="number"
          inputMode="decimal"
          min={min}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent py-3 pl-1 text-base font-semibold text-white outline-none placeholder:text-white/30"
          placeholder="10"
        />
        <span className="text-xs font-semibold text-white/40">USDT</span>
      </div>

      <button
        data-testid="activate-submit-btn"
        disabled={busy}
        onClick={submit}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#22d3ee] font-bold text-[#050711] transition-all active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : "Activate Now"}
      </button>
    </motion.div>
  );
}
