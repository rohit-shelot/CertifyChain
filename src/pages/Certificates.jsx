import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useNavigate } from "react-router-dom";
import { Card, Spinner, EmptyState, Badge } from "../components/UI";
import { CONTRACT_ADDRESS, CONTRACT_DEPLOYMENT_BLOCK } from "../utils/contractConfig";
import { shortenAddress } from "../utils/ethers";
import { useWallet } from "../context/WalletContext";
import { useContract } from "../hooks/useContract";
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
  }
];

const styles = {
  page: { maxWidth: 1000, margin: "0 auto", padding: "40px 24px" },
  header: { marginBottom: 32 },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 6px" },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0 },
  toolbar: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
  searchBox: { flex: 1, minWidth: 200, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none" },
  filterSelect: { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--muted)", fontFamily: "inherit", outline: "none", cursor: "pointer" },
  refreshBtn: { fontSize: 12, color: "var(--muted)", background: "var(--bg3)", border: "1px solid var(--border)", padding: "9px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  statsRow: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  statCard: { flex: 1, minWidth: 120, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px" },
  statNum: { fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 4 },
  statLabel: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 },
  certCard: { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", cursor: "pointer", transition: "border-color 0.15s, transform 0.15s", position: "relative", overflow: "hidden" },
  certCardAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #a78bfa, #60a5fa)", borderRadius: "12px 12px 0 0" },
  certCardAccentRevoked: { position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #ef4444, #f97316)", borderRadius: "12px 12px 0 0" },
  certName: { fontSize: 15, fontWeight: 600, marginBottom: 4, marginTop: 6, letterSpacing: "-0.02em" },
  certCourse: { fontSize: 13, color: "#a78bfa", marginBottom: 12, fontWeight: 500 },
  certMeta: { display: "flex", flexDirection: "column", gap: 5 },
  certMetaRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 },
  certMetaLabel: { color: "var(--muted)" },
  certMetaValue: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text)" },
  certFooter: { marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(42,45,62,0.4)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  viewBtn: { fontSize: 12, color: "#a78bfa", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" },
  emptySearch: { textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 14 },
};

const Certificates = () => {
  const navigate = useNavigate();
  const { account } = useWallet();
  const { checkOwner } = useContract();

  const [isOwner,  setIsOwner]  = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [certs,       setCerts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("all");

  useEffect(() => {
    const verifyOwner = async () => {
      if (!account) { setIsOwner(false); setCheckingAuth(false); return; }
      setCheckingAuth(true);
      try {
        const ok = await checkOwner(account);
        setIsOwner(ok);
      } catch (_) {
        setIsOwner(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    verifyOwner();
  }, [account, checkOwner]);

  // ── Load certs (only when registered) ───────────────────────────────────────
  const getContract = useCallback(() => {
    if (!window.ethereum) throw new Error("MetaMask not found");
    const provider = new ethers.BrowserProvider(window.ethereum);
    return Promise.resolve(new ethers.Contract(CONTRACT_ADDRESS, ABI, provider));
  }, []);

  const loadCerts = useCallback(async () => {
    setLoading(true);
    try {
      const contract  = await getContract();
      const provider  = new ethers.BrowserProvider(window.ethereum);
      const fromBlock = CONTRACT_DEPLOYMENT_BLOCK;
      const logs      = await contract.queryFilter(
        contract.filters.CertificateIssued(), fromBlock, "latest"
      );

      const parsed = await Promise.all(
        logs.map(async (log) => {
          let isValid   = false;
          let isEdited  = false;
          let name      = log.args.name;
          let course    = log.args.course;
          let ipfsHash  = "";
          let issueDate = null;

          try {
            const cert = await contract.verifyCertificate(log.args.certHash);
            isValid   = cert[5];
            isEdited  = cert[6];
            name      = cert[0] || name;
            course    = cert[1] || course;
            ipfsHash  = cert[2];
            issueDate = cert[3];
          } catch (_) {}

          let certId = null;
          if (course && course.includes(" | ID: ")) {
            const parts = course.split(" | ID: ");
            course = parts[0];
            certId = parts[1];
          }

          const block = await provider.getBlock(log.blockNumber);
          const ts    = issueDate
            ? Number(issueDate) * 1000
            : Number(block.timestamp) * 1000;

          return {
            hash:        log.args.certHash,
            name, course, ipfsHash, certId,
            issuer:      log.args.issuer,
            date:        new Date(ts).toLocaleDateString("en-IN"),
            dateRaw:     ts,
            txHash:      log.transactionHash,
            blockNumber: log.blockNumber,
            valid:       isValid,
            isEdited:    isEdited,
          };
        })
      );

      const map = new Map();
      parsed.forEach((c) => map.set(c.hash, c));
      setCerts([...map.values()].reverse());
    } catch (err) {
      toast.error("Failed to load certificates: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  useEffect(() => {
    if (isOwner) loadCerts();
  }, [isOwner, loadCerts]);

  const filtered = certs.filter((c) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "valid"   && c.valid) ||
      (filter === "revoked" && !c.valid);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q)   ||
      c.course.toLowerCase().includes(q) ||
      c.hash.toLowerCase().includes(q)   ||
      c.issuer.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const totalValid   = certs.filter((c) => c.valid).length;
  const totalRevoked = certs.filter((c) => !c.valid).length;

  if (!account) {
    return (
      <div style={styles.page} className="page-enter">
        <Card style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Wallet Not Connected</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Please connect your wallet to view certificates.
          </p>
        </Card>
      </div>
    );
  }

  if (checkingAuth) {
    return (
      <div style={styles.page} className="page-enter">
        <Card style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 24px" }}>
          <Spinner />
          <span style={{ color: "var(--muted)", fontSize: 14 }}>Checking permissions...</span>
        </Card>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div style={styles.page} className="page-enter">
        <Card style={{ textAlign: "center", padding: "48px 24px", border: "1px solid rgba(239,68,68,0.3)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, margin: "0 auto 16px",
          }}>✗</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Access Denied</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px" }}>
            Only the Smart Contract Owner can access the Explorer.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.page} className="page-enter">
      <div style={styles.header}>
        <h2 style={styles.title}>📜 Issued Certificates</h2>
        <p style={styles.subtitle}>All certificates issued on Sepolia — last 10,000 blocks</p>
      </div>

      {!loading && certs.length > 0 && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statNum, color: "var(--text)" }}>{certs.length}</div>
            <div style={styles.statLabel}>Total Issued</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statNum, color: "#22c55e" }}>{totalValid}</div>
            <div style={styles.statLabel}>Valid</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statNum, color: "#ef4444" }}>{totalRevoked}</div>
            <div style={styles.statLabel}>Revoked</div>
          </div>
        </div>
      )}

      <div style={styles.toolbar}>
        <input
          style={styles.searchBox}
          placeholder="Search by name, course, hash or issuer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={styles.filterSelect} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="valid">Valid Only</option>
          <option value="revoked">Revoked Only</option>
        </select>
        <button style={styles.refreshBtn} onClick={loadCerts}>↻ Refresh</button>
      </div>

      {loading ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "24px 0" }}>
            <Spinner size={18} />
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Fetching certificates from Sepolia…</span>
          </div>
        </Card>
      ) : certs.length === 0 ? (
        <EmptyState icon="📭" message="No certificates found in the last 10,000 blocks" />
      ) : filtered.length === 0 ? (
        <div style={styles.emptySearch}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          No certificates match your search.
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((c) => (
            <CertCard
              key={c.hash}
              cert={c}
              onClick={() => navigate(`/certificates/${encodeURIComponent(c.hash)}`, { state: { cert: c } })}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CertCard = ({ cert: c, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...styles.certCard,
        borderColor: hovered ? (c.valid ? "rgba(167,139,250,0.5)" : "rgba(239,68,68,0.4)") : "var(--border)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={c.valid ? styles.certCardAccent : styles.certCardAccentRevoked} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
        <Badge variant={c.valid ? "valid" : "revoked"}>{c.valid ? "✓ Valid" : "✗ Revoked"}</Badge>
      </div>
      <div style={styles.certName}>
        {c.name}
        {c.isEdited && (
          <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", marginLeft: 6, fontWeight: "normal" }}>
            (edited)
          </span>
        )}
      </div>
      <div style={styles.certCourse}>{c.course}</div>
      <div style={styles.certMeta}>
        <div style={styles.certMetaRow}>
          <span style={styles.certMetaLabel}>ID</span>
          <span style={styles.certMetaValue}>{c.certId || "Not Found"}</span>
        </div>
        <div style={styles.certMetaRow}>
          <span style={styles.certMetaLabel}>Issuer</span>
          <span style={styles.certMetaValue}>{shortenAddress(c.issuer)}</span>
        </div>
        <div style={styles.certMetaRow}>
          <span style={styles.certMetaLabel}>Date</span>
          <span style={styles.certMetaValue}>{c.date}</span>
        </div>
        <div style={styles.certMetaRow}>
          <span style={styles.certMetaLabel}>Hash</span>
          <span style={styles.certMetaValue}>{c.hash.slice(0, 8)}…{c.hash.slice(-6)}</span>
        </div>
      </div>
      <div style={styles.certFooter}>
        <a
          href={`https://sepolia.etherscan.io/tx/${c.txHash}`}
          target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}
        >
          View on Etherscan ↗
        </a>
        <button style={styles.viewBtn}>View Details →</button>
      </div>
    </div>
  );
};

export default Certificates;