import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Shield, Users, Coins, Trophy, RefreshCw, Play, Pause, Search,
  Ban, CheckCircle2, UploadCloud, Crown, Copy, Loader2,
} from "lucide-react";
import {
  adminOverview, adminUsers, buildRewardTree, getRootStatus,
} from "@/lib/api";
import {
  blockUserOnChain, unblockUserOnChain, pauseOnChain, unpauseOnChain,
  postMerkleRootOnChain, setOwnerTierOnChain, blockAllOnChain, unblockAllOnChain,
  setRootPosterOnChain,
} from "@/lib/adminChain";
import { getInjectedSigner } from "@/lib/wallet";
import { ONCHAIN } from "@/config";

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "-");
const usd = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0A1F14]/80 p-5" data-testid={`admin-stat-${label}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
        <Icon size={14} className={accent} /> {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function AdminPanel() {
  const [admin, setAdmin] = useState(null);
  const [ov, setOv] = useState(null);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [newRoot, setNewRoot] = useState(null);
  const [status, setStatus] = useState(null); // {backend_root, onchain_root, in_sync, onchain_set}

  const loadStatus = useCallback(async () => {
    try { setStatus(await getRootStatus()); } catch (e) { /* ignore */ }
  }, []);

  const loadOverview = useCallback(async () => {
    try { setOv(await adminOverview()); } catch (e) { toast.error("Overview load failed"); }
  }, []);

  const loadUsers = useCallback(async (query = "") => {
    try { const d = await adminUsers({ q: query, limit: 50 }); setRows(d.rows); }
    catch (e) { toast.error("Users load failed"); }
  }, []);

  useEffect(() => { loadOverview(); loadUsers(); loadStatus(); }, [loadOverview, loadUsers, loadStatus]);

  const connect = async () => {
    try {
      const signer = await getInjectedSigner();
      setAdmin((await signer.getAddress()).toLowerCase());
      toast.success("Admin wallet connected");
    } catch (e) { toast.error(e.message || "Connect failed"); }
  };

  const run = async (key, fn, ok) => {
    setBusy(key);
    try { const r = await fn(); toast.success(ok || "Done"); return r; }
    catch (e) { toast.error(e?.response?.data?.detail || e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(""); }
  };

  const doBuild = async () => {
    const d = await run("build", buildRewardTree, "Reward engine ran");
    if (d) { setNewRoot(d.root); await loadOverview(); await loadUsers(q); await loadStatus(); }
  };
  const doPostRoot = async () => {
    const root = newRoot || ov?.latest_root;
    if (!root) return toast.error("No root to post. Run engine first.");
    const h = await run("post", () => postMerkleRootOnChain(root), "Root posted on-chain");
    if (h) { toast.success(`tx ${short(h)}`); setTimeout(loadStatus, 4000); }
  };
  // 1-click: rebuild the reward tree AND post the fresh root on-chain so proofs always match.
  const doSync = async () => {
    if (needWallet()) return;
    setBusy("sync");
    try {
      const d = await buildRewardTree();
      const root = d?.root;
      if (!root) throw new Error("Engine produced no root");
      setNewRoot(root);
      const h = await postMerkleRootOnChain(root);
      toast.success(`Rewards synced on-chain · tx ${short(h)}`);
      await loadOverview(); await loadUsers(q);
      setTimeout(loadStatus, 4000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.shortMessage || e?.message || "Sync failed");
    } finally { setBusy(""); }
  };
  // One-time: authorize the backend hot wallet as rootPoster so roots post AUTOMATICALLY.
  const doAuthorize = async () => {
    if (needWallet()) return;
    const addr = status?.auto_poster;
    if (!addr) return toast.error("No auto-poster configured. Add BSC_ROOT_POSTER_PK on the server first.");
    setBusy("authorize");
    try {
      const h = await setRootPosterOnChain(addr);
      toast.success(`Auto-poster authorized · tx ${short(h)}`);
      setTimeout(loadStatus, 4000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.shortMessage || e?.message || "Authorize failed");
    } finally { setBusy(""); }
  };
  const needWallet = () => { if (!admin) { toast.error("Connect admin wallet first"); return true; } return false; };

  const doBlock = async (a, blocked) => {
    if (needWallet()) return;
    await run(`blk-${a}`, () => (blocked ? unblockUserOnChain(a) : blockUserOnChain(a)),
      blocked ? "User unblocked on-chain" : "User blocked on-chain");
  };
  const doOwner = async (a) => {
    if (needWallet()) return;
    await run(`own-${a}`, () => setOwnerTierOnChain(a, true), "Owner-Club (300%) set on-chain");
  };
  const doPause = async (paused) => {
    if (needWallet()) return;
    await run("pause", () => (paused ? unpauseOnChain() : pauseOnChain()), paused ? "Protocol resumed" : "Protocol paused");
  };
  const doBlockAll = async (unblock) => {
    if (needWallet()) return;
    const msg = unblock
      ? "Unblock ALL users? This resumes activate/claim/sell for everyone."
      : "BLOCK ALL users at once? This instantly stops activate/claim/sell for every user (on-chain emergency pause).";
    if (!window.confirm(msg)) return;
    await run("blockall", () => (unblock ? unblockAllOnChain() : blockAllOnChain()),
      unblock ? "All users unblocked" : "All users blocked (protocol paused)");
    await loadOverview();
  };

  return (
    <div className="min-h-screen w-full bg-[#04110A] text-white">
      <div className="mx-auto max-w-6xl px-5 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0AA84F] to-[#FFA000]">
              <Shield size={22} className="text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">TITAN Admin</h1>
              <p className="text-xs text-white/50">Reward engine · security · Merkle roots · BSC Mainnet</p>
            </div>
          </div>
          <button
            data-testid="admin-connect-btn"
            onClick={connect}
            className="rounded-full border border-[#0AA84F]/40 bg-[#0AA84F]/15 px-5 py-2.5 text-sm font-semibold text-[#7CF3A0] transition hover:bg-[#0AA84F]/25"
          >
            {admin ? `Owner · ${short(admin)}` : "Connect Admin Wallet"}
          </button>
        </div>

        {/* Overview */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Users} label="Users" value={ov?.user_count ?? "—"} accent="text-[#7CF3A0]" />
          <Stat icon={CheckCircle2} label="Active" value={ov?.active_count ?? "—"} accent="text-[#7CF3A0]" />
          <Stat icon={Crown} label="Owner Club" value={ov?.owner_club_count ?? "—"} accent="text-[#FFC24B]" />
          <Stat icon={Coins} label="Total Staked" value={ov ? usd(ov.total_staked_usd) : "—"} accent="text-[#FFC24B]" />
        </div>

        {/* Reward engine + global controls */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0A1F14]/80 p-5 lg:col-span-2">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Trophy size={16} className="text-[#FFC24B]" /> Reward Engine
            </div>
            <p className="mt-1 text-xs text-white/50">
              Walk the referral + binary tree, compute every user's cumulative rewards, build a Merkle root,
              then post it on-chain. Users claim their own leaf.
            </p>

            {/* Sync status: claims ONLY work when the on-chain root matches the backend root. */}
            <div data-testid="admin-sync-status" className={`mt-3 flex items-center justify-between rounded-xl border p-3 text-xs ${status?.in_sync ? "border-[#0AA84F]/40 bg-[#0AA84F]/10" : "border-red-500/40 bg-red-500/10"}`}>
              <span className="font-semibold">
                {status == null ? "Checking on-chain root…"
                  : status.in_sync ? "✅ On-chain root IN SYNC — users can claim"
                  : status.onchain_set ? "⚠️ On-chain root is STALE — click Sync so users can claim"
                  : "⛔ No root posted on-chain yet — click Sync to enable claims"}
              </span>
            </div>

            {/* Auto-poster status: when authorized, roots post AUTOMATICALLY (no manual Sync needed). */}
            <div data-testid="admin-autopost-status" className={`mt-2 rounded-xl border p-3 text-xs ${status?.auto_authorized ? "border-[#0AA84F]/40 bg-[#0AA84F]/10" : "border-[#FFA000]/40 bg-[#FFA000]/10"}`}>
              {status == null ? "Checking auto-poster…"
                : status.auto_authorized ? (
                  <span className="font-semibold text-[#7CF3A0]">🤖 AUTO-POSTING ON — roots post automatically, users just claim. No manual step needed.</span>
                ) : status.auto_enabled ? (
                  <div className="flex flex-col gap-2">
                    <span className="font-semibold text-[#FFC24B]">🤖 Auto-poster ready ({short(status.auto_poster)}) but NOT yet authorized on-chain. Click below once to enable fully-automatic claims.</span>
                    <button data-testid="admin-authorize-btn" onClick={doAuthorize} disabled={busy === "authorize"}
                      className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#FFA000]/25 px-3 py-2 font-bold text-[#FFC24B] disabled:opacity-60">
                      {busy === "authorize" ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Authorize Auto-Poster On-Chain (one-time)
                    </button>
                  </div>
                ) : (
                  <span className="font-semibold text-[#FFC24B]">⚙️ Auto-posting OFF — add BSC_ROOT_POSTER_PK on the server to make claims fully automatic (recommended). Until then, use the Sync button below after each change.</span>
                )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button data-testid="admin-sync-btn" onClick={doSync} disabled={busy === "sync"}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#FFA000] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60">
                {busy === "sync" ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />} Sync Rewards On-Chain (Run + Post)
              </button>
              <button data-testid="admin-run-engine-btn" onClick={doBuild} disabled={busy === "build"}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy === "build" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Run Engine only
              </button>
              <button data-testid="admin-post-root-btn" onClick={doPostRoot} disabled={busy === "post"}
                className="inline-flex items-center gap-2 rounded-xl border border-[#FFA000]/40 bg-[#FFA000]/15 px-4 py-2.5 text-sm font-semibold text-[#FFC24B] disabled:opacity-60">
                {busy === "post" ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />} Post Root only
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/40">
                <span>Latest Merkle Root · {ov?.latest_leaf_count ?? 0} leaves</span>
                {(newRoot || ov?.latest_root) && (
                  <button data-testid="admin-copy-root-btn"
                    onClick={() => { navigator.clipboard.writeText(newRoot || ov.latest_root); toast.success("Root copied"); }}
                    className="inline-flex items-center gap-1 text-[#7CF3A0]"><Copy size={12} /> Copy</button>
                )}
              </div>
              <div data-testid="admin-latest-root" className="mt-1 break-all font-mono text-xs text-white/80">
                {newRoot || ov?.latest_root || "— run the engine to generate a root —"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A1F14]/80 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Shield size={16} className="text-[#7CF3A0]" /> Global Controls
            </div>
            <p className="mt-1 text-xs text-white/50">Block everyone at once, or pause/resume the protocol.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button data-testid="admin-block-all-btn" onClick={() => doBlockAll(false)} disabled={busy === "blockall"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {busy === "blockall" ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />} Block ALL Users
              </button>
              <button data-testid="admin-unblock-all-btn" onClick={() => doBlockAll(true)} disabled={busy === "blockall"}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0AA84F]/40 bg-[#0AA84F]/15 px-4 py-2.5 text-sm font-bold text-[#7CF3A0] disabled:opacity-60">
                <CheckCircle2 size={15} /> Unblock ALL Users
              </button>
              <div className="my-1 h-px bg-white/10" />
              <button data-testid="admin-pause-btn" onClick={() => doPause(false)} disabled={busy === "pause"}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-300 disabled:opacity-60">
                <Pause size={15} /> Pause Protocol
              </button>
              <button data-testid="admin-resume-btn" onClick={() => doPause(true)} disabled={busy === "pause"}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0AA84F]/40 bg-[#0AA84F]/15 px-4 py-2.5 text-sm font-semibold text-[#7CF3A0] disabled:opacity-60">
                <Play size={15} /> Resume Protocol
              </button>
            </div>
          </div>
        </div>

        {/* Users */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#0A1F14]/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Users size={16} className="text-[#7CF3A0]" /> Users
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
              <Search size={14} className="text-white/40" />
              <input
                data-testid="admin-user-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadUsers(q)}
                placeholder="Search address or UID…"
                className="w-56 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              />
              <button data-testid="admin-search-btn" onClick={() => loadUsers(q)} className="text-xs font-semibold text-[#7CF3A0]">Go</button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-white/40">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3">UID / Address</th>
                  <th className="py-2 pr-3">Stake</th>
                  <th className="py-2 pr-3">Rank</th>
                  <th className="py-2 pr-3">Cap</th>
                  <th className="py-2 pr-3">Binary L / R</th>
                  <th className="py-2 pr-3">Monthly</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody data-testid="admin-users-table">
                {rows.map((r) => (
                  <tr key={r.address} className="border-b border-white/5" data-testid={`admin-row-${r.uid}`}>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-white">{r.uid || "—"}</div>
                      <div className="font-mono text-[11px] text-white/40">{short(r.address)}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-white/80">{usd(r.stake_usd)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="bg-gradient-to-r from-[#7CF3A0] to-[#FFC24B] bg-clip-text font-semibold text-transparent">{r.rank}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-white/80">{usd(r.mining_cap_usd)}</td>
                    <td className="py-2.5 pr-3 font-mono text-white/60">
                      {(r.binary?.left_ids ?? 0)} / {(r.binary?.right_ids ?? 0)}
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.monthly_qualified
                        ? <span className="rounded-full bg-[#0AA84F]/20 px-2 py-0.5 text-[11px] font-semibold text-[#7CF3A0]">Qualified</span>
                        : <span className="text-[11px] text-white/30">—</span>}
                    </td>
                    <td className="py-2.5 pr-0">
                      <div className="flex items-center justify-end gap-1.5">
                        <button data-testid={`admin-block-${r.uid}`} onClick={() => doBlock(r.address, false)} disabled={busy === `blk-${r.address}`}
                          title="Block user" className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20 disabled:opacity-50">
                          <Ban size={14} />
                        </button>
                        <button data-testid={`admin-unblock-${r.uid}`} onClick={() => doBlock(r.address, true)} disabled={busy === `blk-${r.address}`}
                          title="Unblock user" className="rounded-lg border border-[#0AA84F]/30 bg-[#0AA84F]/10 p-1.5 text-[#7CF3A0] hover:bg-[#0AA84F]/20 disabled:opacity-50">
                          <CheckCircle2 size={14} />
                        </button>
                        <button data-testid={`admin-owner-${r.uid}`} onClick={() => doOwner(r.address)} disabled={busy === `own-${r.address}`}
                          title="Grant Owner-Club (300%)" className="rounded-lg border border-[#FFA000]/30 bg-[#FFA000]/10 p-1.5 text-[#FFC24B] hover:bg-[#FFA000]/20 disabled:opacity-50">
                          <Crown size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-white/40">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-white/30">
          On-chain actions are sent from your connected owner wallet. Contracts on {ONCHAIN.chainName}.
        </p>
      </div>
    </div>
  );
}
