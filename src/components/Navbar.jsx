import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { shortenAddress } from "../utils/ethers";
import { useContract } from "../hooks/useContract";

const Navbar = () => {
  const { account, accounts, connect, disconnect, isConnecting, setAccount } = useWallet();
  const { checkOwner } = useContract();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const verifyOwner = async () => {
      if (!account) { setIsOwner(false); return; }
      try {
        const ownerStatus = await checkOwner(account);
        setIsOwner(ownerStatus);
      } catch (err) { setIsOwner(false); }
    };
    verifyOwner();
  }, [account, checkOwner]);

  const NAV_LINKS = [
    { to: "/", label: "Home", icon: "⬡" },
    { to: "/issue", label: "Issue", icon: "✦" },
    { to: "/verify", label: "Verify", icon: "◈" },
    { to: "/manage", label: "My Certificates", icon: "📋" },
    ...(isOwner ? [{ to: "/certificates", label: "Explorer", icon: "❋" }] : []),
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const wrapperRef = useRef(null);

  /* Close on outside click — ref wraps BOTH nav + drawer */
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Scroll shadow */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Lock body when menu open */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [menuOpen]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap');

        /* ── tokens ── */
        :root {
          --nav-h: 64px;
          --accent: #7c6dfa;
          --accent2: #4af0c4;
          --glow: rgba(124,109,250,0.35);
        }

        /* ── nav shell ── */
        .cc-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          height: var(--nav-h);
          padding: 0 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: rgba(8,8,20,0.72);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          transition: box-shadow 0.3s ease;
          font-family: 'DM Sans', sans-serif;
        }
        .cc-nav.scrolled {
          box-shadow: 0 4px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(124,109,250,0.15);
        }

        /* ── logo ── */
        .cc-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          text-decoration: none;
          flex-shrink: 0;
        }
        .cc-logo-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 14px var(--glow);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .cc-logo:hover .cc-logo-icon {
          transform: rotate(-8deg) scale(1.08);
          box-shadow: 0 0 24px var(--glow);
        }
        .cc-logo-text {
          font-family: 'Space Mono', monospace;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #fff;
          line-height: 1;
        }
        .cc-logo-text span {
          color: var(--accent2);
        }

        /* ── desktop links ── */
        .cc-links {
          display: flex;
          gap: 2px;
          flex: 1;
          justify-content: center;
        }
        .cc-link {
          position: relative;
          padding: 0.45rem 0.9rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-decoration: none;
          color: rgba(200,200,230,0.55);
          transition: color 0.2s, background 0.2s;
          white-space: nowrap;
        }
        .cc-link::after {
          content: '';
          position: absolute;
          bottom: 5px;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 16px;
          height: 2px;
          border-radius: 99px;
          background: linear-gradient(90deg, var(--accent), var(--accent2));
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        .cc-link:hover {
          color: #fff;
          background: rgba(255,255,255,0.05);
        }
        .cc-link.active {
          color: #fff;
          background: rgba(124,109,250,0.12);
          border: 1px solid rgba(124,109,250,0.2);
        }
        .cc-link.active::after {
          transform: translateX(-50%) scaleX(1);
        }

        /* ── wallet zone ── */
        .cc-wallet {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .cc-select {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          font-size: 0.72rem;
          padding: 0.3rem 0.5rem;
          border-radius: 7px;
          outline: none;
          cursor: pointer;
          font-family: 'Space Mono', monospace;
        }
        .cc-select option { background: #0f0f1a; }

        .cc-btn-connect {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          background: linear-gradient(135deg, var(--accent), #5b4fea);
          color: #fff;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.5rem 1.1rem;
          border-radius: 9px;
          border: none;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 0 0 0 var(--glow);
          white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
        }
        .cc-btn-connect:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px var(--glow);
        }
        .cc-btn-connect:disabled { opacity: 0.55; cursor: not-allowed; }

        .cc-btn-account {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(74,240,196,0.25);
          color: #4af0c4;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 0.45rem 1rem;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Space Mono', monospace;
          white-space: nowrap;
        }
        .cc-btn-account:hover {
          border-color: rgba(255,80,80,0.4);
          color: #ff6b6b;
          background: rgba(255,80,80,0.06);
        }
        .cc-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4af0c4;
          animation: pulse-dot 1.8s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%,100% { box-shadow: 0 0 0 0 rgba(74,240,196,0.6); }
          50% { box-shadow: 0 0 0 5px rgba(74,240,196,0); }
        }
        .cc-spinner {
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── hamburger ── */
        .cc-burger {
          display: none;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          width: 36px;
          height: 36px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          cursor: pointer;
          gap: 5px;
          flex-shrink: 0;
          transition: background 0.2s, border-color 0.2s;
        }
        .cc-burger:hover { background: rgba(124,109,250,0.12); border-color: rgba(124,109,250,0.3); }
        .cc-burger-line {
          width: 18px;
          height: 2px;
          border-radius: 99px;
          background: rgba(200,200,255,0.7);
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s;
          transform-origin: center;
        }
        .cc-burger.open .cc-burger-line:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .cc-burger.open .cc-burger-line:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .cc-burger.open .cc-burger-line:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

        /* ── mobile drawer ── */
        .cc-drawer {
          position: fixed;
          top: var(--nav-h);
          left: 0; right: 0; bottom: 0;
          z-index: 99;
          display: flex;
          flex-direction: column;
          background: rgba(8,8,20,0.97);
          backdrop-filter: blur(24px);
          border-top: 1px solid rgba(124,109,250,0.15);
          padding: 1.25rem 1.25rem 2rem;
          overflow-y: auto;
          transform: translateY(-12px);
          opacity: 0;
          pointer-events: none;
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease;
        }
        .cc-drawer.open {
          transform: translateY(0);
          opacity: 1;
          pointer-events: all;
        }

        .cc-drawer-links {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 1.5rem;
        }
        .cc-mobile-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          text-decoration: none;
          color: rgba(200,200,230,0.6);
          font-size: 0.9rem;
          font-weight: 600;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .cc-mobile-link:hover {
          color: #fff;
          background: rgba(255,255,255,0.05);
        }
        .cc-mobile-link.active {
          color: #fff;
          background: rgba(124,109,250,0.12);
          border-color: rgba(124,109,250,0.25);
        }
        .cc-mobile-link-icon {
          font-size: 0.95rem;
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .cc-mobile-link.active .cc-mobile-link-icon {
          background: rgba(124,109,250,0.2);
        }

        .cc-drawer-wallet {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .cc-btn-connect-full,
        .cc-btn-account-full {
          width: 100%;
          justify-content: center;
          padding: 0.75rem;
          font-size: 0.875rem;
          border-radius: 11px;
        }
        .cc-select-full {
          width: 100%;
          padding: 0.6rem 0.75rem;
          border-radius: 9px;
          font-size: 0.8rem;
        }

        /* ── responsive breakpoints ── */
        @media (max-width: 900px) {
          .cc-links { display: none; }
        }
        @media (max-width: 640px) {
          .cc-wallet { display: none; }
          .cc-burger { display: flex; }
          .cc-nav { padding: 0 1rem; }
        }
        @media (min-width: 641px) and (max-width: 900px) {
          .cc-burger { display: flex; }
        }
        @media (min-width: 901px) {
          .cc-drawer { display: none !important; }
          .cc-burger { display: none; }
        }
      `}</style>

      <div ref={wrapperRef}>
      <nav className={`cc-nav${scrolled ? " scrolled" : ""}`}>
        {/* Logo */}
        <NavLink to="/" className="cc-logo" onClick={() => setMenuOpen(false)}>
          <div className="cc-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div className="cc-logo-text">
            Valid<span>Certi</span>Chain
          </div>
        </NavLink>

        {/* Desktop links */}
        <div className="cc-links">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `cc-link${isActive ? " active" : ""}`}
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Desktop wallet */}
        <div className="cc-wallet">
          {account ? (
            <>
              {accounts.length > 1 && (
                <select
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="cc-select"
                >
                  {accounts.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc.slice(0, 6)}...{acc.slice(-4)}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={disconnect} className="cc-btn-account">
                <span className="cc-dot" />
                {shortenAddress(account)}
              </button>
            </>
          ) : (
            <button onClick={connect} disabled={isConnecting} className="cc-btn-connect">
              {isConnecting ? <div className="cc-spinner" /> : "⚡"}
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>

        {/* Hamburger */}
        <button
          className={`cc-burger${menuOpen ? " open" : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span className="cc-burger-line" />
          <span className="cc-burger-line" />
          <span className="cc-burger-line" />
        </button>
      </nav>

      {/* Mobile drawer */}
      <div className={`cc-drawer${menuOpen ? " open" : ""}`}>
        <div className="cc-drawer-links">
          {NAV_LINKS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `cc-mobile-link${isActive ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="cc-mobile-link-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>

        {/* Mobile wallet */}
        <div className="cc-drawer-wallet">
          {account ? (
            <>
              {accounts.length > 1 && (
                <select
                  value={account}
                  onChange={(e) => { setAccount(e.target.value); setMenuOpen(false); }}
                  className="cc-select cc-select-full"
                >
                  {accounts.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc.slice(0, 6)}...{acc.slice(-4)}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={() => { disconnect(); setMenuOpen(false); }} className="cc-btn-account cc-btn-account-full">
                <span className="cc-dot" />
                {shortenAddress(account)}
              </button>
            </>
          ) : (
            <button onClick={() => { connect(); setMenuOpen(false); }} disabled={isConnecting} className="cc-btn-connect cc-btn-connect-full">
              {isConnecting ? <div className="cc-spinner" /> : "⚡"}
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default Navbar;