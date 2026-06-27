import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Card, CardTitle, Badge, Spinner, EmptyState } from "../components/UI";
import { CONTRACT_ADDRESS, CONTRACT_DEPLOYMENT_BLOCK } from "../utils/contractConfig";
import { formatTimestamp, shortenAddress, queryFilterChunked, getReadOnlyProvider } from "../utils/ethers";
import { batchVerifyCertificates, batchGetBlocks } from "../utils/multicall";
import { loadCachedEvents, saveCachedEvents, clearCachedEvents } from "../utils/eventCache";
import { useWallet } from "../context/WalletContext";
import { useContract } from "../hooks/useContract";

const ABI_WITH_EVENTS = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "bytes32", "name": "certHash",  "type": "bytes32" },
      { "indexed": false, "internalType": "string",  "name": "name",      "type": "string"  },
      { "indexed": false, "internalType": "string",  "name": "course",    "type": "string"  },
      { "indexed": true,  "internalType": "address", "name": "issuer",    "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "CertificateIssued",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "bytes32", "name": "certHash",   "type": "bytes32" },
      { "indexed": true,  "internalType": "address", "name": "revokedBy",  "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp",  "type": "uint256" }
    ],
    "name": "CertificateRevoked",
    "type": "event"
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
    "stateMutability": "view",
    "type": "function"
  }
];

const BADGE_MAP = { issue: "info", verify: "valid", revoke: "revoked" };
const ICON_MAP  = { issue: "🎓", revoke: "🚫" };
const FILTERS   = [
  { key: "all",    label: "All Events" },
  { key: "issue",  label: "Issued"     },
  { key: "revoke", label: "Revoked"    },
];

const AuditLog = () => {
  const { account } = useWallet();
  const { checkIssuer } = useContract();

  const [registered,   setRegistered]   = useState(null);
  const [checkingReg,  setCheckingReg]  = useState(true);
  const [events,       setEvents]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [filter,       setFilter]       = useState("all");

  useEffect(() => {
    const checkRegistration = async () => {
      if (!account) { setRegistered(false); setCheckingReg(false); return; }
      setCheckingReg(true);
      try {
        const ok = await checkIssuer(account);
        setRegistered(ok);
      } catch (_) {
        setRegistered(false);
      } finally {
        setCheckingReg(false);
      }
    };
    checkRegistration();
  }, [account, checkIssuer]);

  const CACHE_ISSUED  = "auditlog_issued";
  const CACHE_REVOKED = "auditlog_revoked";

  const fetchEvents = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const provider  = getReadOnlyProvider();
      const contract  = new ethers.Contract(CONTRACT_ADDRESS, ABI_WITH_EVENTS, provider);

      if (forceRefresh) {
        clearCachedEvents(CACHE_ISSUED);
        clearCachedEvents(CACHE_REVOKED);
      }

      const cachedIssued  = loadCachedEvents(CACHE_ISSUED);
      const cachedRevoked = loadCachedEvents(CACHE_REVOKED);
      const currentBlock  = await provider.getBlockNumber();

      // ── Helper: fetch a filter from fromBlock to currentBlock ────────────
      const fetchFrom = (filter, fromBlock) =>
        queryFilterChunked(contract, filter, fromBlock, currentBlock, provider);

      let issuedLogs, revokedLogs;
      let issuedEvents  = [];
      let revokedEvents = [];
      let didShowCached = false;

      // ── Issued: serve cache then background-update ────────────────────
      if (cachedIssued) {
        issuedEvents = cachedIssued.events;
        didShowCached = true;
        issuedLogs   = currentBlock > cachedIssued.lastBlock
          ? await fetchFrom(contract.filters.CertificateIssued(), cachedIssued.lastBlock + 1)
          : [];
      } else {
        issuedLogs = await fetchFrom(contract.filters.CertificateIssued(), CONTRACT_DEPLOYMENT_BLOCK);
      }

      // ── Revoked: serve cache then background-update ──────────────────
      if (cachedRevoked) {
        revokedEvents = cachedRevoked.events;
        revokedLogs   = currentBlock > cachedRevoked.lastBlock
          ? await fetchFrom(contract.filters.CertificateRevoked(), cachedRevoked.lastBlock + 1)
          : [];
      } else {
        revokedLogs = await fetchFrom(contract.filters.CertificateRevoked(), CONTRACT_DEPLOYMENT_BLOCK);
      }

      // If we already had cached data, show it now (fast path)
      if (didShowCached && issuedLogs.length === 0 && revokedLogs.length === 0) {
        saveCachedEvents(CACHE_ISSUED,  currentBlock, issuedEvents);
        saveCachedEvents(CACHE_REVOKED, currentBlock, revokedEvents);
        setEvents([...issuedEvents, ...revokedEvents].sort((a, b) => b.blockNum - a.blockNum));
        return;
      }

      // ── Parse newly fetched logs ──────────────────────────────────
      const allNewBlockNumbers = [
        ...issuedLogs.map((l) => l.blockNumber),
        ...revokedLogs.map((l) => l.blockNumber),
      ];
      const blockMap = await batchGetBlocks(allNewBlockNumbers, provider);
      const getTs = (log) => {
        const block = blockMap.get(log.blockNumber);
        return block ? Number(block.timestamp) * 1000 : Date.now();
      };

      const newIssued = issuedLogs.map((log) => ({
        type: "issue", title: "Certificate Issued",
        certHash:  log.args?.[0] || log.topics?.[1],
        name:      log.args?.[1] || log.args?.name   || "",
        course:    log.args?.[2] || log.args?.course  || "",
        issuer:    log.args?.[3] || log.args?.issuer  || "",
        timestamp: getTs(log),
        txHash:    log.transactionHash,
        blockNum:  log.blockNumber,
      }));

      let newRevoked = [];
      if (revokedLogs.length > 0) {
        const revokedHashes = revokedLogs.map((l) => l.args?.[0] || l.topics?.[1]);
        const certDataMap = await batchVerifyCertificates(revokedHashes, provider);
        newRevoked = revokedLogs.map((log) => {
          const hash = log.args?.[0] || log.topics?.[1];
          const certData = certDataMap.get(hash);
          return {
            type: "revoke", title: "Certificate Revoked",
            certHash:  hash,
            name:      certData?.name   || "—",
            course:    certData?.course || "—",
            revokedBy: log.args?.[1] || log.args?.revokedBy || "",
            timestamp: getTs(log),
            txHash:    log.transactionHash,
            blockNum:  log.blockNumber,
          };
        });
      }

      // Merge with cached
      const mergedIssued  = [...issuedEvents,  ...newIssued];
      const mergedRevoked = [...revokedEvents, ...newRevoked];

      saveCachedEvents(CACHE_ISSUED,  currentBlock, mergedIssued);
      saveCachedEvents(CACHE_REVOKED, currentBlock, mergedRevoked);

      setEvents([...mergedIssued, ...mergedRevoked].sort((a, b) => b.blockNum - a.blockNum));
    } catch (err) {
      setError(err.message || "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (registered) fetchEvents(false);
  }, [registered, fetchEvents]);

  const displayed = filter === "all" ? events : events.filter((e) => e.type === filter);

  if (!account) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }} className="page-enter">
        <Card style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Wallet Not Connected</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Please connect your wallet to view the audit log.
          </p>
        </Card>
      </div>
    );
  }

  if (checkingReg) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }} className="page-enter">
        <Card style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 24px" }}>
          <Spinner />
          <span style={{ color: "var(--muted)", fontSize: 14 }}>Checking registration status...</span>
        </Card>
      </div>
    );
  }

  if (!registered) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }} className="page-enter">
        <Card style={{ textAlign: "center", padding: "48px 24px", border: "1px solid rgba(239,68,68,0.3)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, margin: "0 auto 16px",
          }}>✗</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Access Denied</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px" }}>
            Only registered issuers can view the audit log.
          </p>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            background: "var(--bg3)", padding: "8px 16px", borderRadius: 8,
            display: "inline-block", color: "var(--muted)",
          }}>{account}</p>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "16px 0 0" }}>
            Contact the platform admin to get your address registered.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }} className="page-enter">
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 6px" }}>📜 Audit Log</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Live on-chain events — last ~10,000 blocks on Sepolia</p>
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <CardTitle icon="📡">Blockchain Events</CardTitle>
          <button onClick={fetchEvents} disabled={loading} style={{ fontSize: 12, color: "var(--muted)", background: "var(--bg3)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            {loading
              ? <div style={{ width: 12, height: 12, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              : "↻"} Refresh
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: filter === f.key ? "rgba(108,99,255,0.15)" : "var(--bg3)",
              border: filter === f.key ? "1px solid rgba(108,99,255,0.3)" : "1px solid var(--border)",
              color: filter === f.key ? "#a78bfa" : "var(--muted)",
            }}>
              {f.label}
              {f.key !== "all" && (
                <span style={{ marginLeft: 6, background: "rgba(108,99,255,0.15)", padding: "1px 6px", borderRadius: 100, fontSize: 10 }}>
                  {events.filter(e => e.type === f.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 0" }}>
            <Spinner /><span style={{ color: "var(--muted)", fontSize: 14 }}>Fetching events from Sepolia...</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && displayed.length === 0 && (
          <EmptyState icon="📭" message="No events found" sub="No events in the last 10,000 blocks" />
        )}

        {!loading && displayed.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {displayed.map((evt, idx) => (
              <div key={evt.txHash + idx} style={{ display: "flex", gap: 16, position: "relative" }}>
                {idx < displayed.length - 1 && (
                  <div style={{ position: "absolute", left: 19, top: 40, bottom: -12, width: 1, background: "var(--border)" }} />
                )}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg3)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, zIndex: 1 }}>
                  {ICON_MAP[evt.type]}
                </div>
                <div style={{ paddingBottom: 28, flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{evt.title}</span>
                    <Badge variant={BADGE_MAP[evt.type]}>{evt.type}</Badge>
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 4px" }}>{evt.name} — {evt.course}</p>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    {evt.type === "issue"  && <>Issued by: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a78bfa" }}>{shortenAddress(evt.issuer)}</span></>}
                    {evt.type === "revoke" && <>Revoked by: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#ef4444" }}>{shortenAddress(evt.revokedBy)}</span></>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--muted)" }}>
                      {evt.certHash?.slice(0, 10)}...{evt.certHash?.slice(-6)}
                    </span>
                    {evt.txHash && (
                      <a href={`https://sepolia.etherscan.io/tx/${evt.txHash}`} target="_blank" rel="noreferrer"
                        style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#a78bfa", textDecoration: "none" }}>
                        {evt.txHash.slice(0, 12)}... ↗
                      </a>
                    )}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {formatTimestamp(evt.timestamp)} · Block #{evt.blockNum}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && events.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14, display: "flex", gap: 20, fontSize: 12, color: "var(--muted)" }}>
            <span>Total: <strong style={{ color: "var(--text)" }}>{events.length}</strong></span>
            <span>Issued: <strong style={{ color: "#a78bfa" }}>{events.filter(e => e.type === "issue").length}</strong></span>
            <span>Revoked: <strong style={{ color: "#ef4444" }}>{events.filter(e => e.type === "revoke").length}</strong></span>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditLog;