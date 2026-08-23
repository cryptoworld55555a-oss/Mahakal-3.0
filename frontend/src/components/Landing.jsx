import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import {
  Rocket, Download, Zap, ShieldCheck, TrendingUp, Boxes, Eye, Users, FileCheck2,
  Copy, ArrowRight, Coins, Link2, DollarSign, Lock, BadgeCheck, CheckCircle2,
  Send, Youtube, MessageCircle, Twitter, ChevronDown, Pickaxe, Gift, UserPlus,
  Layers, Cpu, Menu, ExternalLink, KeyRound, Settings, Rabbit,
} from "lucide-react";
import { toast } from "sonner";
import { getDashboardStats } from "@/lib/api";
import { LOGO_URL, COIN_HERO_URL, ONCHAIN } from "@/config";
import WalletModal from "@/components/WalletModal";

const usd = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
const usd2 = (n) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function SectionHeading({ children }) {
  return (
    <div className="my-7 flex items-center justify-center gap-3 px-2">
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#D6C51E]/60" />
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D6C51E] shadow-[0_0_6px_rgba(214,197,30,0.8)]" />
      <h2 className="text-center text-2xl font-extrabold grad-title">{children}</h2>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D6C51E] shadow-[0_0_6px_rgba(214,197,30,0.8)]" />
      <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#D6C51E]/60" />
    </div>
  );
}

function FeatureCard({ Icon, title, desc, color = "#34D07A", testid }) {
  return (
    <div data-testid={testid} className="card-glow p-4">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border" style={{ borderColor: `${color}55`, backgroundColor: `${color}16` }}>
        <Icon size={20} style={{ color }} />
      </span>
      <div className="text-sm font-bold grad-title">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-white/55">{desc}</p>
    </div>
  );
}

function TokenRow({ Icon, label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-b-0">
      <span className="flex items-center gap-2.5 text-sm text-white/60">
        <Icon size={16} className="text-[#D6C51E]" /> {label}
      </span>
      <span className="text-right text-sm font-bold text-white">{value}</span>
    </div>
  );
}

export default function Landing() {
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { getDashboardStats().then(setStats).catch(() => {}); }, []);

  const price = stats?.price_usd || 10;
  const spark = (stats?.price_spark || []).map((v, i) => ({ i, v }));
  const liq = stats?.liquidity || { usdt: 2000, ttn: 200, value_usd: 4000, pair: "TTN/USDT · PancakeSwap V2" };

  const ppt = () => toast("PPT coming soon — stay tuned!");
  const socials = [
    { Icon: Send, label: "Telegram", href: "#" },
    { Icon: Twitter, label: "Twitter (X)", href: "#" },
    { Icon: MessageCircle, label: "Discord", href: "#" },
    { Icon: Youtube, label: "YouTube", href: "#" },
  ];
  const contracts = [
    { Icon: Users, label: "Creator Address", value: ONCHAIN.creator, type: "address" },
    { Icon: KeyRound, label: "Published Private Key", value: ONCHAIN.publishedKey, type: "key" },
    { Icon: BadgeCheck, label: "TTN Address", value: ONCHAIN.token, type: "address" },
    { Icon: Settings, label: "Mining Engine", value: ONCHAIN.protocol, type: "address" },
    { Icon: Rabbit, label: "Pancake V2 Router", value: ONCHAIN.router, type: "address" },
    { Icon: DollarSign, label: "USDT Address", value: ONCHAIN.usdt, type: "address" },
  ];
  const shortAddr = (v, type) => {
    if (!v) return type === "key" ? "Published after renounce" : "0x0000…0000";
    return `${v.slice(0, 6)}…${v.slice(-4)}`;
  };
  const copyIng = (c) => {
    if (!c.value) return toast(c.type === "key" ? "Key is published after ownership renounce" : "Available after deployment");
    navigator.clipboard?.writeText(c.value).then(() => toast.success(`${c.label} copied`)).catch(() => toast.error("Copy failed"));
  };
  const openIng = (c) => {
    if (c.type === "key") return toast("Private keys have no explorer page — copy & verify locally");
    if (!c.value) return toast("Address goes live after deployment");
    window.open(`${ONCHAIN.explorer}/address/${c.value}`, "_blank");
  };

  return (
    <div data-testid="landing-page" className="relative z-10 flex flex-1 flex-col pb-10">
      {/* Sticky top nav */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/5 bg-[#04110A]/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-[#0AA84F]/50 shadow-[0_0_12px_rgba(10,168,79,0.35)]">
            <img src={LOGO_URL} alt="TITAN" className="h-full w-full object-cover" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white" style={{ fontFamily: "Unbounded, Inter, sans-serif" }}>TITAN</span>
        </div>
        <button
          data-testid="landing-connect-top"
          onClick={() => setOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] px-3.5 text-sm font-bold text-black active:scale-95 shadow-[0_0_16px_rgba(10,168,79,0.4)]"
        >
          <Rocket size={15} /> Connect
        </button>
      </header>

      <div className="px-4">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="pt-6"
        >
          <span className="grad-label">Community Powered</span>
          <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight text-white">
            Mining <span className="grad-title">Ecosystem</span>
          </h1>
          <p className="mt-2 text-sm font-bold tracking-wide text-[#D6C51E]">MINE • HOLD • GROW TOGETHER</p>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            A decentralized ecosystem built on transparency, community participation, and sustainable growth — powered by smart contracts on BNB Smart Chain.
          </p>

          <div className="mt-5 flex gap-3">
            <button
              data-testid="landing-connect-hero"
              onClick={() => setOpen(true)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] text-sm font-bold text-black active:scale-[0.98] shadow-[0_0_18px_rgba(10,168,79,0.45)]"
            >
              <Rocket size={16} /> Connect
            </button>
            <button
              data-testid="landing-ppt-hero"
              onClick={ppt}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#D6C51E]/45 text-sm font-bold text-[#D6C51E] active:scale-[0.98]"
            >
              <Download size={16} /> Download PPT
            </button>
          </div>

          {/* Coin */}
          <div className="relative mt-6 flex justify-center">
            <div className="pointer-events-none absolute inset-x-10 bottom-2 h-24 rounded-full bg-[#0AA84F]/25 blur-3xl" />
            <motion.img
              src={COIN_HERO_URL}
              alt="TITAN coin"
              className="relative w-56 rounded-3xl"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* Live price */}
          <div data-testid="landing-price" className="card-glow mt-6 flex items-center gap-3 p-4">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-[#D6C51E]/40">
              <img src={LOGO_URL} alt="TTN" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-extrabold text-white" style={{ fontFamily: "'Share Tech Mono', monospace" }}>${usd2(price)}</div>
              <div className="truncate text-[11px]"><span className="font-bold text-[#34D07A]">1 TTN</span> <span className="text-white/45">· PancakeSwap V2 router</span></div>
            </div>
            <div className="ml-auto h-10 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark} margin={{ top: 4, right: 2, bottom: 4, left: 0 }}>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line type="monotone" dataKey="v" stroke="#D6C51E" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.section>

        {/* Liquidity Pool */}
        <div data-testid="landing-liquidity" className="card-glow mt-4 p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              <span className="text-lg">🥞</span> PancakeSwap Liquidity Pool
            </span>
            <span className="flex items-center gap-1 rounded-full border border-[#0AA84F]/45 bg-[#0AA84F]/15 px-2 py-0.5 text-[10px] font-bold text-[#34D07A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D07A]" /> LIVE
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2.5">
            <span className="text-xs text-white/50">USDT Balance</span>
            <span className="font-bold text-white" style={{ fontFamily: "'Share Tech Mono', monospace" }}>{usd2(liq.usdt)} USDT</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2.5">
            <span className="text-xs text-white/50">TTN Balance</span>
            <span className="font-bold text-white" style={{ fontFamily: "'Share Tech Mono', monospace" }}>{usd2(liq.ttn)} TTN</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-xs text-white/50">Liquidity Value</span>
            <span className="font-bold text-[#D6C51E]" style={{ fontFamily: "'Share Tech Mono', monospace" }}>${usd2(liq.value_usd)}</span>
          </div>
          <button onClick={() => toast("Live pool opens after testnet deployment")} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#3C6B33]/50 py-2.5 text-xs font-semibold text-white/70 active:scale-[0.98]">
            View liquidity pool <ExternalLink size={13} />
          </button>
        </div>

        {/* WHY TITAN */}
        <SectionHeading>Why TITAN?</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <FeatureCard testid="why-community" Icon={Users} title="Community Powered" desc="Built by the community, for the community." color="#34D07A" />
          <FeatureCard testid="why-secure" Icon={ShieldCheck} title="Transparent & Secure" desc="Smart contracts ensure transparency and complete security." color="#65B82E" />
          <FeatureCard testid="why-growth" Icon={TrendingUp} title="Sustainable Growth" desc="Balanced ecosystem designed for long-term sustainable growth." color="#D6C51E" />
          <FeatureCard testid="why-decentral" Icon={Boxes} title="Decentralized Ecosystem" desc="Decentralized protocol with fair and open participation." color="#FFA000" />
        </div>

        {/* OUR VISION */}
        <SectionHeading>Our Vision</SectionHeading>
        <div className="card-glow flex items-start gap-4 p-5">
          <img src={LOGO_URL} alt="TITAN" className="h-14 w-14 shrink-0 rounded-full ring-1 ring-[#0AA84F]/50" />
          <p className="text-sm leading-relaxed text-white/70">
            To build one of the most trusted <span className="font-semibold text-[#D6C51E]">community-powered mining ecosystems</span> where transparency, decentralization, and sustainable rewards become the foundation of long-term growth.
          </p>
        </div>

        {/* TOKENOMICS */}
        <SectionHeading>Tokenomics</SectionHeading>
        <div data-testid="landing-tokenomics" className="card-glow px-4 py-2">
          <TokenRow Icon={Coins} label="Total Supply" value="200,000 TTN" />
          <TokenRow Icon={Link2} label="Blockchain" value="Binance Smart Chain (BSC)" />
          <TokenRow Icon={DollarSign} label="Initial Liquidity" value="$2,000 USDT" />
          <TokenRow Icon={Rocket} label="Launch Price" value={`$${usd2(price)} Per TTN`} />
          <TokenRow Icon={Users} label="Ecosystem" value="Community Powered" />
          <TokenRow Icon={FileCheck2} label="Contract" value="Smart Contract Controlled" />
          <TokenRow Icon={Lock} label="Liquidity" value="Cake LP Tokens Burned" />
          <TokenRow Icon={BadgeCheck} label="Ownership" value="Renounced" />
        </div>

        {/* SPECIAL FEATURES */}
        <SectionHeading>Special Features</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <FeatureCard testid="feat-affiliate" Icon={Zap} title="Instant Affiliate Rewards" desc="Real-time rewards distribution." color="#34D07A" />
          <FeatureCard testid="feat-automation" Icon={Cpu} title="Smart Contract Automation" desc="Transparent and automatic system." color="#D6C51E" />
          <FeatureCard testid="feat-onchain" Icon={Eye} title="Transparent On-Chain" desc="Everything is on-chain and verifiable." color="#65B82E" />
          <FeatureCard testid="feat-driven" Icon={Users} title="Community Driven" desc="Built by the community, for the community." color="#FFA000" />
        </div>

        {/* PROTOCOL INGREDIENTS */}
        <SectionHeading>Protocol Ingredients</SectionHeading>
        <div data-testid="landing-contracts" className="card-glow p-4">
          {contracts.map((c) => (
            <div key={c.label} className="flex items-center gap-3 border-b border-white/5 py-3.5 last:border-b-0">
              <c.Icon size={22} className="shrink-0 text-[#D6C51E]" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/75">{c.label}</div>
                <button
                  onClick={() => copyIng(c)}
                  className="mt-1 flex items-center gap-2 rounded-md active:scale-95"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded border border-[#34D07A]/40 text-[#34D07A]"><Copy size={11} /></span>
                  <span className="font-mono text-xs text-white/55">{shortAddr(c.value, c.type)}</span>
                </button>
              </div>
              {c.type === "key" ? (
                <span className="flex h-9 items-center rounded-full border border-[#D6C51E]/40 bg-[#D6C51E]/10 px-2.5 text-[10px] font-bold text-[#D6C51E]">
                  <Lock size={11} className="mr-1" /> Trustless
                </span>
              ) : (
                <button
                  onClick={() => openIng(c)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#34D07A]/45 text-[#34D07A] active:scale-95"
                >
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          ))}
          <p className="mt-3 text-center text-[11px] text-white/40">TTN, Mining Engine, Router & USDT are live on-chain. Creator address & private key are published after ownership renounce.</p>
        </div>

        {/* STAKE PARTICIPATION */}
        <SectionHeading>Stake Participation</SectionHeading>
        <p className="-mt-3 mb-4 px-2 text-center text-xs leading-relaxed text-white/55">
          Your membership tier determines the maximum mining cap generated from Stake Participation.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="card-glow p-4 text-center">
            <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-[#34D07A]/50 bg-[#34D07A]/12"><Users size={20} className="text-[#34D07A]" /></span>
            <div className="text-3xl font-extrabold text-[#34D07A]">200%</div>
            <div className="text-xs font-bold text-white">Standard User</div>
            <p className="mt-1 text-[11px] text-white/50">Mining cap equal to 200% of eligible Stake Participation.</p>
          </div>
          <div className="card-glow p-4 text-center">
            <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-[#D6C51E]/50 bg-[#D6C51E]/12"><BadgeCheck size={20} className="text-[#D6C51E]" /></span>
            <div className="text-3xl font-extrabold text-[#D6C51E]">300%</div>
            <div className="text-xs font-bold text-white">Owner Club Member</div>
            <p className="mt-1 text-[11px] text-white/50">Enhanced mining cap equal to 300% of eligible Stake Participation.</p>
          </div>
        </div>

        {/* WORKING MODULE */}
        <div className="mt-8 text-center">
          <span className="grad-label">Ecosystem</span>
          <h2 className="mt-1 text-2xl font-extrabold grad-title">Working Module</h2>
          <p className="mt-1 text-xs text-white/50">Simple. Transparent. Decentralized.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { n: 1, Icon: UserPlus, t: "Registration", d: "Free for everyone. Start your journey with TITAN.", hl: "Free" },
            { n: 2, Icon: Coins, t: "Stake", d: "Contribute daily.", hl: "$10 – $1,000 / day" },
            { n: 3, Icon: Layers, t: "Allocation", d: "Every stake splits automatically.", hl: "60% Buy · 35% Reward · 5% Dev" },
            { n: 4, Icon: Pickaxe, t: "Mining", d: "TTN mining starts instantly.", hl: "Min $10" },
          ].map((s) => (
            <div key={s.n} className="card-glow p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#34D07A]/50 bg-[#34D07A]/12 text-xs font-extrabold text-[#34D07A]">{s.n}</span>
                <s.Icon size={20} className="text-[#65B82E]" />
              </div>
              <div className="text-sm font-bold grad-title">{s.t}</div>
              <p className="mt-1 text-[11px] text-white/55">{s.d}</p>
              <p className="mt-1 text-[11px] font-bold text-[#D6C51E]">{s.hl}</p>
            </div>
          ))}
          <div className="card-glow col-span-2 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D6C51E]/50 bg-[#D6C51E]/12 text-xs font-extrabold text-[#D6C51E]">5</span>
              <Gift size={20} className="text-[#FFA000]" />
            </div>
            <div className="text-sm font-bold grad-title">Reward Distribution</div>
            <p className="mt-1 text-[11px] text-white/55">Instant, Daily, Weekly & Monthly rewards paid on-chain.</p>
          </div>
        </div>

        {/* REWARD DISTRIBUTION */}
        <SectionHeading>Reward Distribution</SectionHeading>
        <p className="-mt-3 mb-4 px-2 text-center text-xs leading-relaxed text-white/55">
          A share of every contribution flows to the Protocol Engine for community rewards.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FeatureCard testid="rew-direct" Icon={Zap} title="Direct Reward" desc="Instant spot reward on your direct referrals." color="#34D07A" />
          <FeatureCard testid="rew-level" Icon={Users} title="Multi-Level Reward" desc="Earn across 15 levels of your network." color="#65B82E" />
          <FeatureCard testid="rew-pools" Icon={Layers} title="Daily & Weekly Pools" desc="Qualify and share the on-chain pools." color="#D6C51E" />
          <FeatureCard testid="rew-owner" Icon={Gift} title="Monthly Owner Club" desc="Elite monthly reward for top achievers." color="#FFA000" />
        </div>
        <div className="card-glow mt-3 p-4">
          <ul className="space-y-2 text-xs text-white/65">
            <li>• Direct and level rewards apply to contributions of <b className="text-[#D6C51E]">$50 and above</b>.</li>
            <li>• Rewards <b className="text-[#FFA000]">reduce your Mining Cap</b>. If no cap is available, no reward is paid.</li>
            <li>• Appreciation benefits also reduce your Mining Cap.</li>
            <li>• Daily and Weekly Pool rewards <b className="text-[#34D07A]">do NOT reduce</b> your Mining Cap.</li>
          </ul>
        </div>

        {/* TRUSTED SECURE */}
        <div className="mt-8 text-center">
          <h2 className="text-2xl font-extrabold leading-tight grad-title">Trusted • Transparent • Secure</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <FeatureCard testid="trust-audit" Icon={FileCheck2} title="Smart Contract Audited" desc="Audited and secured by third-party experts." color="#34D07A" />
          <FeatureCard testid="trust-renounced" Icon={BadgeCheck} title="Ownership Renounced" desc="No admin control. Community driven." color="#D6C51E" />
          <FeatureCard testid="trust-transparent" Icon={Eye} title="100% Transparency" desc="All transactions are on-chain and verifiable." color="#65B82E" />
          <FeatureCard testid="trust-bsc" Icon={Boxes} title="Built on BSC" desc="Powered by Binance Smart Chain." color="#FFA000" />
        </div>

        {/* CTA */}
        <div data-testid="landing-cta" className="card-glow mt-8 p-6 text-center">
          <h2 className="text-2xl font-extrabold leading-tight text-white">
            Ready to start your <span className="grad-title">mining journey?</span>
          </h2>
          <p className="mt-2 text-sm text-white/60">Be part of the future.</p>
          <p className="text-sm text-white/60">Mine • Hold • Grow Together with <span className="font-bold text-[#D6C51E]">TITAN</span>.</p>
          <div className="mt-5 flex gap-3">
            <button
              data-testid="landing-connect-cta"
              onClick={() => setOpen(true)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0AA84F] via-[#65B82E] to-[#D6C51E] text-sm font-bold text-black active:scale-[0.98] shadow-[0_0_18px_rgba(10,168,79,0.45)]"
            >
              <Rocket size={16} /> Connect
            </button>
            <button
              data-testid="landing-ppt-cta"
              onClick={ppt}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#D6C51E]/45 text-sm font-bold text-[#D6C51E] active:scale-[0.98]"
            >
              <Download size={16} /> Download PPT
            </button>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="mt-8 border-t border-white/5 pt-6">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="TITAN" className="h-10 w-10 rounded-full ring-1 ring-[#0AA84F]/50" />
            <div>
              <div className="text-base font-extrabold text-white">TITAN</div>
              <div className="text-[11px] text-[#34D07A]">Community Powered Mining Ecosystem</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <div className="grad-label mb-3">Useful Links</div>
              <ul className="space-y-2 text-sm text-white/55">
                {["Audit", "Docs", "FAQ", "Roadmap", "Privacy Policy"].map((l) => (
                  <li key={l}><a href="#" onClick={(e) => { e.preventDefault(); toast(`${l} coming soon`); }} className="hover:text-white">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="grad-label mb-3">Join Community</div>
              <ul className="space-y-2 text-sm text-white/55">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} onClick={(e) => { if (s.href === "#") { e.preventDefault(); toast(`${s.label} link coming soon`); } }} className="flex items-center gap-2 hover:text-white">
                      <s.Icon size={16} className="text-[#34D07A]" /> {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-6 border-t border-white/5 pt-4 text-[11px] text-white/40">
            © 2026 TITAN. All Rights Reserved.<br />Built by the community. Powered by smart contracts.
          </div>
        </footer>
      </div>

      <WalletModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
