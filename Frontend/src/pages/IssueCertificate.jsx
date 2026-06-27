import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";
import {
  Card, CardTitle, InputField, PrimaryButton,
  SecondaryButton, StepIndicator, HashBox,
  WarningBox, EtherscanLink, Badge,
} from "../components/UI";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import { generateCertHash } from "../utils/ethers";
import toast from "react-hot-toast";

const STEPS = ["Details", "Upload", "Confirm", "Done"];

const IssueCertificate = () => {
  const { account } = useWallet();
  const { issue, checkExists, getNextCertId } = useContract();
  const navigate = useNavigate();

  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [copied, setCopied]   = useState(false);

  // Auto-generated cert ID
  const [certId, setCertId]         = useState("");
  const [generatingId, setGeneratingId] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", course: "", institution: "",
    grade: "", issueDate: "",
  });
  const [file, setFile]         = useState(null);
  const [certHash, setCertHash] = useState("");

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  // Generate cert ID as soon as the wallet connects
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    const generate = async () => {
      setGeneratingId(true);
      try {
        const id = await getNextCertId();
        if (!cancelled) setCertId(id);
      } catch (_) {
        if (!cancelled) setCertId("CERT-1");
      } finally {
        if (!cancelled) setGeneratingId(false);
      }
    };
    generate();
    return () => { cancelled = true; };
  }, [account, getNextCertId]);

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);
  const onDropRejected = useCallback(() => {
    toast.error("Only PDF files are allowed!");
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, onDropRejected, accept: { "application/pdf": [".pdf"] }, maxFiles: 1,
  });

  const toStep2 = async () => {
    if (!form.name || !form.course || !certId) return;
    const hash = generateCertHash(certId, form.name, form.course, form.institution);

    const exists = await checkExists(hash);
    if (exists) {
      toast.error("A certificate with these exact details already exists!");
      return;
    }

    setCertHash(hash);
    setStep(2);
  };

  const toStep3 = () => setStep(3);

  const submit = async () => {
    if (!account) { toast.error("Connect your wallet first"); return; }
    setLoading(true);
    try {
      const combinedCourse = `${form.course} | ID: ${certId}`;
      const res = await issue({
        name: form.name,
        course: combinedCourse,
        institution: form.institution,
        grade: form.grade,
        certId,
        file,
      });
      setResult(res);
      setStep(4);
    } catch (_) {}
    finally { setLoading(false); }
  };

  const reset = async () => {
    setStep(1);
    setForm({ name:"", email:"", course:"", institution:"", grade:"", issueDate:"" });
    setFile(null); setCertHash(""); setResult(null); setCopied(false);
    // Generate a fresh ID for the next certificate
    setGeneratingId(true);
    try {
      const id = await getNextCertId();
      setCertId(id);
    } catch (_) { setCertId("CERT-1"); }
    finally { setGeneratingId(false); }
  };

  const verifyUrl = result
    ? `${window.location.origin}/verify?hash=${result.certHash}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(verifyUrl).then(() => {
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    });
  };

  /* ── Not connected ── */
  if (!account) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 page-enter">
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">🔐</div>
          <h3 className="text-xl font-bold mb-2">Wallet Not Connected</h3>
          <p className="text-slate-500 text-sm">
            Connect your MetaMask wallet to issue a certificate on the blockchain.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 page-enter">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">🎓 Issue Certificate</h2>
        <p className="text-slate-500 text-sm">
          Anyone with a wallet can issue a tamper-proof certificate on the blockchain
        </p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      {/* ── Step 1: Details ── */}
      {step === 1 && (
        <Card>
          <CardTitle icon="👤">Recipient Details</CardTitle>

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Recipient Name *" id="name" placeholder="Your Name" value={form.name} onChange={set("name")} />
            <InputField label="Recipient Email" id="email" type="email" placeholder="youremail@example.com" value={form.email} onChange={set("email")} />
            <InputField label="College / Course / Credential *" id="course" placeholder="B.Tech Computer Science" value={form.course} onChange={set("course")} />
            <InputField label="Institution / Org" id="institution" placeholder="Your Institution / Org Name" value={form.institution} onChange={set("institution")} />
            <InputField label="Grade / Score" id="grade" placeholder="Your Grade / Score" value={form.grade} onChange={set("grade")} />
            <InputField label="Issue Date" id="issueDate" type="date" value={form.issueDate} onChange={set("issueDate")} />
          </div>

          <PrimaryButton
            onClick={toStep2}
            disabled={!form.name || !form.course || !certId || generatingId}
            className="w-full mt-5"
          >
            {generatingId ? "Generating ID…" : "Continue →"}
          </PrimaryButton>
        </Card>
      )}

      {/* ── Step 2: Upload ── */}
      {step === 2 && (
        <Card>
          <CardTitle icon="📄">Upload Certificate PDF</CardTitle>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${isDragActive ? "border-accent bg-accent/5" : "border-border bg-bg-3 hover:border-accent/50 hover:bg-accent/3"}`}
          >
            <input {...getInputProps()} />
            <div className="text-3xl mb-2">📎</div>
            <p className="text-sm text-slate-400">
              <span className="text-accent-light font-semibold">Click to upload</span> or drag & drop
            </p>
            <p className="text-xs text-slate-600 mt-1">PDF only, max 10MB</p>
          </div>

          {file && (
            <div className="mt-3 flex items-center gap-3 bg-accent/5 border border-accent/20 rounded-xl px-4 py-2.5">
              <span className="text-lg">📄</span>
              <span className="text-sm flex-1 truncate">{file.name}</span>
              <button
                onClick={() => window.open(URL.createObjectURL(file), "_blank")}
                title="Preview PDF"
                className="text-lg hover:opacity-80 transition-opacity bg-white/10 p-1.5 rounded-lg flex items-center justify-center border border-accent/30"
              >
                👁️
              </button>
              <Badge variant="valid">Ready</Badge>
            </div>
          )}

          <div className="mt-4">
            <HashBox label="Certificate Hash (keccak256)" value={certHash} />
          </div>
          <div className="mt-1 text-xs text-slate-600 italic">
            IPFS hash will be generated automatically when you submit.
          </div>

          <div className="flex gap-3 mt-5">
            <SecondaryButton onClick={() => setStep(1)}>← Back</SecondaryButton>
            <PrimaryButton onClick={toStep3} className="flex-1">Continue →</PrimaryButton>
          </div>
        </Card>
      )}

      {/* ── Step 3: Confirm ── */}
      {step === 3 && (
        <Card>
          <CardTitle icon="🔍">Review & Confirm</CardTitle>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              ["Recipient",       form.name],
              ["Course",          form.course],
              ["Institution",     form.institution],
              ["Grade",           form.grade],
              ["Issue Date",      form.issueDate],
            ].map(([label, val]) => (
              <div key={label} className="bg-bg-3 rounded-xl p-3">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-1">{label}</div>
                <div className={`text-sm font-medium ${label === "Certificate ID" ? "font-mono text-accent-light" : ""}`}>
                  {val || "—"}
                </div>
              </div>
            ))}
          </div>
          <HashBox label="Certificate Hash (bytes32)" value={certHash} />
          <div className="mt-4">
            <WarningBox>
              This will send a transaction on Sepolia. Ensure your wallet has test ETH.
            </WarningBox>
          </div>
          <div className="flex gap-3 mt-5">
            <SecondaryButton onClick={() => setStep(2)}>← Back</SecondaryButton>
            <PrimaryButton onClick={submit} loading={loading} className="flex-1">
              Issue on Blockchain
            </PrimaryButton>
          </div>
        </Card>
      )}

      {/* ── Step 4: Done ── */}
      {step === 4 && result && (
        <Card className="text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h3 className="text-xl font-bold mb-2">Certificate Issued!</h3>
          <p className="text-slate-500 text-sm mb-1">Successfully recorded on the Sepolia blockchain</p>
          <p className="text-xs font-mono text-accent-light mb-6">{certId}</p>

          {/* Hash + IPFS + TX */}
          <div className="space-y-3 text-left mb-6">
            <HashBox label="Certificate Hash" value={result.certHash} />
            {result.ipfsHash && <HashBox label="IPFS CID" value={result.ipfsHash} />}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Transaction</span>
              <EtherscanLink hash={result.txHash} short={false} />
            </div>
          </div>

          {/* QR + Shareable link */}
          <div className="bg-bg-3 border border-border rounded-2xl p-5 mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Share Your Certificate</p>
            <div className="bg-white rounded-2xl p-4 inline-block mb-4">
              <QRCode value={verifyUrl} size={148} />
            </div>
            <div className="flex items-center gap-2 bg-bg-4 border border-border rounded-xl px-3 py-2 mt-2">
              <span className="text-xs text-slate-400 font-mono flex-1 truncate text-left">{verifyUrl}</span>
              <button
                onClick={copyLink}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ${
                  copied
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-accent/10 text-accent-light border border-accent/30 hover:bg-accent/20"
                }`}
              >
                {copied ? "✓ Copied!" : "Copy Link"}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              Share this link or QR code — anyone can verify this certificate instantly.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <SecondaryButton onClick={reset}>Issue Another</SecondaryButton>
            <PrimaryButton onClick={() => navigate(`/verify?hash=${result.certHash}`)}>
              🔍 Verify Now
            </PrimaryButton>
          </div>
        </Card>
      )}
    </div>
  );
};

export default IssueCertificate;