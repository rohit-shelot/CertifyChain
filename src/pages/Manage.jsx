import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import QRCode from "react-qr-code";
import { useNavigate } from "react-router-dom";
import { Card, CardTitle, InputField, PrimaryButton, Badge, Spinner, EmptyState } from "../components/UI";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import { CONTRACT_ADDRESS, CONTRACT_DEPLOYMENT_BLOCK, SEPOLIA_RPC } from "../utils/contractConfig";
import { shortenAddress, queryFilterChunked } from "../utils/ethers";
import { batchVerifyCertificates, batchGetBlocks } from "../utils/multicall";
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
        { "internalType": "bool",    "name": "isValid",   "type": "bool"    },
        { "internalType": "bool",    "name": "isEdited",  "type": "bool"    }
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

/* ── IPFS gateways to try in order (X-Frame-Options varies by gateway) ── */
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

/* ── CertPreview: tries multiple gateways, shows spinner, graceful fallback ── */
const CertPreview = ({ ipfsHash, height = 280 }) => {
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [allFailed, setAllFailed]   = useState(false);

  // Reset when ipfsHash changes
  useEffect(() => {
    setGatewayIdx(0);
    setLoading(true);
    setAllFailed(false);
  }, [ipfsHash]);

  if (!ipfsHash) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        height: "100%", minHeight: height, gap: 14,
        color: "var(--muted)", padding: 32, textAlign: "center",
      }}>
        <span style={{ fontSize: 48, opacity: 0.4 }}>📂</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No File Attached</p>
          <p style={{ fontSize: 12, margin: 0, opacity: 0.6 }}>This certificate was issued without an attached PDF document.</p>
        </div>
      </div>
    );
  }

  if (allFailed) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        height: "100%", minHeight: height, gap: 16,
        color: "var(--muted)", padding: 32, textAlign: "center",
      }}>
        <span style={{ fontSize: 44, opacity: 0.5 }}>🔒</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px", color: "#f87171" }}>Preview Blocked</p>
          <p style={{ fontSize: 12, margin: "0 0 16px", opacity: 0.7, lineHeight: 1.6 }}>
            All IPFS gateways blocked iframe embedding.<br />Open the certificate in a new tab to view it.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 240 }}>
          {IPFS_GATEWAYS.map((gw, i) => (
            <a
              key={i}
              href={`${gw}${ipfsHash}`}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12, padding: "8px 16px", borderRadius: 8,
                background: "rgba(124,109,250,0.12)", border: "1px solid rgba(124,109,250,0.3)",
                color: "#a78bfa", textDecoration: "none", display: "block",
                transition: "background 0.2s",
              }}
            >
              ↗ {gw.replace("https://", "").replace("/ipfs/", "")}
            </a>
          ))}
        </div>
      </div>
    );
  }

  const currentUrl = `${IPFS_GATEWAYS[gatewayIdx]}${ipfsHash}`;

  const handleError = () => {
    if (gatewayIdx + 1 < IPFS_GATEWAYS.length) {
      setGatewayIdx(g => g + 1);
      setLoading(true);
    } else {
      setAllFailed(true);
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: height }}>
      {loading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12,
          background: "rgba(0,0,0,0.25)",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            border: "3px solid rgba(124,109,250,0.2)",
            borderTopColor: "#a78bfa",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Loading from gateway {gatewayIdx + 1}/{IPFS_GATEWAYS.length}…
          </span>
        </div>
      )}
      <iframe
        key={currentUrl}
        src={`${currentUrl}#toolbar=0&navpanes=0&view=Fit`}
        title="Certificate Preview"
        onLoad={() => setLoading(false)}
        onError={handleError}
        scrolling="no"
        style={{
          width: "100%", height: "100%", border: "none",
          display: "block", minHeight: height,
          background: "#fff",
          opacity: loading ? 0 : 1,
          transition: "opacity 0.3s",
          overflow: "hidden",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

/* ── CertCard ── */
const CertCard = ({ c, revoking, onRevoke, onCopyLink, onVerify, onEdit }) => {
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
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
            {c.name}
            {c.isEdited && (
              <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", marginLeft: 6, fontWeight: "normal" }}>
                (edited)
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{displayCourse}</div>
          {certId && <div style={{ fontSize: 11, color: "var(--muted)", opacity: 0.7 }}>ID: {certId}</div>}
        </div>
        <Badge variant={c.valid ? "valid" : "revoked"}>
          {c.valid ? `✓ Valid${c.isEdited ? " (Edited)" : ""}` : "✗ Revoked"}
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

        {/* Edit */}
        {c.valid && (
          <button
            onClick={() => onEdit(c)}
            style={{
              fontSize: 12, padding: "5px 12px", borderRadius: 7, cursor: "pointer",
              fontFamily: "inherit", background: "rgba(234,179,8,0.1)",
              border: "1px solid rgba(234,179,8,0.3)", color: "#eab308",
            }}
          >
            ✏️ Edit
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
  const { addNewIssuer, edit } = useContract();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [certs,        setCerts]        = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(true);
  const [revoking,     setRevoking]     = useState(null);

  // States for edit modal
  const [editingCert, setEditingCert] = useState(null);
  const [editForm, setEditForm]       = useState({ name: "", email: "", course: "", institution: "", grade: "", issueDate: "" });
  const [savingEdit, setSavingEdit]   = useState(false);

  const getSignerContract = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask not found");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  }, []);

  /* Auth check */
  useEffect(() => {
    if (!account) {
      setCheckingAuth(false);
    } else {
      setCheckingAuth(false);
    }
  }, [account]);

  /* Load MY certificates (filter by issuer = account) */
  const loadCerts = useCallback(async () => {
    if (!account) return;
    setLoadingCerts(true);
    try {
      const provider  = new ethers.JsonRpcProvider(SEPOLIA_RPC);
      const contract  = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const fromBlock = CONTRACT_DEPLOYMENT_BLOCK;

      /* Fetch certificates issued by this account */
      const filter = contract.filters.CertificateIssued(null, null, null, account);
      const logs   = await queryFilterChunked(contract, filter, fromBlock, "latest", provider);

      if (logs.length === 0) {
        setCerts([]);
        setLoadingCerts(false);
        return;
      }

      // Batch all verifyCertificate calls via Multicall3
      const certHashes = logs.map((log) => log.args?.[0] || log.topics?.[1]);
      const certDataMap = await batchVerifyCertificates(certHashes, provider);

      // Batch all getBlock calls — deduplicate
      const blockNumbers = logs.map((log) => log.blockNumber);
      const blockMap = await batchGetBlocks(blockNumbers, provider);

      const parsed = logs.map((log) => {
        const hash = log.args?.[0] || log.topics?.[1];
        let name = log.args?.[1] || log.args?.name || "";
        let course = log.args?.[2] || log.args?.course || "";
        let ipfsHash = "";
        let rawDate = 0;
        let isValid = false;
        let isEdited = false;

        const certData = certDataMap.get(hash);
        if (certData) {
          isValid = certData.isValid;
          isEdited = certData.isEdited;
          name = certData.name || name;
          course = certData.course || course;
          ipfsHash = certData.ipfsHash;
          rawDate = Number(certData.issueDate) * 1000;
        }

        if (!rawDate) {
          const block = blockMap.get(log.blockNumber);
          rawDate = block ? Number(block.timestamp) * 1000 : Date.now();
        }

        return {
          hash, name, course, ipfsHash,
          issuer: log.args?.[3] || log.args?.issuer || "",
          date: new Date(rawDate).toLocaleDateString("en-IN"),
          rawDate,
          txHash: log.transactionHash,
          valid: isValid,
          isEdited: isEdited,
        };
      });

      const map = new Map();
      parsed.forEach((c) => map.set(c.hash, c));
      setCerts([...map.values()].reverse());
    } catch (err) {
      toast.error("Failed to load certificates: " + err.message);
    } finally { setLoadingCerts(false); }
  }, [account]);

  const handleOpenEdit = (c) => {
    let rawCourse = c.course;
    if (c.course.includes(" | ID: ")) {
      rawCourse = c.course.split(" | ID: ")[0];
    }

    setEditingCert(c);
    setEditForm({
      name: c.name,
      email: "",
      course: rawCourse,
      institution: "",
      grade: "",
      issueDate: "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCert) return;
    setSavingEdit(true);
    try {
      let originalId = "";
      if (editingCert.course.includes(" | ID: ")) {
        originalId = editingCert.course.split(" | ID: ")[1];
      }
      const combinedCourse = originalId ? `${editForm.course} | ID: ${originalId}` : editForm.course;

      await edit({
        certHash: editingCert.hash,
        name: editForm.name,
        course: combinedCourse,
        file: null,
        existingIpfsHash: editingCert.ipfsHash,
      });

      setEditingCert(null);
      await loadCerts();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    if (account && !checkingAuth) {
      loadCerts();
    }
  }, [account, checkingAuth, loadCerts]);

  const handleRevoke = async (hash) => {
    if (!account) { toast.error("Connect wallet first"); return; }
    setRevoking(hash);
    try {
      const contract = await getSignerContract();
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

        /* Edit modal: split layout responsive */
        .edit-modal-body { display: grid; grid-template-columns: 1fr 1fr; min-height: 480px; }
        @media (max-width: 700px) {
          .edit-modal-body { grid-template-columns: 1fr; }
          .edit-modal-preview { border-top: 1px solid var(--border); border-right: none !important; min-height: 280px; }
        }
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
                  onEdit={handleOpenEdit}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Edit Modal ── */}
      {editingCert && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
          overflowY: "auto",
        }}>
          <div style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 20, width: "100%", maxWidth: 1120,
            display: "flex", flexDirection: "column",
            margin: "auto", overflow: "hidden",
            maxHeight: "92vh",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          }}>

            {/* ── Modal Header ── */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "16px 24px", borderBottom: "1px solid var(--border)",
              background: "rgba(255,255,255,0.015)",
              flexShrink: 0,
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  ✏️ Edit Certificate
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 10px",
                    borderRadius: 99, background: "rgba(234,179,8,0.15)", color: "#eab308",
                    border: "1px solid rgba(234,179,8,0.3)",
                  }}>EDITING</span>
                </h3>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                  Updating details for <strong style={{ color: "#a78bfa" }}>{editingCert.name}</strong> — MetaMask confirmation required.
                </p>
              </div>
              <button
                onClick={() => setEditingCert(null)}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--muted)", cursor: "pointer", fontSize: 18, lineHeight: 1,
                  padding: "6px 10px", borderRadius: 8, transition: "all 0.2s",
                }}
              >✕</button>
            </div>

            {/* ── Modal Body: Side-by-side (LEFT Form 40% + RIGHT Preview 60%) ── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "40% 60%",
              height: "60vh",
              minHeight: 380,
              flex: 1,
              overflow: "hidden",
            }}>

              {/* ── LEFT: Edit Form ── */}
              <div style={{
                padding: "24px 28px",
                borderRight: "1px solid var(--border)",
                display: "flex", flexDirection: "column", gap: 16,
                overflowY: "auto",
              }}>

                {/* Notice banner */}
                <div style={{
                  background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)",
                  borderRadius: 10, padding: "9px 14px", fontSize: 11.5, color: "#fbbf24",
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <span>⚠️</span>
                  <span>
                    Only <strong>Recipient Name</strong> and <strong>Course / Credential</strong> are stored on-chain.
                    The certificate file cannot be replaced — only text fields can be updated.
                  </span>
                </div>

                {/* Fields — stacked vertically for clear side panel readability */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* Recipient Name */}
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Recipient Name *</label>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Full name of the certificate recipient"
                      style={{
                        width: "100%", padding: "9px 13px", borderRadius: 9, fontSize: 13,
                        background: "var(--bg3)", border: "1px solid var(--border)", color: "#fff",
                        fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={e => e.target.style.borderColor = "#a78bfa"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@example.com"
                      style={{
                        width: "100%", padding: "9px 13px", borderRadius: 9, fontSize: 13,
                        background: "var(--bg3)", border: "1px solid var(--border)", color: "#fff",
                        fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={e => e.target.style.borderColor = "#a78bfa"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"}
                    />
                  </div>

                  {/* Course */}
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>College / Course / Credential *</label>
                    <input
                      value={editForm.course}
                      onChange={(e) => setEditForm(f => ({ ...f, course: e.target.value }))}
                      placeholder="B.Tech Computer Science"
                      style={{
                        width: "100%", padding: "9px 13px", borderRadius: 9, fontSize: 13,
                        background: "var(--bg3)", border: "1px solid var(--border)", color: "#fff",
                        fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={e => e.target.style.borderColor = "#a78bfa"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"}
                    />
                  </div>

                  {/* Institution */}
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Institution / Org</label>
                    <input
                      value={editForm.institution}
                      onChange={(e) => setEditForm(f => ({ ...f, institution: e.target.value }))}
                      placeholder="Institution / Org"
                      style={{
                        width: "100%", padding: "9px 13px", borderRadius: 9, fontSize: 13,
                        background: "var(--bg3)", border: "1px solid var(--border)", color: "#fff",
                        fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={e => e.target.style.borderColor = "#a78bfa"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"}
                    />
                  </div>

                  {/* Grade */}
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Grade / Score</label>
                    <input
                      value={editForm.grade}
                      onChange={(e) => setEditForm(f => ({ ...f, grade: e.target.value }))}
                      placeholder="A+ / 9.5 CGPA"
                      style={{
                        width: "100%", padding: "9px 13px", borderRadius: 9, fontSize: 13,
                        background: "var(--bg3)", border: "1px solid var(--border)", color: "#fff",
                        fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={e => e.target.style.borderColor = "#a78bfa"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"}
                    />
                  </div>

                  {/* Issue Date */}
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Issue Date</label>
                    <input
                      type="date"
                      value={editForm.issueDate}
                      onChange={(e) => setEditForm(f => ({ ...f, issueDate: e.target.value }))}
                      style={{
                        width: "100%", padding: "9px 13px", borderRadius: 9, fontSize: 13,
                        background: "var(--bg3)", border: "1px solid var(--border)", color: "#fff",
                        fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                        colorScheme: "dark", transition: "border-color 0.2s",
                      }}
                      onFocus={e => e.target.style.borderColor = "#a78bfa"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"}
                    />
                  </div>

                </div>

                {/* Lock notice */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                  background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)",
                  borderRadius: 10, fontSize: 11.5, color: "#f87171",
                }}>
                  <span style={{ fontSize: 15 }}>🔒</span>
                  <span>The certificate file is <strong>locked</strong> — it cannot be replaced. Only the text fields above can be updated.</span>
                </div>

              </div>

              {/* ── RIGHT: Certificate Preview ── */}
              <div style={{
                display: "flex", flexDirection: "column",
                background: "rgba(0,0,0,0.25)",
                overflow: "hidden",
              }}>

                {/* Preview header */}
                <div style={{
                  padding: "11px 20px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(255,255,255,0.02)",
                }}>
                  <span style={{ fontSize: 14 }}>📄</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Preview</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                    background: "rgba(74,240,196,0.1)", color: "#4af0c4",
                    border: "1px solid rgba(74,240,196,0.25)",
                  }}>LIVE</span>
                  <div style={{ flex: 1 }} />
                  {editingCert.ipfsHash && (
                    <a
                      href={`https://ipfs.io/ipfs/${editingCert.ipfsHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 11, padding: "4px 12px", borderRadius: 7,
                        background: "rgba(124,109,250,0.12)", border: "1px solid rgba(124,109,250,0.3)",
                        color: "#a78bfa", textDecoration: "none", whiteSpace: "nowrap",
                      }}
                    >↗ Full</a>
                  )}
                </div>

                {/* Preview body — stretches fully inside the grid row */}
                <div style={{ flex: 1, position: "relative" }}>
                  <CertPreview ipfsHash={editingCert.ipfsHash} height="100%" />
                </div>

              </div>

            </div>

            {/* ── Modal Footer: Action buttons ── */}
            <div style={{
              display: "flex", gap: 10, justifyContent: "flex-end",
              padding: "16px 24px", borderTop: "1px solid var(--border)",
              background: "rgba(255,255,255,0.015)",
              flexShrink: 0,
            }}>
              <button
                onClick={() => setEditingCert(null)}
                disabled={savingEdit}
                style={{
                  fontSize: 13, padding: "9px 20px", borderRadius: 9, cursor: "pointer",
                  fontFamily: "inherit", background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--muted)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || !editForm.name || !editForm.course}
                style={{
                  fontSize: 13, padding: "9px 22px", borderRadius: 9,
                  cursor: (savingEdit || !editForm.name || !editForm.course) ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: (savingEdit || !editForm.name || !editForm.course) ? 0.5 : 1,
                  background: "linear-gradient(135deg,#eab308,#f59e0b)", border: "none", color: "#000", fontWeight: 700,
                }}
              >
                {savingEdit ? "Saving…" : "💾 Save Changes"}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default Manage;