import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";
import {
  Card, CardTitle, InputField, PrimaryButton,
  Badge, HashBox, EtherscanLink, Spinner,
} from "../components/UI";
import { useContract } from "../hooks/useContract";
import { formatTimestamp, shortenAddress } from "../utils/ethers";
import { ipfsUrl } from "../utils/pinata";

const VerifyCertificate = () => {
  const [searchParams] = useSearchParams();
  const { verify } = useContract();
  const [hash, setHash] = useState(searchParams.get("hash") || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    if (hash) handleVerify(hash);
  }, []);

  const handleVerify = async (h = hash) => {
    if (!h.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await verify(h.trim());
      if (data.found && data.course && data.course.includes(" | ID: ")) {
        const parts = data.course.split(" | ID: ");
        data.course = parts[0];
        data.certId = parts[1];
      }
      setResult(data);
    } catch (_) {
      setResult({ found: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 page-enter">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">🔍 Verify Certificate</h2>
        <p className="text-slate-500 text-sm">Check the authenticity of any certificate issued on CertifyChain</p>
      </div>

      <Card className="mb-4">
        <CardTitle icon="🔑">Enter Certificate Hash</CardTitle>
        <InputField
          label="Certificate Hash (keccak256)"
          id="verifyHash"
          placeholder="0x8f4a3c2b..."
          value={hash}
          onChange={(e) => setHash(e.target.value)}
        />
        <PrimaryButton
          onClick={() => handleVerify()}
          loading={loading}
          disabled={!hash.trim()}
          className="w-full mt-4"
        >
          🔍 Verify on Blockchain
        </PrimaryButton>
      </Card>

      {loading && (
        <Card className="flex items-center justify-center py-10 gap-3">
          <Spinner />
          <span className="text-slate-400 text-sm">Querying Sepolia blockchain...</span>
        </Card>
      )}

      {result && !loading && (
        <Card className={`relative overflow-hidden ${result.found && result.isValid ? "border-green-500/30" : "border-red-500/30"}`}>
          <div className={`absolute top-0 left-0 right-0 h-0.5 ${result.found && result.isValid ? "bg-gradient-to-r from-cert-teal to-green-400" : "bg-red-500"}`} />

          <div className="text-center mb-6 pt-2">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-3 border-2
              ${result.found && result.isValid
                ? "bg-green-500/10 border-green-500/30"
                : "bg-red-500/10 border-red-500/30"
              }`}>
              {result.found && result.isValid ? "✓" : "✗"}
            </div>
            <h3 className="text-xl font-bold mb-1">
              {result.found && result.isValid
                ? "Certificate Valid"
                : result.found && !result.isValid
                  ? "Certificate Revoked"
                  : "Certificate Not Found"
              }
            </h3>
            <p className="text-slate-500 text-sm">
              {result.found && result.isValid
                ? "This certificate is authentic and active on Sepolia."
                : result.found
                  ? "This certificate exists but has been revoked."
                  : "No matching certificate found on-chain for this hash."
              }
            </p>
          </div>

          {result.found && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  ["Recipient Name", result.name],
                  ["Course / Program", result.course],
                  ["Certificate ID", result.certId || "Not Found"],
                  ["Issue Date", formatTimestamp(result.issueDate)],
                  ["Status", null],
                  ["Issuer Address", shortenAddress(result.issuer)],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} className="bg-bg-3 rounded-xl p-3">
                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-1">{label}</div>
                    {label === "Status"
                      ? <Badge variant={result.isValid ? "valid" : "revoked"}>{result.isValid ? "✓ Valid" : "✗ Revoked"}</Badge>
                      : <div className="text-sm font-medium">{val || "—"}</div>
                    }
                  </div>
                ))}
              </div>

              {result.ipfsHash && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex justify-between items-center">
                    <span>Certificate PDF</span>
                    <a
                      href={ipfsUrl(result.ipfsHash)}
                      target="_blank" rel="noreferrer"
                      className="text-accent-light text-xs hover:underline flex items-center gap-1"
                    >
                      Open in new tab ↗
                    </a>
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden bg-bg-3 h-[500px] w-full shadow-inner relative">
                    {!iframeLoaded && (
                      <div className="absolute inset-0 pdf-scanner z-10">
                        <div className="text-4xl mb-4 opacity-50 grayscale">📄</div>
                        <span className="pdf-scanner-text">Decrypting PDF...</span>
                      </div>
                    )}
                    <iframe
                      src={`${ipfsUrl(result.ipfsHash)}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                      className="border-0 block"
                      style={{ width: "calc(100% + 24px)", height: "calc(100% + 24px)", pointerEvents: "none", overflow: "hidden" }}
                      scrolling="no"
                      onLoad={() => setIframeLoaded(true)}
                      title="Certificate PDF Preview"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4 flex flex-col items-center gap-3">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-widest">Verification QR</div>
                <div className="bg-white p-4 rounded-xl">
                  <QRCode value={`${window.location.origin}/verify?hash=${hash}`} size={120} />
                </div>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
};

export default VerifyCertificate;
