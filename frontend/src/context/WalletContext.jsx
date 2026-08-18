import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getNonce, verifySignature, getUser, activateId as activateIdApi } from "@/lib/api";
import {
  buildSiweMessage,
  getInjectedSigner,
  getWalletConnectSigner,
  getDemoSigner,
} from "@/lib/wallet";

const WalletContext = createContext(null);
export const useWallet = () => useContext(WalletContext);

const STORAGE_KEY = "titan_wallet_address";

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [user, setUser] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // Restore a previous session (wallet-based, no JWT — just re-read the user).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    getUser(saved)
      .then((u) => {
        setAddress(saved);
        setUser(u);
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY));
  }, []);

  const authenticate = useCallback(async (signer) => {
    const addr = (await signer.getAddress()).toLowerCase();
    const { nonce } = await getNonce(addr);
    const message = buildSiweMessage(addr, nonce);
    const signature = await signer.signMessage(message);
    const verifiedUser = await verifySignature({ address: addr, signature, message });
    setAddress(addr);
    setUser(verifiedUser);
    localStorage.setItem(STORAGE_KEY, addr);
    toast.success(`Connected · ${verifiedUser.uid}`);
    return verifiedUser;
  }, []);

  const connect = useCallback(
    async (method) => {
      setConnecting(true);
      try {
        let signer;
        if (method === "injected") signer = await getInjectedSigner();
        else if (method === "walletconnect") signer = await getWalletConnectSigner();
        else signer = getDemoSigner();
        await authenticate(signer);
        return true;
      } catch (e) {
        const msg = e?.response?.data?.detail || e?.message || "Connection failed";
        toast.error(msg);
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [authenticate]
  );

  const disconnect = useCallback(() => {
    setAddress(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    toast("Wallet disconnected");
  }, []);

  const activateId = useCallback(
    async (amount) => {
      const updated = await activateIdApi({ address, amount });
      setUser(updated);
      toast.success(`ID Activated · ${updated.uid}`);
      return updated;
    },
    [address]
  );

  const value = {
    address,
    user,
    connecting,
    isConnected: Boolean(address),
    connect,
    disconnect,
    activateId,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
