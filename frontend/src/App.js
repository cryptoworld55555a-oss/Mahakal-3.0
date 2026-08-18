import { useState } from "react";
import "@/App.css";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import BottomNav from "@/components/BottomNav";
import ComingSoon from "@/components/ComingSoon";

const modules = {
  stake: { title: "Stake", module: "Staking" },
  pools: { title: "Pools", module: "Pool distribution" },
  mining: { title: "Mining", module: "Mining & Claim" },
  team: { title: "My Team", module: "Referral & Team" },
};

function App() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col overflow-x-hidden bg-[#05080F] pb-24 text-white shadow-2xl">
      {/* Ambient blue glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-80 -translate-x-1/2 rounded-full bg-[#2F6BFF]/20 blur-[110px]" />
      <div className="pointer-events-none absolute right-0 top-32 h-40 w-40 rounded-full bg-[#1E40AF]/25 blur-[90px]" />

      <div className="relative z-10 flex flex-1 flex-col">
        <Header />
        {tab === "dashboard" ? (
          <Dashboard />
        ) : (
          <ComingSoon title={modules[tab].title} module={modules[tab].module} />
        )}
      </div>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

export default App;
