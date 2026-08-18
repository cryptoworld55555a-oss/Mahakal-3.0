import React, { useCallback, useEffect, useState } from "react";
import { getDashboardStats, getMe } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import ActivateCard from "@/components/ActivateCard";
import WelcomeStatus from "@/components/WelcomeStatus";
import ReferralCard from "@/components/ReferralCard";
import GlobalBusiness from "@/components/GlobalBusiness";
import MyBusiness from "@/components/MyBusiness";
import TeamReward from "@/components/TeamReward";
import RecentActivity from "@/components/RecentActivity";
import TopHolders from "@/components/TopHolders";

export default function Dashboard() {
  const { isConnected, address, user } = useWallet();
  const [stats, setStats] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    getDashboardStats()
      .then((d) => {
        setStats(d);
        setError(false);
      })
      .catch(() => setError(true));
    if (address) {
      getMe(address).then(setMe).catch(() => setMe(null));
    } else {
      setMe(null);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load, user?.is_active]);

  if (error) {
    return (
      <div data-testid="dashboard-error" className="px-4 py-10 text-center text-sm text-white/50">
        Unable to load protocol data. Please retry.
      </div>
    );
  }

  const showActivate = isConnected && user && !user.is_active;

  return (
    <div data-testid="dashboard" className="flex flex-col gap-4 px-4 pt-4">
      {showActivate && <ActivateCard min={stats?.min_activation_usdt || 10} onActivated={load} />}

      <WelcomeStatus stats={stats} me={me} />
      <ReferralCard me={me} />
      <GlobalBusiness stats={stats} me={me} />
      <MyBusiness me={me} />
      <TeamReward me={me} />
      <RecentActivity me={me} />
      <TopHolders />
    </div>
  );
}
