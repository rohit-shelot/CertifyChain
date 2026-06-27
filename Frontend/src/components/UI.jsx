import React, { useState } from "react";
import { shortenHash } from "../utils/ethers";
import toast from "react-hot-toast";


export const HashBox = ({ value, label }) => {
  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    toast.success("Copied!");
  };
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</span>}
      <div className="flex items-center gap-2 bg-bg-3 border border-border rounded-xl px-4 py-2.5">
        <span className="font-mono text-xs text-accent-light break-all flex-1 leading-relaxed">{value}</span>
        <button
          onClick={copy}
          className="shrink-0 text-xs text-slate-500 bg-bg-4 border border-border px-2.5 py-1 rounded-lg hover:text-white hover:border-accent transition-all"
        >
          Copy
        </button>
      </div>
    </div>
  );
};

export const Badge = ({ children, variant = "info" }) => {
  const variants = {
    valid:   "bg-green-500/10 border border-green-500/30 text-green-400",
    invalid: "bg-red-500/10 border border-red-500/30 text-red-400",
    pending: "bg-amber-500/10 border border-amber-500/30 text-amber-400",
    info:    "bg-accent/10 border border-accent/30 text-accent-light",
    revoked: "bg-red-500/10 border border-red-500/30 text-red-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant] || variants.info}`}>
      {children}
    </span>
  );
};


export const Card = ({ children, className = "", glow = false }) => (
  <div className={`bg-bg-2 border border-border rounded-2xl p-6 ${glow ? "shadow-glow" : ""} ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ icon, children }) => (
  <div className="flex items-center gap-2.5 mb-5">
    <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-sm">{icon}</div>
    <span className="font-semibold text-base">{children}</span>
  </div>
);

export const PrimaryButton = ({ children, onClick, disabled, loading, className = "", type = "button" }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    className={`flex items-center justify-center gap-2 bg-gradient-accent text-white font-semibold px-6 py-3 rounded-xl transition-all
      hover:-translate-y-0.5 hover:shadow-accent active:scale-[0.98]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${className}`}
  >
    {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
    {children}
  </button>
);

export const SecondaryButton = ({ children, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 bg-bg-3 border border-border text-slate-300 font-semibold px-6 py-3 rounded-xl
      hover:bg-bg-4 hover:border-accent/50 transition-all ${className}`}
  >
    {children}
  </button>
);

export const InputField = ({ label, id, type = "text", placeholder, value, onChange, required }) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label htmlFor={id} className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
        {label}
      </label>
    )}
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      className="bg-bg-3 border border-border text-slate-200 px-4 py-2.5 rounded-xl text-sm focus:border-accent outline-none transition-colors w-full"
    />
  </div>
);

export const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-8">
    <h2 className="text-2xl font-bold tracking-tight mb-1.5">{title}</h2>
    {subtitle && <p className="text-slate-500 text-sm">{subtitle}</p>}
  </div>
);

export const Spinner = ({ size = "md" }) => {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  return (
    <div className={`${sizes[size]} border-2 border-border border-t-accent rounded-full animate-spin`} />
  );
};

export const EmptyState = ({ icon = "📭", message, sub }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-4xl mb-3">{icon}</div>
    <p className="font-semibold text-slate-300">{message}</p>
    {sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
  </div>
);

export const StepIndicator = ({ steps, current }) => (
  <div className="flex items-center gap-2 mb-8">
    {steps.map((label, idx) => {
      const state = idx + 1 < current ? "done" : idx + 1 === current ? "active" : "idle";
      return (
        <React.Fragment key={idx}>
          <div className={`flex items-center gap-2 text-xs font-semibold
            ${state === "done" ? "text-green-400" : state === "active" ? "text-white" : "text-slate-600"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border
              ${state === "done" ? "bg-green-500 border-green-500 text-white"
              : state === "active" ? "bg-accent border-accent text-white"
              : "border-border text-slate-600"}`}>
              {state === "done" ? "✓" : idx + 1}
            </div>
            <span className="hidden sm:inline">{label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-px max-w-[48px] ${idx + 1 < current ? "bg-green-500/40" : "bg-border"}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

export const WarningBox = ({ children }) => (
  <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-3 text-amber-300 text-sm">
    ⚠️ {children}
  </div>
);

export const EtherscanLink = ({ hash, type = "tx", short = true }) => {
  const base = "https://sepolia.etherscan.io";
  const url  = `${base}/${type}/${hash}`;
  const text = short ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : hash;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="font-mono text-xs text-accent-light hover:underline">
      {text} ↗
    </a>
  );
};
