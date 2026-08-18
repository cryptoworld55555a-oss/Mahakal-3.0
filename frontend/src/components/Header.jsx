import React, { useState } from "react";
import { Zap, LogOut } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import WalletModal from "@/components/WalletModal";

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Header() {
  const { isConnected, address, user, disconnect } = useWallet();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex flex-col gap-4 px-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/20 to-transparent">
              <Zap size={20} className="text-[#D4AF37]" />
            </div>
            <div className="leading-tight">
              <h1
                data-testid="app-title"
                className="bg-gradient-to-r from-[#D4AF37] to-[#FFDF73] bg-clip-text text-xl font-extrabold tracking-tight text-transparent"
                style={{ fontFamily: "Unbounded, Inter, sans-serif" }}
              >
                TITAN
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                TTN · BNB Chain
              </span>
            </div>
          </div>

          {isConnected ? (
            <button
              data-testid="wallet-address-btn"
              onClick={disconnect}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 active:scale-95"
            >
              {short(address)}
              <LogOut size={14} className="text-white/40" />
            </button>
          ) : (
            <button
              data-testid="wallet-connect-btn"
              onClick={() => setOpen(true)}
              className="flex h-11 items-center gap-2 rounded-xl border border-[#00E5FF]/30 bg-[#00E5FF]/10 px-4 text-sm font-semibold text-[#00E5FF] active:scale-95 transition-all"
            >
              Connect Wallet
            </button>
          )}
        </div>

        {isConnected && (
          <div
            data-testid="uid-status-row"
            className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0A0D1C] px-4 py-3"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                Your UID
              </span>
              <span data-testid="user-uid" className="text-sm font-bold text-white">
                {user?.uid || "—"}
              </span>
            </div>
            {user?.is_active ? (
              <span
                data-testid="activation-status"
                className="flex items-center gap-1.5 rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 px-3 py-1.5 text-xs font-semibold text-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.2)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF]" /> Active
              </span>
            ) : (
              <span
                data-testid="activation-status"
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/50"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" /> Inactive
              </span>
            )}
          </div>
        )}
      </header>

      <WalletModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
