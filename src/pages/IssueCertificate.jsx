import React, { useState, useEffect, useCallback } from "react";
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
  const { issue, checkIssuer, checkExists, checkCertIdExists } = useContract();
  const navigate = useNavigate();

  const [step, setStep]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [registered, setRegistered] = useState(null); // null = checking, true/false = result
  const [checkingReg, setCheckingReg] = useState(true);

  const [form, setForm] = useState({
    name: "", email: "", course: "", institution: "",
    grade: "", certId: "", issueDate: "",
  });
  const [file, setFile]         = useState(null);
  const [certHash, setCertHash] = useState("");

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  useEffect(() => {


    const checkRegistration = async () => {
      if (!account) {
        setRegistered(false);
        setCheckingReg(false);
        return;
      }
      setCheckingReg(true);
       try {
      console.log("Connected account:", account);

      const result = await checkIssuer(account);
      console.log("Is issuer (frontend check):", result);

      setRegistered(result);
    } catch (err) {
      console.log("Error checking issuer:", err);
      setRegistered(false);
    } finally {
      setCheckingReg(false);
    }
  };
    checkRegistration();
  }, [account, checkIssuer]);

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
    if (!form.name || !form.course || !form.certId) return;
    const hash = generateCertHash(form.certId, form.name, form.course, form.institution);
    
    const exists = await checkExists(hash);
    if (exists) {
      toast.error("A certificate with these exact details already exists!");
      return;
    }

    const idExists = await checkCertIdExists(form.certId);
    if (idExists) {
      toast.error(`Certificate ID '${form.certId}' is already taken!`);
      return;
    }

    setCertHash(hash);
    setStep(2);
  };

  const toStep3 = () => setStep(3);

  const submit = async () => {
    if (!account) { alert("Connect wallet first"); return; }
    setLoading(true);
    try {
      const combinedCourse = `${form.course} | ID: ${form.certId}`;
      const res = await issue({
        name: form.name,
        course: combinedCourse,
        institution: form.institution,
        grade: form.grade,
        certId: form.certId,
        file,
      });
      setResult(res);
      setStep(4);
    } catch (_) {}
    finally { setLoading(false); }
  };

  const reset = () => {
    setStep(1);
    setForm({ name:"", email:"", course:"", institution:"", grade:"", certId:"", issueDate:"" });
    setFile(null); setCertHash(""); setResult(null);
  };

  const verifyUrl = result
    ? `${window.location.origin}/verify?hash=${result.certHash}`
    : "";

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 page-enter">
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">🔐</div>
          <h3 className="text-xl font-bold mb-2">Wallet Not Connected</h3>
          <p className="text-slate-500 text-sm">
            Please connect your wallet to issue certificates.
          </p>
        </Card>
      </div>
    );
  }

  if (checkingReg) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 page-enter">
        <Card className="flex items-center justify-center gap-3 py-12">
          <span className="text-slate-400 text-sm">Checking registration status...</span>
        </Card>
      </div>
    );
  }

  if (!registered) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 page-enter">
        <Card className="text-center py-12 border-red-500/30">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-2xl mx-auto mb-4">
            ✗
          </div>
          <h3 className="text-xl font-bold mb-2">Access Denied</h3>
          <p className="text-slate-500 text-sm mb-4">
            Only registered issuers can create certificates.
          </p>
          <p className="text-slate-600 text-xs font-mono bg-bg-3 px-4 py-2 rounded-xl inline-block">
            {account}
          </p>
          <p className="text-slate-500 text-sm mt-4">
            Contact the platform admin to get your address registered.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 page-enter">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">🎓 Issue Certificate</h2>
        <p className="text-slate-500 text-sm">Issue a new blockchain-verified certificate to a recipient</p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      {step === 1 && (
        <Card>
          <CardTitle icon="👤">Recipient Details</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Recipient Name *" id="name" placeholder="Rohit Sharma" value={form.name} onChange={set("name")} />
            <InputField label="Recipient Email" id="email" type="email" placeholder="rohit@example.com" value={form.email} onChange={set("email")} />
            <InputField label="Course / Program *" id="course" placeholder="B.Tech Computer Science" value={form.course} onChange={set("course")} />
            <InputField label="Institution" id="institution" placeholder="MIT ADT University" value={form.institution} onChange={set("institution")} />
            <InputField label="Grade / Score" id="grade" placeholder="First Class with Distinction" value={form.grade} onChange={set("grade")} />
            <InputField label="Issue Date" id="issueDate" type="date" value={form.issueDate} onChange={set("issueDate")} />
            <div className="col-span-2">
              <InputField label="Certificate ID *" id="certId" placeholder="CERT-2024-IIT-001" value={form.certId} onChange={set("certId")} />
            </div>
          </div>
          <PrimaryButton
            onClick={toStep2}
            disabled={!form.name || !form.course || !form.certId}
            className="w-full mt-5"
          >
            Continue →
          </PrimaryButton>
        </Card>
      )}

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

      {step === 3 && (
        <Card>
          <CardTitle icon="🔍">Review & Confirm</CardTitle>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              ["Recipient", form.name],
              ["Course", form.course],
              ["Institution", form.institution],
              ["Grade", form.grade],
              ["Certificate ID", form.certId],
              ["Issue Date", form.issueDate],
            ].map(([label, val]) => (
              <div key={label} className="bg-bg-3 rounded-xl p-3">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-1">{label}</div>
                <div className="text-sm font-medium">{val || "—"}</div>
              </div>
            ))}
          </div>
          <HashBox label="Certificate Hash (bytes32)" value={certHash} />
          <div className="mt-4">
            <WarningBox>
              This will send a transaction on Sepolia. Ensure your wallet is connected and has test ETH.
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

      {step === 4 && result && (
        <Card className="text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h3 className="text-xl font-bold mb-2">Certificate Issued!</h3>
          <p className="text-slate-500 text-sm mb-6">Successfully recorded on Sepolia blockchain</p>

          <div className="space-y-3 text-left mb-6">
            <HashBox label="Certificate Hash" value={result.certHash} />
            {result.ipfsHash && <HashBox label="IPFS CID" value={result.ipfsHash} />}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Transaction</span>
              <EtherscanLink hash={result.txHash} short={false} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 inline-block mb-6">
            <QRCode value={verifyUrl} size={160} />
          </div>
          <p className="text-xs text-slate-600 mb-6 font-mono break-all">{verifyUrl}</p>

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