import React from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

export default function ReferralCard({ me }) {
  const code = me?.referral_code;
  const link = code ? `${window.location.origin}/join?ref=${code}` : "";

  const copy = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    toast.success("Referral link copied");
  };

  return (
    <div data-testid="referral-card" className="card-glow flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0AA84F]/15 text-[#34D07A]">
        <Link2 size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="section-label">Referral Link</div>
        <div data-testid="referral-link" className="truncate text-xs text-white/70">
          {link || "Connect wallet to get your link"}
        </div>
      </div>
      <button
        data-testid="referral-copy-btn"
        onClick={copy}
        disabled={!link}
        className="rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] px-4 py-2 text-sm font-bold text-black active:scale-95 disabled:opacity-40"
      >
        Copy
      </button>
    </div>
  );
}
