import React from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

// Classy branded success popup (green/gold TITAN theme) used across every
// successful on-chain action: registration, stake, claim, pool claim, sell, renew.
export function notifySuccess(title, description) {
  toast.custom(
    () => (
      <div className="flex w-[340px] max-w-[86vw] items-center gap-3 rounded-2xl border border-[#0AA84F]/45 bg-gradient-to-br from-[#0E1C10] to-[#060F09] px-4 py-3 shadow-[0_10px_40px_rgba(10,168,79,0.28)] backdrop-blur">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0AA84F]/20 text-[#34D07A] ring-1 ring-[#0AA84F]/40">
          <CheckCircle2 size={22} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">{title}</div>
          {description && <div className="truncate text-xs text-white/60">{description}</div>}
        </div>
      </div>
    ),
    { duration: 4000 }
  );
}
