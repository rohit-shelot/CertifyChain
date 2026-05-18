import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import QRCode from "react-qr-code";
import { useNavigate } from "react-router-dom";
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
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view", "type": "function"
  }
];

/* ── CertCard ── */
const CertCard = ({ c, revoking, onRevoke, onCopyLink, onVerify }) => {
  const [showQR, setShowQR] = useState(false);
  const verifyUrl = `${window.location.origin}/verify?hash=${c.hash}`;

  const displayCourse = c.course.includes(" | ID: ")
    ? c.course.split(" | ID: ")[0]
    : c.course;
  const certId = c.course.includes(" | ID: ")
    ? c.course.split(" | ID: ")[1]
    : null;

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${c.valid ? "rgba(255,255,255,0.07)" : "rgba(239,68,68,0.15)"}`,
      borderRadius: 12,
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{c.name}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{displayCourse}</div>
          {certId && <div style={{ fontSize: 11, color: "var(--muted)", opacity: 0.7 }}>ID: {certId}</div>}
        </div>
        <Badge variant={c.valid ? "valid" : "revoked"}>
          {c.valid ? "✓ Valid" : "✗ Revoked"}
        </Badge>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px" }}>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          <span style={{ opacity: 0.6 }}>Hash </span>
          <a href={`https://sepolia.etherscan.io/tx/${c.txHash}`} target="_blank" rel="noreferrer"
            style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a78bfa", textDecoration: "none" }}>
            {c.hash.slice(0, 8)}…{c.hash.slice(-4)} ↗
          </a>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          <span style={{ opacity: 0.6 }}>Date </span>{c.date}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        {/* Copy link */}
        <button
          onClick={() => onCopyLink(verifyUrl)}
          style={{
            fontSize: 12, padding: "5px 12px", borderRadius: 7, cursor: "pointer",
            fontFamily: "inherit", background: "rgba(124,109,250,0.1)",
            border: "1px solid rgba(124,109,250,0.3)", color: "#a78bfa",
          }}
        >
          🔗 Copy Link
        </button>

        {/* QR toggle */}
        <button
          onClick={() => setShowQR(v => !v)}
          style={{
            fontSize: 12, padding: "5px 12px", borderRadius: 7, cursor: "pointer",
            fontFamily: "inherit", background: "rgba(74,240,196,0.08)",
            border: "1px solid rgba(74,240,196,0.25)", color: "#4af0c4",
          }}
        >
          {showQR ? "Hide QR" : "Show QR"}
        </button>

        {/* Verify toggle */}
        <button
          onClick={() => onVerify(c.hash)}
          style={{
            fontSize: 12, padding: "5px 12px", borderRadius: 7, cursor: "pointer",
            fontFamily: "inherit", background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.2)", color: "#fff",
          }}
        >
          🔍 Verify
        </button>

        {/* Revoke */}
        {c.valid && (
          <button
            disabled={revoking === c.hash}
            onClick={() => onRevoke(c.hash)}
            style={{
              fontSize: 12, padding: "5px 12px", borderRadius: 7, cursor: revoking === c.hash ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: revoking === c.hash ? 0.5 : 1,
              background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444",
            }}
          >
            {revoking === c.hash ? "Revoking…" : "✕ Want to Revoke Certificate?"}
          </button>
        )}
      </div>

      {/* QR panel */}
      {showQR && (
        <div style={{
          marginTop: 4, padding: "14px", borderRadius: 10,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 10 }}>
            <QRCode value={verifyUrl} size={120} />
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--muted)", wordBreak: "break-all", textAlign: "center" }}>
            {verifyUrl}
          </span>
        </div>
      )}
    </div>
  );
};

/* ── Main component ── */
const Manage = () => {
  const navigate = useNavigate();
  const { account }                = useWallet();
  const { addNewIssuer, checkOwner } = useContract();

  const [isOwner,      setIsOwner]      = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [certs,        setCerts]        = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(true);
  const [issuers,      setIssuers]      = useState([]);
  const [loadingIssue, setLoadingIssue] = useState(false);
  const [newAddr,      setNewAddr]      = useState("");
  const [newLabel,     setNewLabel]     = useState("");
  const [revoking,     setRevoking]     = useState(null);

  const getContract = useCallback((signer = false) => {
    if (!window.ethereum) throw new Error("MetaMask not found");
    const provider = new ethers.BrowserProvider(window.ethereum);
    if (signer) {
      return provider.getSigner().then((s) => new ethers.Contract(CONTRACT_ADDRESS, ABI, s));
    }
    return Promise.resolve(new ethers.Contract(CONTRACT_ADDRESS, ABI, provider));
  }, []);

  /* Auth check */
  useEffect(() => {
    const check = async () => {
      if (!account) { setIsOwner(false); setCheckingAuth(false); return; }
      setCheckingAuth(true);
      try {
        const ownerOk = await checkOwner(account);
        setIsOwner(ownerOk);
      } catch (_) {
        setIsOwner(false);
      } finally { setCheckingAuth(false); }
    };
    check();
  }, [account, checkOwner]);

  /* Load MY certificates (filter by issuer = account) */
  const loadCerts = useCallback(async () => {
    if (!account) return;
    setLoadingCerts(true);
    try {
      const contract  = await getContract();
      const provider  = new ethers.BrowserProvider(window.ethereum);
      const current   = await provider.getBlockNumber();
      const fromBlock = Math.max(0, current - 50000);

      /* filter by issuer topic directly */
      const filter = contract.filters.CertificateIssued(null, null, null, account);
      const logs   = await contract.queryFilter(filter, fromBlock, "latest");

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
  }, [account, getContract]);

  /* Load issuers (owner only) */
  const loadIssuers = useCallback(async () => {
    if (!account || !isOwner) return;
    setLoadingIssue(true);
    try {
      const contract  = await getContract();
      const provider  = new ethers.BrowserProvider(window.ethereum);
      const current   = await provider.getBlockNumber();
      const fromBlock = Math.max(0, current - 50000);
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
          if (isAuth) list.push({ address: log.args.issuer, addedBy: log.args.addedBy });
        }
      }
      setIssuers(list);
    } catch (err) {
      toast.error("Failed to load issuers: " + err.message);
    } finally { setLoadingIssue(false); }
  }, [account, isOwner, getContract]);

  useEffect(() => {
    if (account && !checkingAuth) {
      loadCerts();
      if (isOwner) loadIssuers();
    }
  }, [account, checkingAuth, isOwner, loadCerts, loadIssuers]);

  const handleRevoke = async (hash) => {
    if (!account) { toast.error("Connect wallet first"); return; }
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

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied!"));
  };

  const handleVerifyRoute = (hash) => {
    navigate(`/verify?hash=${hash}`);
  };

  const handleAddIssuer = async () => {
    if (!newAddr) { toast.error("Enter a wallet address"); return; }
    try {
      await addNewIssuer(newAddr);
      setIssuers((p) => [...p, { address: newAddr, addedBy: account, label: newLabel }]);
      setNewAddr(""); setNewLabel("");
    } catch (_) {}
  };

  const handleRemoveIssuer = async (address) => {
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

  /* ── No wallet ── */
  if (!account) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px" }}>
      <EmptyState icon="🔌" message="Connect your wallet to manage your issued certificates" />
    </div>
  );

  if (checkingAuth) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px" }}>
      <Card style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 24px" }}>
        <Spinner />
        <span style={{ color: "var(--muted)", fontSize: 14 }}>Loading your dashboard…</span>
      </Card>
    </div>
  );

  /* ── Main ── */
  return (
    <>
      <style>{`
        .manage-page { max-width: 900px; margin: 0 auto; padding: 32px 16px; }
        @media (min-width: 640px) { .manage-page { padding: 40px 24px; } }

        .cert-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 640px) { .cert-grid { grid-template-columns: repeat(2, 1fr); } }

        .issuer-row { display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(42,45,62,0.4); gap: 10px; }
        .issuer-addr { font-family: 'JetBrains Mono',monospace; font-size: 11px; color: #a78bfa; margin-top: 2px; word-break: break-all; }

        .add-issuer-form { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
        @media (min-width: 560px) { .add-issuer-form { flex-direction: row; flex-wrap: wrap; align-items: flex-end; } }
        .add-issuer-form .field-label { flex: 1; min-width: 140px; }
        .add-issuer-form .field-addr  { flex: 2; min-width: 200px; }

        .mn-th { background: var(--bg3); padding: 10px 14px; text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .mn-td { padding: 12px 14px; border-bottom: 1px solid rgba(42,45,62,0.5); font-size: 13px; }

        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 8px; }
        .refresh-btn { font-size: 12px; color: var(--muted); background: var(--bg3); border: 1px solid var(--border); padding: 5px 10px; border-radius: 7px; cursor: pointer; font-family: inherit; white-space: nowrap; flex-shrink: 0; }
        .refresh-btn:hover { color: #fff; }
      `}</style>

      <div className="manage-page page-enter">
        {/* Page heading */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 6px" }}>
            📋 My Certificates
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            All certificates you have issued on Sepolia — revoke or share any of them
          </p>
        </div>

        {/* ── Owner Admin Panel ── */}
        {isOwner && (
          <Card style={{ marginBottom: 20, border: "1px solid rgba(167,139,250,0.2)" }}>
            <div className="section-header">
              <CardTitle icon="👑">Admin — Noted Issuers</CardTitle>
              <button className="refresh-btn" onClick={loadIssuers}>↻ Refresh</button>
            </div>

            {loadingIssue ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
                <Spinner size={16} />
                <span style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</span>
              </div>
            ) : issuers.length === 0 ? (
              <EmptyState icon="👤" message="No noted issuers found in recent blocks" />
            ) : (
              <div>
                {issuers.map((iss) => (
                  <div key={iss.address} className="issuer-row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{iss.label || "Issuer"}</div>
                      <div className="issuer-addr">{iss.address}</div>
                      {iss.addedBy && (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          Added by: {shortenAddress(iss.addedBy)}
                        </div>
                      )}
                    </div>
                    <button
                      style={{
                        fontSize: 12, color: "#ef4444", background: "rgba(239,68,68,0.06)",
                        border: "1px solid rgba(239,68,68,0.25)", padding: "5px 12px",
                        borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                      }}
                      onClick={() => handleRemoveIssuer(iss.address)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="add-issuer-form">
              <div className="field-label">
                <InputField id="nl" placeholder="Label (optional)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              </div>
              <div className="field-addr">
                <InputField id="na" placeholder="0x... wallet address" value={newAddr} onChange={(e) => setNewAddr(e.target.value)} />
              </div>
              <PrimaryButton onClick={handleAddIssuer}>+ Add Noted Issuer</PrimaryButton>
            </div>
          </Card>
        )}

        {/* ── My Certificates ── */}
        <Card>
          <div className="section-header">
            <CardTitle icon="🎓">
              Issued by You
              {!loadingCerts && certs.length > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 600, padding: "2px 8px",
                  borderRadius: 99, background: "rgba(124,109,250,0.15)", color: "#a78bfa",
                }}>
                  {certs.length}
                </span>
              )}
            </CardTitle>
            <button className="refresh-btn" onClick={loadCerts}>↻ Refresh</button>
          </div>

          {loadingCerts ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "32px 0" }}>
              <Spinner size={18} />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Fetching your certificates from Sepolia…</span>
            </div>
          ) : certs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 8 }}>
                You haven't issued any certificates yet.
              </p>
              <p style={{ color: "var(--muted)", fontSize: 12 }}>
                Go to <strong style={{ color: "#a78bfa" }}>Issue Certificate</strong> to create your first one.
              </p>
            </div>
          ) : (
            <div className="cert-grid">
              {certs.map((c) => (
                <CertCard
                  key={c.hash}
                  c={c}
                  revoking={revoking}
                  onRevoke={handleRevoke}
                  onCopyLink={handleCopyLink}
                  onVerify={handleVerifyRoute}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

export default Manage;