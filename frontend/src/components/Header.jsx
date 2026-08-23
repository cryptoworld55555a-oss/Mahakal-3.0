import React, { useState, useRef, useEffect } from "react";
import { Bell, Menu, Copy, LogOut, Check, ShieldCheck, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/context/WalletContext";
import { LOGO_URL, ONCHAIN } from "@/config";
import { copyText } from "@/lib/clipboard";
import WalletModal from "@/components/WalletModal";

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Header() {
  const { isConnected, address, user, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const copyAddr = async () => {
    if (!address) return;
    const ok = await copyText(address);
    if (ok) {
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Copy failed");
    }
  };

  return (
    <>
      <header className="flex flex-col gap-4 px-4 pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-[#0AA84F]/50 shadow-[0_0_14px_rgba(10,168,79,0.35)]">
              <img src={LOGO_URL} alt="TITAN" className="h-full w-full object-cover" />
            </div>
            <div className="leading-tight">
              <h1
                data-testid="app-title"
                className="text-xl font-extrabold tracking-tight text-white"
                style={{ fontFamily: "Unbounded, Inter, sans-serif" }}
              >
                TITAN
              </h1>
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-[#34D07A]">
                DeFi Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <button
                data-testid="wallet-address-btn"
                onClick={copyAddr}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#0AA84F]/30 bg-[#0AA84F]/10 px-2.5 py-2 text-[11px] font-semibold text-white/90 active:scale-95"
              >
                {short(address)}
                {copied ? (
                  <Check size={14} className="text-[#34D07A]" />
                ) : (
                  <Copy size={14} className="text-[#34D07A]" />
                )}
              </button>
            ) : (
              <button
                data-testid="wallet-connect-btn"
                onClick={() => setOpen(true)}
                className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] px-4 text-sm font-bold text-black active:scale-95 transition-all shadow-[0_0_16px_rgba(10,168,79,0.45)]"
              >
                Connect
              </button>
            )}

            {isConnected && <Bell className="hidden" aria-hidden="true" />}

            <div className="relative" ref={menuRef}>
              <button
                data-testid="header-menu"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 active:scale-95"
              >
                <Menu size={18} />
              </button>
              {menuOpen && (
                <div
                  data-testid="header-menu-dropdown"
                  className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0A1710] shadow-xl"
                >
                  {isConnected ? (
                    <>
                      <button
                        data-testid="menu-copy"
                        onClick={() => {
                          copyAddr();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/80 hover:bg-white/5"
                      >
                        <Copy size={15} /> Copy address
                      </button>
                      <button
                        data-testid="menu-onchain-withdraw"
                        onClick={() => {
                          setWithdrawOpen(true);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[#34D07A] hover:bg-white/5"
                      >
                        <ShieldCheck size={15} /> On-chain Withdrawal
                      </button>
                      <button
                        data-testid="menu-disconnect"
                        onClick={() => {
                          disconnect();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-white/5"
                      >
                        <LogOut size={15} /> Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      data-testid="menu-connect"
                      onClick={() => {
                        setOpen(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/80 hover:bg-white/5"
                    >
                      Connect Wallet
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {isConnected && (
          <div
            data-testid="uid-status-row"
            className="flex items-center justify-between rounded-2xl border border-[#3C6B33]/50 bg-[#0A1710] px-4 py-3"
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
                className="flex items-center gap-1.5 rounded-full border border-[#0AA84F]/40 bg-[#0AA84F]/15 px-3 py-1.5 text-xs font-semibold text-[#34D07A] shadow-[0_0_10px_rgba(10,168,79,0.25)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#34D07A]" /> Active
              </span>
            ) : (
              <span
                data-testid="activation-status"
                className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Inactive
              </span>
            )}
          </div>
        )}
      </header>

      <WalletModal open={open} onClose={() => setOpen(false)} />

      {withdrawOpen && (
        <div
          data-testid="onchain-withdraw-modal"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setWithdrawOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#3C6B33]/60 bg-[#0A1710] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-bold grad-title">
                <ShieldCheck size={18} className="text-[#34D07A]" /> On-chain Withdrawal
              </span>
              <button data-testid="onchain-withdraw-close" onClick={() => setWithdrawOpen(false)} className="text-white/50 active:scale-95">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-white/60">
              Your funds are always yours. Even if this website ever goes offline, you can withdraw <b className="text-[#34D07A]">100% on-chain</b> — sell your TTN for <b className="text-[#D6C51E]">USDT</b> (or buy) directly from the smart contract, anytime, with zero worries. Just save these details:
            </p>
            {[
              { label: "Network", value: ONCHAIN.chainName },
              { label: "Chain ID", value: String(ONCHAIN.chainId) },
              { label: "RPC URL", value: ONCHAIN.rpc },
              { label: "Protocol Contract", value: ONCHAIN.protocol },
              { label: "TTN Token", value: ONCHAIN.token },
            ].map((r) => (
              <div key={r.label} className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase text-white/40">{r.label}</div>
                  <div className="truncate font-mono text-xs text-white/80">{r.value}</div>
                </div>
                <button
                  data-testid={`onchain-copy-${r.label}`}
                  onClick={() => copyText(r.value).then(() => toast.success(`${r.label} copied`))}
                  className="shrink-0 text-[#D6C51E] active:scale-90"
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
            <a
              data-testid="onchain-bscscan-link"
              href={`${ONCHAIN.explorer}/address/${ONCHAIN.protocol}#writeContract`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0AA84F] to-[#D6C51E] py-3 text-sm font-bold text-black active:scale-[0.98]"
            >
              Open on BSCScan (Write Contract) <ExternalLink size={15} />
            </a>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#0AA84F]/40 bg-[#0AA84F]/10 px-3 py-2.5">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#34D07A]" />
              <p className="text-[11px] leading-relaxed text-white/70">
                <b className="text-[#34D07A]">Fully secured &amp; non-custodial.</b> Your assets live on BNB Smart Chain, protected by audited smart contracts — no one can freeze, block or touch your on-chain withdrawal. You are always in control.
              </p>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-white/45">
              <b className="text-white/70">How to withdraw:</b> Open BSCScan → Connect your wallet → choose the <b className="text-[#D6C51E]">sell</b> (or buy) function → enter your amount → Confirm. Your withdrawal settles instantly on-chain.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
