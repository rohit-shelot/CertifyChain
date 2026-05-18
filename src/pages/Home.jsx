import React from "react";
import { useNavigate } from "react-router-dom";
import { CONTRACT_ADDRESS } from "../utils/contractConfig";
import { Badge, Card, CardTitle, HashBox } from "../components/UI";

const features = [
  {
    icon: "🔒", title: "Tamper-Proof",
    desc: "Once issued, certificates are stored permanently on Ethereum — impossible to alter or delete.",
    color: "bg-accent/10",
  },
  {
    icon: "⚡", title: "Instant Verification",
    desc: "Anyone verifies authenticity in seconds via QR code or link — no middlemen, no paper trail.",
    color: "bg-cert-teal/10",
  },
  {
    icon: "🌐", title: "IPFS Storage",
    desc: "Certificate PDFs stored on decentralized IPFS via Pinata — always accessible, never censored.",
    color: "bg-cert-gold/10",
  },
  {
    icon: "🔗", title: "Share & Verify",
    desc: "Get a shareable link and QR code for every certificate. Recipients can verify instantly worldwide.",
    color: "bg-green-500/10",
  },
];

const steps = [
  { step: "01", icon: "🔑", title: "Connect Wallet", desc: "Use MetaMask on Sepolia testnet — no sign-up required." },
  { step: "02", icon: "📝", title: "Fill Details",   desc: "Enter recipient name, course, and upload a PDF certificate." },
  { step: "03", icon: "⛓️", title: "Issue On-Chain",  desc: "One MetaMask confirmation issues the certificate permanently." },
  { step: "04", icon: "📤", title: "Share & Prove",   desc: "Copy the link or scan the QR — anyone can verify it instantly." },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 page-enter">

      {/* ── Hero ── */}
      <div className="text-center py-16">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/25 text-accent-light text-xs font-semibold px-4 py-1.5 rounded-full mb-7 tracking-widest uppercase">
          ⬡ Open to Everyone · Built on Ethereum Sepolia
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-none mb-6">
          Issue certificates<br />
          <span className="bg-gradient-to-r from-accent via-accent-light to-cert-teal bg-clip-text text-transparent">
            anyone can trust
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
          No registration. No admin approval. Connect your wallet, fill in the details,
          and issue a tamper-proof certificate on the blockchain in seconds.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            id="hero-issue-btn"
            onClick={() => navigate("/issue")}
            className="flex items-center gap-2 bg-gradient-accent text-white font-semibold px-7 py-3.5 rounded-xl hover:-translate-y-1 hover:shadow-accent transition-all"
          >
            🎓 Issue a Certificate
          </button>
          <button
            id="hero-verify-btn"
            onClick={() => navigate("/verify")}
            className="flex items-center gap-2 bg-bg-3 border border-border text-slate-200 font-semibold px-7 py-3.5 rounded-xl hover:bg-bg-4 hover:border-accent/50 transition-all"
          >
            🔍 Verify a Certificate
          </button>
        </div>
      </div>

      {/* ── How It Works ── */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold tracking-tight mb-1.5 text-center">How It Works</h2>
        <p className="text-slate-500 text-sm mb-8 text-center">Four steps from wallet to verified certificate</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s) => (
            <div
              key={s.step}
              className="relative bg-bg-2 border border-border rounded-2xl p-5 hover:-translate-y-0.5 hover:border-accent/30 transition-all"
            >
              <div className="text-xs font-bold text-accent/50 tracking-widest mb-3">{s.step}</div>
              <div className="text-2xl mb-3">{s.icon}</div>
              <h3 className="font-semibold text-sm mb-1.5">{s.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">Why ValidCertiChain?</h2>
        <p className="text-slate-500 text-sm mb-6">Built on immutable blockchain technology</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <Card key={f.title} className="hover:-translate-y-0.5 hover:border-accent/30 transition-all cursor-default">
              <div className={`w-10 h-10 ${f.color} rounded-xl flex items-center justify-center text-xl mb-3`}>
                {f.icon}
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Contract info ── */}
      <Card>
        <CardTitle icon="⚙️">Smart Contract on Sepolia</CardTitle>
        <div className="mb-4">
          <HashBox label="Contract Address" value={CONTRACT_ADDRESS} />
        </div>
        <p className="text-slate-600 text-xs">
          Fully open — no issuer whitelist. Any wallet can issue certificates directly on-chain.
        </p>
      </Card>
    </div>
  );
};

export default Home;
