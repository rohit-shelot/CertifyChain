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
    desc: "Anyone verifies authenticity in seconds via QR code — no middlemen, no paper trail needed.",
    color: "bg-cert-teal/10",
  },
  {
    icon: "🌐", title: "IPFS Storage",
    desc: "Certificate PDFs stored on decentralized IPFS via Pinata — always accessible, never censored.",
    color: "bg-cert-gold/10",
  },
  {
    icon: "📋", title: "Full Audit Trail",
    desc: "Every issuance, verification, and revocation is logged on-chain with timestamps.",
    color: "bg-green-500/10",
  },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 page-enter">
      <div className="text-center py-16">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/25 text-accent-light text-xs font-semibold px-4 py-1.5 rounded-full mb-7 tracking-widest uppercase">
          ⬡ Build on Ethereum Sepolia
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-none mb-6">
          Certificates that<br />
          <span className="bg-gradient-to-r from-accent via-accent-light to-cert-teal bg-clip-text text-transparent">
            can't be faked
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
          Issue, verify, and manage tamper-proof certificates on the Ethereum blockchain.
          Every certificate is permanent, public, and instantly verifiable.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => navigate("/issue")}
            className="flex items-center gap-2 bg-gradient-accent text-white font-semibold px-7 py-3.5 rounded-xl hover:-translate-y-1 hover:shadow-accent transition-all"
          >
            🎓 Issue Certificate
          </button>
          <button
            onClick={() => navigate("/verify")}
            className="flex items-center gap-2 bg-bg-3 border border-border text-slate-200 font-semibold px-7 py-3.5 rounded-xl hover:bg-bg-4 hover:border-accent/50 transition-all"
          >
            🔍 Verify a Certificate
          </button>
        </div>
      </div>


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

      <Card>
        <CardTitle icon="⚙️">Smart Contract on Sepolia</CardTitle>
        <div className="mb-4">
          <HashBox label="Contract Address" value={CONTRACT_ADDRESS} />
        </div>
      </Card>
    </div>
  );
};

export default Home;
