import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Spinner } from "../components/UI";
import { CONTRACT_ADDRESS } from "../utils/contractConfig";
import { shortenAddress, SEPOLIA_RPC } from "../utils/ethers";
import toast from "react-hot-toast";

const ABI = [
  {
    "inputs": [{ "internalType": "bytes32", "name": "certHash", "type": "bytes32" }],
    "name": "verifyCertificate",
    "outputs": [{
      "components": [
        { "internalType": "string", "name": "name", "type": "string" },
        { "internalType": "string", "name": "course", "type": "string" },
        { "internalType": "string", "name": "ipfsHash", "type": "string" },
        { "internalType": "uint256", "name": "issueDate", "type": "uint256" },
        { "internalType": "address", "name": "issuer", "type": "address" },
        { "internalType": "bool", "name": "isValid", "type": "bool" },
        { "internalType": "bool", "name": "isEdited", "type": "bool" }
      ],
      "internalType": "struct CertificateVerification.Certificate",
      "name": "", "type": "tuple"
    }],
    "stateMutability": "view", "type": "function"
  }
];

const s = {
  page: {
    maxWidth: 780,
    margin: "0 auto",
    padding: "40px 24px",
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "var(--muted)",
    background: "var(--bg3)",
    border: "1px solid var(--border)",
    padding: "7px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    marginBottom: 28,
    textDecoration: "none",
    transition: "color 0.15s",
  },
  docCard: {
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  docHeader: {
    padding: "32px 36px 28px",
    borderBottom: "1px solid var(--border)",
    position: "relative",
    overflow: "hidden",
  },
  docHeaderBg: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(ellipse at top right, rgba(167,139,250,0.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  docHeaderAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  docOrg: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#a78bfa",
    marginBottom: 16,
  },
  docTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: 8,
  },
  docRecipient: {
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1.1,
    marginBottom: 6,
  },
  docCourse: {
    fontSize: 16,
    color: "#a78bfa",
    fontWeight: 500,
    marginBottom: 0,
  },
  docStatusChip: (valid) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 20,
    background: valid ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
    color: valid ? "#22c55e" : "#ef4444",
    border: `1px solid ${valid ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
    marginTop: 18,
  }),
  // ── Details grid ──
  detailsGrid: {
    padding: "28px 36px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0",
  },
  detailCell: {
    padding: "16px 0",
    borderBottom: "1px solid rgba(42,45,62,0.35)",
  },
  detailCellFull: {
    padding: "16px 0",
    borderBottom: "1px solid rgba(42,45,62,0.35)",
    gridColumn: "1 / -1",
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 14,
    color: "var(--text)",
    wordBreak: "break-all",
  },
  detailValueMono: {
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    color: "var(--text)",
    wordBreak: "break-all",
    lineHeight: 1.6,
  },
  detailLink: {
    color: "#a78bfa",
    textDecoration: "none",
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    wordBreak: "break-all",
  },
  ipfsCard: {
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "20px 24px",
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  ipfsLabel: {
    fontSize: 12,
    color: "var(--muted)",
    marginBottom: 4,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  ipfsHash: {
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    color: "var(--text)",
    wordBreak: "break-all",
  },
  ipfsBtn: {
    fontSize: 12,
    color: "#60a5fa",
    background: "rgba(96,165,250,0.08)",
    border: "1px solid rgba(96,165,250,0.22)",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  // ── Actions row ──
  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    minWidth: 140,
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "14px 18px",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    transition: "border-color 0.15s",
  },
  actionBtnIcon: {
    fontSize: 20,
    marginBottom: 8,
    display: "block",
  },
  actionBtnLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 2,
    display: "block",
  },
  actionBtnSub: {
    fontSize: 11,
    color: "var(--muted)",
    display: "block",
  },
  centered: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
    flexDirection: "column",
    gap: 16,
    color: "var(--muted)",
    fontSize: 14,
  },
};

const copyToClipboard = (text, label) => {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied to clipboard`);
  });
};

const formatDate = (ts) =>
  new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const CertificateDetail = () => {
  const { hash } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [cert, setCert] = useState(state?.cert || null);
  const [txInfo, setTxInfo] = useState(null);
  const [loading, setLoading] = useState(!state?.cert);
  const [error, setError] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const decodedHash = decodeURIComponent(hash);

  const getContract = useCallback(() => {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  }, []);

  useEffect(() => {
    const fetchCert = async () => {
      setLoading(true);
      setError(null);
      try {
        const contract = getContract();
        const result = await contract.verifyCertificate(decodedHash);

        const onChain = {
          hash: decodedHash,
          name: result[0],
          course: result[1],
          ipfsHash: result[2],
          issueDate: Number(result[3]) * 1000,
          issuer: result[4],
          valid: result[5],
          isEdited: result[6],
          txHash: state?.cert?.txHash || null,
          blockNumber: state?.cert?.blockNumber || null,
          date: new Date(Number(result[3]) * 1000).toLocaleDateString("en-IN"),
        };

        if (onChain.course.includes(" | ID: ")) {
          const parts = onChain.course.split(" | ID: ");
          onChain.course = parts[0];
          onChain.certId = parts[1];
        }

        setCert(onChain);

        if (onChain.txHash) {
          const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
          const [receipt, block] = await Promise.all([
            provider.getTransactionReceipt(onChain.txHash),
            provider.getBlock(onChain.blockNumber),
          ]);
          setTxInfo({
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            blockTime: block ? formatDate(Number(block.timestamp) * 1000) : "—",
            from: receipt.from,
            status: receipt.status === 1 ? "Success" : "Failed",
          });
        }
      } catch (err) {
        setError(err.message || "Certificate not found");
      } finally {
        setLoading(false);
      }
    };

    fetchCert();
  }, [decodedHash, getContract, state]);

  if (loading) {
    return (
      <div style={s.page}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <div style={s.centered}>
          <Spinner size={24} />
          <span>Fetching certificate from chain…</span>
        </div>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div style={s.page}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <div style={s.centered}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ color: "#ef4444" }}>
            {error || "Certificate not found"}
          </div>
          <button style={s.backBtn} onClick={() => navigate("/certificates")}>
            ← All Certificates
          </button>
        </div>
      </div>
    );
  }

  const ipfsUrl = cert.ipfsHash
    ? `https://ipfs.io/ipfs/${cert.ipfsHash}`
    : null;

  return (
    <div style={s.page} className="page-enter">
      <button style={s.backBtn} onClick={() => navigate("/certificates")}>
        ← All Certificates
      </button>

      <div style={s.docCard}>
        <div style={s.docHeader}>
          <div style={s.docHeaderBg} />
          <div style={{
            ...s.docHeaderAccent,
            background: cert.valid
              ? "linear-gradient(90deg, #a78bfa, #60a5fa)"
              : "linear-gradient(90deg, #ef4444, #f97316)",
          }} />

          <div style={s.docOrg}>⛓ Blockchain Certificate</div>

          <div style={s.docTitle}>Certificate of Completion — Issued to</div>
          <div style={s.docRecipient}>
            {cert.name}
            {cert.isEdited && (
              <span style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", marginLeft: 8, fontWeight: 500 }}>(edited)</span>
            )}
          </div>
          <div style={s.docCourse}>{cert.course}</div>
          
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
            ID: {cert.certId || "Not Found"}
          </div>

          <div style={s.docStatusChip(cert.valid)}>
            {cert.valid ? `✓ Valid & Active${cert.isEdited ? " (Edited)" : ""}` : "✗ Revoked"}
          </div>
        </div>

        <div style={s.detailsGrid}>

          <div style={s.detailCell}>
            <div style={s.detailLabel}>Recipient Name</div>
            <div style={s.detailValue}>{cert.name}</div>
          </div>

          <div style={s.detailCell}>
            <div style={s.detailLabel}>Course / Program</div>
            <div style={s.detailValue}>{cert.course}</div>
          </div>

          <div style={s.detailCell}>
            <div style={s.detailLabel}>Certificate ID</div>
            <div style={s.detailValueMono}>{cert.certId || "Not Found"}</div>
          </div>

          <div style={s.detailCell}>
            <div style={s.detailLabel}>Issue Date</div>
            <div style={s.detailValue}>
              {cert.issueDate ? formatDate(cert.issueDate) : cert.date}
            </div>
          </div>

          <div style={s.detailCell}>
            <div style={s.detailLabel}>Status</div>
            <div style={{
              ...s.detailValue,
              color: cert.valid ? "#22c55e" : "#ef4444",
              fontWeight: 600,
            }}>
              {cert.valid ? `Valid${cert.isEdited ? " (Edited)" : ""}` : "Revoked"}
            </div>
          </div>

          <div style={s.detailCellFull}>
            <div style={s.detailLabel}>Issuer Address</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={s.detailValueMono}>{cert.issuer}</span>
              <button
                onClick={() => copyToClipboard(cert.issuer, "Issuer address")}
                style={{
                  fontSize: 11, color: "var(--muted)",
                  background: "var(--bg3)", border: "1px solid var(--border)",
                  padding: "3px 8px", borderRadius: 5, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Copy
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${cert.issuer}`}
                target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: "#a78bfa", textDecoration: "none" }}
              >
                Etherscan ↗
              </a>
            </div>
          </div>

          <div style={s.detailCellFull}>
            <div style={s.detailLabel}>Certificate Hash (bytes32)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={s.detailValueMono}>{cert.hash}</span>
              <button
                onClick={() => copyToClipboard(cert.hash, "Certificate hash")}
                style={{
                  fontSize: 11, color: "var(--muted)",
                  background: "var(--bg3)", border: "1px solid var(--border)",
                  padding: "3px 8px", borderRadius: 5, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Copy
              </button>
            </div>
          </div>

          {cert.txHash && (
            <div style={s.detailCellFull}>
              <div style={s.detailLabel}>Transaction Hash</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <a
                  href={`https://sepolia.etherscan.io/tx/${cert.txHash}`}
                  target="_blank" rel="noreferrer"
                  style={s.detailLink}
                >
                  {cert.txHash}
                </a>
                <span style={{ fontSize: 11, color: "#22c55e" }}>↗ Sepolia</span>
              </div>
            </div>
          )}

          {txInfo && (
            <>
              <div style={s.detailCell}>
                <div style={s.detailLabel}>Block Number</div>
                <div style={s.detailValueMono}>#{txInfo.blockNumber}</div>
              </div>
              <div style={s.detailCell}>
                <div style={s.detailLabel}>Gas Used</div>
                <div style={s.detailValueMono}>
                  {Number(txInfo.gasUsed).toLocaleString()} units
                </div>
              </div>
              <div style={s.detailCell}>
                <div style={s.detailLabel}>Block Timestamp</div>
                <div style={s.detailValue}>{txInfo.blockTime}</div>
              </div>
              <div style={s.detailCell}>
                <div style={s.detailLabel}>Tx Status</div>
                <div style={{
                  ...s.detailValue,
                  color: txInfo.status === "Success" ? "#22c55e" : "#ef4444",
                  fontWeight: 600,
                }}>
                  {txInfo.status}
                </div>
              </div>
              <div style={s.detailCellFull}>
                <div style={s.detailLabel}>Submitted By (from)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={s.detailValueMono}>{txInfo.from}</span>
                  <a
                    href={`https://sepolia.etherscan.io/address/${txInfo.from}`}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: "#a78bfa", textDecoration: "none" }}
                  >
                    Etherscan ↗
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {cert.ipfsHash ? (
        <div style={{ ...s.ipfsCard, flexDirection: "column", alignItems: "stretch", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.ipfsLabel}>📁 IPFS Document</div>
              <div style={s.ipfsHash}>{cert.ipfsHash}</div>
            </div>
            <a href={ipfsUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <button style={s.ipfsBtn}>Open in new tab ↗</button>
            </a>
          </div>
          <div style={{ height: "650px", width: "100%", background: "var(--bg3)", borderRadius: "0 0 12px 12px", overflow: "hidden", position: "relative" }}>
            {!iframeLoaded && (
              <div className="pdf-scanner" style={{ position: "absolute", inset: 0, zIndex: 10 }}>
                <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.5, filter: "grayscale(100%)" }}>📄</div>
                <span className="pdf-scanner-text">Loading PDF...</span>
              </div>
            )}
            <iframe
              src={`${ipfsUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
              style={{ width: "calc(100% + 24px)", height: "calc(100% + 24px)", border: "none", pointerEvents: "none", overflow: "hidden" }}
              scrolling="no"
              onLoad={() => setIframeLoaded(true)}
              title="Certificate PDF Preview"
            />
          </div>
        </div>
      ) : (
        <div style={{
          ...s.ipfsCard,
          opacity: 0.5,
        }}>
          <div>
            <div style={s.ipfsLabel}>📁 IPFS Document</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              No document stored on IPFS for this certificate
            </div>
          </div>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div style={s.actionsRow}>
        <button
          style={s.actionBtn}
          onClick={() => copyToClipboard(
            `${window.location.origin}/certificates/${encodeURIComponent(cert.hash)}`,
            "Verification link"
          )}
        >
          <span style={s.actionBtnIcon}>🔗</span>
          <span style={s.actionBtnLabel}>Copy Verification Link</span>
          <span style={s.actionBtnSub}>Share this certificate</span>
        </button>

        <button
          style={s.actionBtn}
          onClick={() => copyToClipboard(cert.hash, "Certificate hash")}
        >
          <span style={s.actionBtnIcon}>📋</span>
          <span style={s.actionBtnLabel}>Copy Hash</span>
          <span style={s.actionBtnSub}>bytes32 certificate hash</span>
        </button>

        {cert.txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${cert.txHash}`}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", flex: 1, minWidth: 140 }}
          >
            <button style={{ ...s.actionBtn, width: "100%", height: "100%" }}>
              <span style={s.actionBtnIcon}>⛓</span>
              <span style={s.actionBtnLabel}>View on Etherscan</span>
              <span style={s.actionBtnSub}>Full transaction details</span>
            </button>
          </a>
        )}

        <button
          style={s.actionBtn}
          onClick={() => navigate(`/verify?hash=${encodeURIComponent(cert.hash)}`)}
        >
          <span style={s.actionBtnIcon}>✅</span>
          <span style={s.actionBtnLabel}>Verify Certificate</span>
          <span style={s.actionBtnSub}>Go to verify page</span>
        </button>
      </div>
    </div>
  );
};

export default CertificateDetail;