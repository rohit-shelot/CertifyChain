import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Card, CardTitle, InputField, PrimaryButton, Badge, Spinner, EmptyState } from "../components/UI";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import { CONTRACT_ADDRESS } from "../utils/contractConfig";
import { shortenAddress } from "../utils/ethers";
import toast from "react-hot-toast";

const ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "bytes32", "name": "certHash",  "type": "bytes32" },
      { "indexed": false, "internalType": "string",  "name": "name",      "type": "string"  },
      { "indexed": false, "internalType": "string",  "name": "course",    "type": "string"  },
      { "indexed": true,  "internalType": "address", "name": "issuer",    "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "CertificateIssued", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "bytes32", "name": "certHash",  "type": "bytes32" },
      { "indexed": true,  "internalType": "address", "name": "revokedBy", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "CertificateRevoked", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "issuer",  "type": "address" },
      { "indexed": true, "internalType": "address", "name": "addedBy", "type": "address" }
    ],
    "name": "IssuerAdded", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "issuer",    "type": "address" },
      { "indexed": true, "internalType": "address", "name": "removedBy", "type": "address" }
    ],
    "name": "IssuerRemoved", "type": "event"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_issuer", "type": "address" }],
    "name": "addIssuer", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_issuer", "type": "address" }],
    "name": "removeIssuer", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "certHash", "type": "bytes32" }],
    "name": "revokeCertificate", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "authorizedIssuers",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "certHash", "type": "bytes32" }],
    "name": "verifyCertificate",
    "outputs": [{
      "components": [
        { "internalType": "string",  "name": "name",      "type": "string"  },
        { "internalType": "string",  "name": "course",    "type": "string"  },
        { "internalType": "string",  "name": "ipfsHash",  "type": "string"  },
        { "internalType": "uint256", "name": "issueDate", "type": "uint256" },
        { "internalType": "address", "name": "issuer",    "type": "address" },
        { "internalType": "bool",    "name": "isValid",   "type": "bool"    }
      ],
      "internalType": "struct CertificateVerification.Certificate",
      "name": "", "type": "tuple"
    }],
    "stateMutability": "view", "type": "function"
  }
];

/* ─── shared style tokens ─── */
const revokeBtn = {
  fontSize: 12,
  color: "#ef4444",
  background: "rgba(239,68,68,0.06)",
  border: "1px solid rgba(239,68,68,0.25)",
  padding: "5px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};
const disabledRevokeBtn = { ...revokeBtn, opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" };

/* ─── CertCard: mobile-first card view for a single certificate ─── */
const CertCard = ({ c, revoking, onRevoke }) => (
  <div style={{
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{c.name}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.course}</div>
      </div>
      <Badge variant={c.valid ? "valid" : "revoked"}>
        {c.valid ? "✓ Valid" : "✗ Revoked"}
      </Badge>
    </div>

    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        <span style={{ opacity: 0.6 }}>Hash </span>
        <a href={`https://sepolia.etherscan.io/tx/${c.txHash}`} target="_blank" rel="noreferrer"
          style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a78bfa", textDecoration: "none" }}>
          {c.hash.slice(0, 8)}...{c.hash.slice(-4)} ↗
        </a>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        <span style={{ opacity: 0.6 }}>Issuer </span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{shortenAddress(c.issuer)}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        <span style={{ opacity: 0.6 }}>Date </span>{c.date}
      </div>
    </div>

    {c.valid && (
      <div style={{ marginTop: 2 }}>
        <button
          style={revoking === c.hash ? disabledRevokeBtn : revokeBtn}
          disabled={revoking === c.hash}
          onClick={() => onRevoke(c.hash)}
        >
          {revoking === c.hash ? "Revoking…" : "Revoke"}
        </button>
      </div>
    )}
  </div>
);

const Manage = () => {
  const { account }                              = useWallet();
  const { addNewIssuer, checkIssuer, checkOwner } = useContract();

  const [isAuthorized,  setIsAuthorized]  = useState(false);
  const [isOwner,       setIsOwner]       = useState(false);
  const [checkingAuth,  setCheckingAuth]  = useState(true);
  const [certs,         setCerts]         = useState([]);
  const [issuers,       setIssuers]       = useState([]);
  const [loadingCerts,  setLoadingCerts]  = useState(true);
  const [loadingIssue,  setLoadingIssue]  = useState(true);
  const [newAddr,       setNewAddr]       = useState("");
  const [newLabel,      setNewLabel]      = useState("");
  const [revoking,      setRevoking]      = useState(null);

  /* track viewport for responsive table vs card toggle */
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const getContract = useCallback((signer = false) => {
    if (!window.ethereum) throw new Error("MetaMask not found");
    const provider = new ethers.BrowserProvider(window.ethereum);
    if (signer) {
      return provider.getSigner().then((s) => new ethers.Contract(CONTRACT_ADDRESS, ABI, s));
    }
    return Promise.resolve(new ethers.Contract(CONTRACT_ADDRESS, ABI, provider));
  }, []);

  useEffect(() => {
    const check = async () => {
      if (!account) { setIsAuthorized(false); setIsOwner(false); setCheckingAuth(false); return; }
      setCheckingAuth(true);
      try {
        const [ok, ownerOk] = await Promise.all([checkIssuer(account), checkOwner(account)]);
        setIsAuthorized(ok);
        setIsOwner(ownerOk);
      } catch (_) {
        setIsAuthorized(false); setIsOwner(false);
      } finally { setCheckingAuth(false); }
    };
    check();
  }, [account, checkIssuer, checkOwner]);

  const loadCerts = useCallback(async () => {
    setLoadingCerts(true);
    try {
      const contract  = await getContract();
      const provider  = new ethers.BrowserProvider(window.ethereum);
      const current   = await provider.getBlockNumber();
      const fromBlock = Math.max(0, current - 10000);
      const logs      = await contract.queryFilter(contract.filters.CertificateIssued(), fromBlock, "latest");
      const parsed = await Promise.all(
        logs.map(async (log) => {
          let isValid = false, name = log.args.name, course = log.args.course, ipfsHash = "";
          try {
            const cert = await contract.verifyCertificate(log.args.certHash);
            isValid = cert[5]; name = cert[0] || name; course = cert[1] || course; ipfsHash = cert[2];
          } catch (_) {}
          const block = await provider.getBlock(log.blockNumber);
          return {
            hash: log.args.certHash, name, course, ipfsHash,
            issuer: log.args.issuer,
            date: new Date(Number(block.timestamp) * 1000).toLocaleDateString("en-IN"),
            txHash: log.transactionHash, valid: isValid,
          };
        })
      );
      const map = new Map();
      parsed.forEach((c) => map.set(c.hash, c));
      setCerts([...map.values()].reverse());
    } catch (err) {
      toast.error("Failed to load certificates: " + err.message);
    } finally { setLoadingCerts(false); }
  }, [getContract]);

  const loadIssuers = useCallback(async () => {
    if (!account) return;
    setLoadingIssue(true);
    try {
      const contract  = await getContract();
      const provider  = new ethers.BrowserProvider(window.ethereum);
      const current   = await provider.getBlockNumber();
      const fromBlock = Math.max(0, current - 10000);
      const [addedLogs, removedLogs] = await Promise.all([
        contract.queryFilter(contract.filters.IssuerAdded(),   fromBlock, "latest"),
        contract.queryFilter(contract.filters.IssuerRemoved(), fromBlock, "latest"),
      ]);
      const removed = new Set(removedLogs.map((l) => l.args.issuer.toLowerCase()));
      const seen = new Set(); const list = [];
      for (const log of addedLogs) {
        const addr = log.args.issuer.toLowerCase();
        if (!removed.has(addr) && !seen.has(addr)) {
          seen.add(addr);
          const isAuth = await contract.authorizedIssuers(log.args.issuer);
          if (isAuth) list.push({ address: log.args.issuer, addedBy: log.args.addedBy, isYou: addr === account.toLowerCase() });
        }
      }
      const youIncluded = list.some((i) => i.address.toLowerCase() === account.toLowerCase());
      if (!youIncluded) {
        const isAuth = await contract.authorizedIssuers(account);
        if (isAuth) list.unshift({ address: account, addedBy: null, isYou: true });
      }
      setIssuers(list);
    } catch (err) {
      toast.error("Failed to load issuers: " + err.message);
    } finally { setLoadingIssue(false); }
  }, [account, getContract]);

  useEffect(() => {
    if (account && !checkingAuth) { loadCerts(); loadIssuers(); }
  }, [account, checkingAuth, loadCerts, loadIssuers]);

  const handleRevoke = async (hash) => {
    if (!account) { toast.error("Connect wallet first"); return; }
    const authorized = await checkIssuer(account).catch(() => false);
    if (!authorized) { toast.error("Not an authorized issuer — action blocked"); return; }
    setRevoking(hash);
    try {
      const contract = await getContract(true);
      const tx = await contract.revokeCertificate(hash);
      toast.loading("Waiting for confirmation...", { id: "revoke" });
      await tx.wait();
      toast.success("Certificate revoked on-chain", { id: "revoke" });
      setCerts((p) => p.map((c) => (c.hash === hash ? { ...c, valid: false } : c)));
    } catch (err) {
      toast.error(err.reason || err.message, { id: "revoke" });
    } finally { setRevoking(null); }
  };

  const handleAddIssuer = async () => {
    if (!newAddr) { toast.error("Enter a wallet address"); return; }
    if (!account) { toast.error("Connect wallet first"); return; }
    const ownerOk = await checkOwner(account).catch(() => false);
    if (!ownerOk) { toast.error("Only the contract owner can add issuers"); return; }
    try {
      await addNewIssuer(newAddr);
      setIssuers((p) => [...p, { address: newAddr, addedBy: account, isYou: false, label: newLabel }]);
      setNewAddr(""); setNewLabel("");
    } catch (_) {}
  };

  const handleRemoveIssuer = async (address) => {
    if (!account) { toast.error("Connect wallet first"); return; }
    const ownerOk = await checkOwner(account).catch(() => false);
    if (!ownerOk) { toast.error("Only the contract owner can remove issuers"); return; }
    try {
      const contract = await getContract(true);
      const tx = await contract.removeIssuer(address);
      toast.loading("Waiting for confirmation...", { id: "remove" });
      await tx.wait();
      toast.success("Issuer removed", { id: "remove" });
      setIssuers((p) => p.filter((i) => i.address.toLowerCase() !== address.toLowerCase()));
    } catch (err) {
      toast.error(err.reason || err.message, { id: "remove" });
    }
  };

  /* ── Early returns ── */
  if (!account) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px" }}>
      <EmptyState icon="🔌" message="Connect your wallet to manage certificates and issuers" />
    </div>
  );

  if (checkingAuth) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px" }}>
      <Card style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 24px" }}>
        <Spinner />
        <span style={{ color: "var(--muted)", fontSize: 14 }}>Checking authorization status...</span>
      </Card>
    </div>
  );

  if (!isAuthorized) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px" }}>
      <Card style={{ textAlign: "center", padding: "48px 20px", border: "1px solid rgba(239,68,68,0.3)" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, margin: "0 auto 16px",
        }}>✗</div>
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Access Denied</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px" }}>
          Only registered issuers can access the manage panel.
        </p>
        <p style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          background: "var(--bg3)", padding: "8px 12px", borderRadius: 8,
          display: "inline-block", color: "var(--muted)",
          wordBreak: "break-all", maxWidth: "100%",
        }}>{account}</p>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "16px 0 0" }}>
          Contact the platform admin to get your address registered.
        </p>
      </Card>
    </div>
  );

  /* ── Main render ── */
  return (
    <>
      <style>{`
        .manage-page { max-width: 900px; margin: 0 auto; padding: 32px 16px; }
        @media (min-width: 640px) { .manage-page { padding: 40px 24px; } }

        /* table: hide on mobile, show on ≥640 */
        .cert-table-wrap { display: none; }
        .cert-cards-wrap { display: flex; flex-direction: column; gap: 10px; }
        @media (min-width: 640px) {
          .cert-table-wrap { display: block; overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
          .cert-cards-wrap { display: none; }
        }

        /* issuers: stack address on small screens */
        .issuer-row { display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(42,45,62,0.4); gap: 10px; }
        .issuer-addr { font-family: 'JetBrains Mono',monospace; font-size: 11px; color: #a78bfa; margin-top: 2px; word-break: break-all; }
        @media (min-width: 480px) { .issuer-addr { word-break: normal; } }

        /* add-issuer form: stack on mobile */
        .add-issuer-form { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
        @media (min-width: 560px) { .add-issuer-form { flex-direction: row; flex-wrap: wrap; align-items: flex-end; } }
        .add-issuer-form .field-label { flex: 1; min-width: 140px; }
        .add-issuer-form .field-addr  { flex: 2; min-width: 200px; }

        /* table cells */
        .mn-th { background: var(--bg3); padding: 10px 14px; text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .mn-td { padding: 12px 14px; border-bottom: 1px solid rgba(42,45,62,0.5); font-size: 13px; }

        /* auth banner */
        .auth-banner { border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; display: flex; align-items: flex-start; gap: 8px; min-width: 0; overflow: hidden; box-sizing: border-box; }
        .auth-banner-text { min-width: 0; flex: 1; line-height: 1.5; word-break: break-word; overflow-wrap: anywhere; }
        .auth-banner-addr { font-family: 'JetBrains Mono',monospace; font-size: 11px; opacity: 0.85; display: inline-block; word-break: break-all; max-width: 100%; }

        /* header row */
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 8px; }
        .refresh-btn { font-size: 12px; color: var(--muted); background: var(--bg3); border: 1px solid var(--border); padding: 5px 10px; border-radius: 7px; cursor: pointer; font-family: inherit; white-space: nowrap; flex-shrink: 0; }
        .refresh-btn:hover { color: #fff; }
      `}</style>

      <div className="manage-page page-enter">
        {/* Page heading */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 6px" }}>⚙️ Manage</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Live data from Sepolia — all changes are on-chain</p>
        </div>

        {/* Auth banner */}
        <div className="auth-banner" style={{
          background: isOwner ? "rgba(167,139,250,0.07)" : "rgba(34,197,94,0.07)",
          border: `1px solid ${isOwner ? "rgba(167,139,250,0.22)" : "rgba(34,197,94,0.22)"}`,
          color: isOwner ? "#a78bfa" : "#22c55e",
        }}>
          <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{isOwner ? "👑" : "✅"}</span>
          <span className="auth-banner-text">
            <strong>{isOwner ? "Contract Owner." : "Authorized Issuer."}</strong>
            {" "}{isOwner
              ? "Full admin access — you can manage issuers and certificates."
              : "You can issue and revoke certificates. Issuer management is restricted to the contract owner."
            }{" "}
            <span className="auth-banner-addr">{shortenAddress(account)}</span>
          </span>
        </div>

        {/* ── Issuers panel ── */}
        <Card style={{ marginBottom: 20 }}>
          <div className="section-header">
            <CardTitle icon="👥">Authorized Issuers</CardTitle>
            <button className="refresh-btn" onClick={loadIssuers}>↻ Refresh</button>
          </div>

          {loadingIssue ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0" }}>
              <Spinner size={18} />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Loading issuers…</span>
            </div>
          ) : issuers.length === 0 ? (
            <EmptyState icon="👤" message="No authorized issuers found in recent blocks" />
          ) : (
            <div>
              {issuers.map((iss) => (
                <div key={iss.address} className="issuer-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {iss.label || (iss.isYou ? "You (Connected Wallet)" : "Issuer")}
                    </div>
                    <div className="issuer-addr">{iss.address}</div>
                    {iss.addedBy && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        Added by: {shortenAddress(iss.addedBy)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {iss.isYou ? (
                      <Badge variant="valid">✓ You</Badge>
                    ) : (
                      <>
                        <Badge variant="info">Issuer</Badge>
                        {isOwner ? (
                          <button style={revokeBtn} onClick={() => handleRemoveIssuer(iss.address)}>Remove</button>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>🔒</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isOwner ? (
            <div className="add-issuer-form">
              <div className="field-label">
                <InputField id="nl" placeholder="Label (optional)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              </div>
              <div className="field-addr">
                <InputField id="na" placeholder="0x... wallet address" value={newAddr} onChange={(e) => setNewAddr(e.target.value)} />
              </div>
              <PrimaryButton onClick={handleAddIssuer}>+ Add Issuer</PrimaryButton>
            </div>
          ) : (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted)", fontStyle: "italic", textAlign: "center" }}>
              🔒 Only the contract owner can add or remove issuers.
            </div>
          )}
        </Card>

        {/* ── Certificates ── */}
        <Card>
          <div className="section-header">
            <CardTitle icon="📋">Issued Certificates</CardTitle>
            <button className="refresh-btn" onClick={loadCerts}>↻ Refresh</button>
          </div>

          {loadingCerts ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0" }}>
              <Spinner size={18} />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Fetching certificates from Sepolia…</span>
            </div>
          ) : certs.length === 0 ? (
            <EmptyState icon="📭" message="No certificates found in the last 10,000 blocks" />
          ) : (
            <>
              {/* Desktop table */}
              <div className="cert-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Recipient","Course","Hash","Issuer","Date","Status","Action"].map((h) => (
                        <th key={h} className="mn-th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {certs.map((c) => (
                      <tr key={c.hash}>
                        <td className="mn-td" style={{ fontWeight: 500 }}>{c.name}</td>
                        <td className="mn-td" style={{ color: "var(--muted)" }}>{c.course}</td>
                        <td className="mn-td">
                          <a href={`https://sepolia.etherscan.io/tx/${c.txHash}`} target="_blank" rel="noreferrer"
                            style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#a78bfa", textDecoration: "none" }}>
                            {c.hash.slice(0, 8)}...{c.hash.slice(-4)} ↗
                          </a>
                        </td>
                        <td className="mn-td" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--muted)" }}>
                          {shortenAddress(c.issuer)}
                        </td>
                        <td className="mn-td" style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{c.date}</td>
                        <td className="mn-td">
                          <Badge variant={c.valid ? "valid" : "revoked"}>{c.valid ? "✓ Valid" : "✗ Revoked"}</Badge>
                        </td>
                        <td className="mn-td">
                          {c.valid ? (
                            <button
                              style={revoking === c.hash ? disabledRevokeBtn : revokeBtn}
                              disabled={revoking === c.hash}
                              onClick={() => handleRevoke(c.hash)}
                            >
                              {revoking === c.hash ? "…" : "Revoke"}
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="cert-cards-wrap">
                {certs.map((c) => (
                  <CertCard key={c.hash} c={c} revoking={revoking} onRevoke={handleRevoke} />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
};

export default Manage;