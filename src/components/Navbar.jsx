import React from "react";
import { NavLink } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { shortenAddress } from "../utils/ethers";

const Navbar = () => {
  const {
    account,
    accounts,
    connect,
    disconnect,
    isConnecting,
    setAccount,
  } = useWallet();

  return (
    <>
      <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-border h-16 px-6 flex items-center justify-between">
        
        <NavLink
          to="/"
          className="flex items-center gap-2.5 font-bold text-lg tracking-tight no-underline text-white"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          CertifyChain
        </NavLink>

        <div className="flex gap-1">
          {[
            { to: "/", label: "Home" },
            { to: "/issue", label: "Issue" },
            { to: "/verify", label: "Verify" },
            { to: "/manage", label: "Manage" },
            { to: "/audit", label: "Audit Log" },
            { to: "/certificates", label: "Certificate" },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-lg text-sm font-medium transition-all no-underline
                ${
                  isActive
                    ? "bg-bg-3 text-white border border-border"
                    : "text-slate-500 hover:text-slate-200 hover:bg-bg-3"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {account ? (
          <div className="flex items-center gap-2">

            {accounts.length > 1 && (
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="bg-bg-3 border border-border text-white text-xs px-2 py-1 rounded"
              >
                {accounts.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc.slice(0, 6)}...{acc.slice(-4)}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={disconnect}
              className="flex items-center gap-2 bg-bg-3 border border-green-500/30 text-green-400 text-sm font-semibold px-4 py-2 rounded-lg hover:border-red-500/40 hover:text-red-400 transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse2" />
              {shortenAddress(account)}
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-gradient-accent text-white text-sm font-semibold px-5 py-2 rounded-lg hover:-translate-y-0.5 hover:shadow-accent-sm transition-all disabled:opacity-60"
          >
            {isConnecting ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "⚡"
            )}
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </nav>
    </>
  );
};

export default Navbar;