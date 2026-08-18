import React, { useState, useRef, useEffect } from "react";
import { Bell, Menu, Copy, LogOut, Check } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/context/WalletContext";
import { LOGO_URL } from "@/config";
import WalletModal from "@/components/WalletModal";

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Header() {
  const { isConnected, address, user, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const copyAddr = () => {
    if (!address) return;
    navigator.clipboard?.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <header className="flex flex-col gap-4 px-4 pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-11 w-11 overflow-hidden rounded-full ring-1 ring-[#2F6BFF]/50 shadow-[0_0_14px_rgba(47,107,255,0.35)]">
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
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4F8DFF]">
                DeFi Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <button
                data-testid="wallet-address-btn"
                onClick={copyAddr}
                className="flex items-center gap-2 rounded-full border border-[#2F6BFF]/30 bg-[#2F6BFF]/10 px-3 py-2 text-xs font-semibold text-white/90 active:scale-95"
              >
                {short(address)}
                {copied ? (
                  <Check size={14} className="text-[#4F8DFF]" />
                ) : (
                  <Copy size={14} className="text-[#4F8DFF]" />
                )}
              </button>
            ) : (
              <button
                data-testid="wallet-connect-btn"
                onClick={() => setOpen(true)}
                className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-[#2F6BFF]/40 bg-[#2F6BFF]/15 px-3.5 text-sm font-semibold text-[#4F8DFF] active:scale-95 transition-all"
              >
                Connect
              </button>
            )}

            {isConnected && (
              <button
                data-testid="header-bell"
                onClick={() => toast("No new notifications")}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 active:scale-95"
              >
                <Bell size={18} />
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#4F8DFF]" />
              </button>
            )}

            <div className="relative" ref={menuRef}>
              <button
                data-testid="header-menu"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 active:scale-95"
              >
                <Menu size={18} />
              </button>
              {menuOpen && (
                <div
                  data-testid="header-menu-dropdown"
                  className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0A1120] shadow-xl"
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
            className="flex items-center justify-between rounded-2xl border border-[#2E4E86]/50 bg-[#0A1120] px-4 py-3"
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
                className="flex items-center gap-1.5 rounded-full border border-[#2F6BFF]/40 bg-[#2F6BFF]/15 px-3 py-1.5 text-xs font-semibold text-[#4F8DFF] shadow-[0_0_10px_rgba(47,107,255,0.25)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#4F8DFF]" /> Active
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
