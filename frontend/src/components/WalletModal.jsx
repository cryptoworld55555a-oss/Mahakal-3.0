import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, QrCode, FlaskConical } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { hasWalletConnect } from "@/config";

const options = [
  {
    id: "walletconnect",
    label: "WalletConnect",
    desc: "Scan with any mobile wallet",
    icon: QrCode,
    accent: "cyan",
  },
  {
    id: "injected",
    label: "MetaMask / Browser",
    desc: "Use an injected wallet",
    icon: Wallet,
    accent: "purple",
  },
  {
    id: "demo",
    label: "Demo Wallet (Testnet)",
    desc: "Try the app instantly — no extension",
    icon: FlaskConical,
    accent: "gold",
  },
];

const accentMap = {
  cyan: "text-[#00E5FF] border-[#00E5FF]/30 bg-[#00E5FF]/10",
  purple: "text-[#9D4EDD] border-[#9D4EDD]/30 bg-[#9D4EDD]/10",
  gold: "text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10",
};

export default function WalletModal({ open, onClose }) {
  const { connect, connecting } = useWallet();

  const handle = async (id) => {
    const ok = await connect(id);
    if (ok) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="wallet-modal-overlay"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            data-testid="wallet-modal"
            className="w-full max-w-[430px] rounded-t-3xl border-t border-white/10 bg-[#0A0D1C] p-5 pb-8"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Connect Wallet</h3>
              <button
                data-testid="wallet-modal-close"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/60 active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {options.map((opt) => {
                const disabled =
                  connecting || (opt.id === "walletconnect" && !hasWalletConnect);
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    data-testid={`connect-${opt.id}-btn`}
                    disabled={disabled}
                    onClick={() => handle(opt.id)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] disabled:opacity-40 ${accentMap[opt.accent]}`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/30">
                      <Icon size={22} />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[15px] font-semibold text-white">
                        {opt.label}
                      </span>
                      <span className="text-xs text-white/50">
                        {opt.id === "walletconnect" && !hasWalletConnect
                          ? "Add a Project ID to enable"
                          : opt.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {connecting && (
              <p className="mt-4 text-center text-sm text-[#00E5FF]" data-testid="wallet-connecting">
                Requesting signature…
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
