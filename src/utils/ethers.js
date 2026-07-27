export { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_DEPLOYMENT_BLOCK, SEPOLIA_RPC } from "./contractConfig";

import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_DEPLOYMENT_BLOCK, SEPOLIA_RPC, SEPOLIA_CHAIN_ID } from "./contractConfig";

// Sequential provider — tries each URL one at a time until one succeeds.
// Unlike FallbackProvider which fires ALL providers in parallel (causing 4× requests),
// this only uses one provider at a time and only falls over if it throws.
let _cachedProvider = null;
let _cachedProviderIndex = 0;

const FALLBACK_URLS = [
  SEPOLIA_RPC, // Primary from .env (e.g. Infura/Alchemy — best for archive)
  "https://sepolia.gateway.tenderly.co",
  "https://rpc.sepolia.ethpandaops.io",
  "https://rpc2.sepolia.org",
  "https://rpc.ankr.com/eth_sepolia",
  // NOTE: publicnode requires a personal token for archive data (returns 403)
  // NOTE: 1rpc.io only allows 50-block ranges per eth_getLogs request
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i); // unique, SEPOLIA_RPC first

const _failedRpcCooldowns = new Map();

export const isRateLimit = (err) => {
  if (!err) return false;
  const msg = (err?.message || "").toLowerCase();
  const info = err?.info || {};
  const code = err?.code || "";

  if (code === "BAD_DATA" || code === -32005) return true;
  if (
    msg.includes("429") ||
    msg.includes("too many") ||
    msg.includes("-32005") ||
    msg.includes("missing response") ||
    msg.includes("bad_data")
  ) return true;

  const body = (info?.responseBody || "").toLowerCase();
  if (body.includes("too many requests") || body.includes("429") || body.includes("-32005")) return true;

  // Treat 403 / archive-requires-token as a provider rotation trigger
  const status = (info?.responseStatus || "").trim();
  if (status === "403" || msg.includes("403") || msg.includes("forbidden")) return true;
  if (body.includes("personal token") || body.includes("archive") || body.includes("unauthorized")) return true;

  if (Array.isArray(err?.value)) {
    return err.value.some((v) => {
      const vCode = v?.code || v?.error?.code;
      const vMsg = (v?.message || v?.error?.message || "").toLowerCase();
      return vCode === -32005 || vMsg.includes("too many") || vMsg.includes("429") || vMsg.includes("unauthorized");
    });
  }
  return false;
};

export const getFriendlyErrorMessage = (err, fallbackMsg = "Failed to load data from blockchain") => {
  if (!err) return fallbackMsg;
  const msg = typeof err === "string" ? err : err.message || err.reason || "";
  const lower = msg.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("action_rejected")) {
    return "Transaction cancelled in wallet.";
  }
  if (lower.includes("insufficient funds")) {
    return "Insufficient ETH balance in your wallet for gas fees.";
  }
  // ethers v6 BAD_DATA: check err.value array for -32005 Too Many Requests
  if (Array.isArray(err?.value)) {
    const hasRateLimit = err.value.some((v) => {
      const vCode = v?.code || v?.error?.code;
      const vMsg = (v?.message || v?.error?.message || "").toLowerCase();
      return vCode === -32005 || vMsg.includes("too many") || vMsg.includes("429");
    });
    if (hasRateLimit) return "Blockchain network is currently busy. Please wait a moment or click Refresh.";
  }
  if (err?.code === "BAD_DATA" || err?.code === -32005) {
    return "Blockchain network is currently busy. Please wait a moment or click Refresh.";
  }
  if (
    lower.includes("-32005") ||
    lower.includes("too many requests") ||
    lower.includes("429") ||
    lower.includes("bad_data") ||
    lower.includes("missing response")
  ) {
    return "Blockchain network is currently busy. Please wait a moment or click Refresh.";
  }
  if (lower.includes("network error") || lower.includes("failed to fetch") || lower.includes("timeout")) {
    return "Connection issue. Please check your internet connection and try again.";
  }
  if (err.reason && typeof err.reason === "string" && !err.reason.includes("{") && !err.reason.includes("[")) {
    return err.reason;
  }
  return fallbackMsg;
};

export const getReadOnlyProvider = () => {
  if (_cachedProvider) return _cachedProvider;
  _cachedProvider = new ethers.JsonRpcProvider(
    FALLBACK_URLS[_cachedProviderIndex],
    11155111,
    { staticNetwork: true }
  );
  return _cachedProvider;
};

// Called when the current provider fails — rotates to the next URL with cooldown
export const rotateProvider = () => {
  const currentUrl = FALLBACK_URLS[_cachedProviderIndex];
  if (currentUrl) {
    _failedRpcCooldowns.set(currentUrl, Date.now() + 60000);
  }

  // IMPORTANT: destroy the old provider before replacing it.
  // Without this, every rotation leaves the old JsonRpcProvider alive with its
  // 'close' and 'end' socket listeners attached, triggering MaxListenersExceededWarning.
  try { _cachedProvider?.destroy(); } catch (_) {}
  _cachedProvider = null;

  let nextIdx = (_cachedProviderIndex + 1) % FALLBACK_URLS.length;
  let attempts = 0;
  while (attempts < FALLBACK_URLS.length) {
    const candidateUrl = FALLBACK_URLS[nextIdx];
    const expiry = _failedRpcCooldowns.get(candidateUrl) || 0;
    if (Date.now() > expiry) {
      _cachedProviderIndex = nextIdx;
      break;
    }
    nextIdx = (nextIdx + 1) % FALLBACK_URLS.length;
    attempts++;
  }

  if (attempts >= FALLBACK_URLS.length) {
    _cachedProviderIndex = (_cachedProviderIndex + 1) % FALLBACK_URLS.length;
  }

  _cachedProvider = new ethers.JsonRpcProvider(
    FALLBACK_URLS[_cachedProviderIndex],
    11155111,
    { staticNetwork: true }
  );
  // URL intentionally omitted from logs to keep RPC credentials private
  console.info(`[RPC] Rotated to provider index ${_cachedProviderIndex}`);
  return _cachedProvider;
};

/**
 * Wraps a provider-dependent async call with auto-rotation on failure.
 * Retries up to `maxRetries` times, rotating the RPC provider each attempt.
 *
 * Usage: await withProviderRetry(() => contract.owner())
 */
export const withProviderRetry = async (fn, maxRetries = 3) => {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(getReadOnlyProvider());
    } catch (err) {
      lastErr = err;
      const rateLimit = isRateLimit(err);
      // Strip any URL from the message before logging (keeps RPC endpoint private)
      const cleanMsg = (err?.message || "").replace(/https?:\/\/[^\s"'`]+/g, "[hidden]");
      console.warn(`[RPC] provider ${_cachedProviderIndex} failed (attempt ${attempt + 1}, ${rateLimit ? "rate-limited" : "error"}):`, cleanMsg);
      rotateProvider();
      if (rateLimit) {
        const waitMs = Math.min(300 * Math.pow(2, attempt), 2000);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw lastErr;
};



export const getProvider = () => {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  return new ethers.BrowserProvider(window.ethereum);
};

export const getSigner = async () => {
  const provider = getProvider();
  return await provider.getSigner();
};

export const getContract = async () => {
  const signer = await getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
};



export const connectWallet = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  await ensureSepolia();
  return accounts[0];
};

export const getConnectedAccount = async () => {
  if (!window.ethereum) return null;

  const accounts = await window.ethereum.request({
    method: "eth_accounts",
  });

  return accounts[0] || null;
};



export const ensureSepolia = async () => {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });

  if (parseInt(chainId, 16) !== SEPOLIA_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xaa36a7",
            chainName: "Sepolia Testnet",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://sepolia.infura.io/v3/"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      } else {
        throw err;
      }
    }
  }
};



export const generateCertHash = (certId, name, course, institution) => {
  const raw = `${certId}:${name}:${course}:${institution}`;
  return ethers.keccak256(ethers.toUtf8Bytes(raw));
};

export const hashFileContent = async (file) => {
  const buffer = await file.arrayBuffer();
  return ethers.keccak256(new Uint8Array(buffer));
};


export const issueCertificate = async (certHash, name, course, ipfsHash) => {
  try {
    const contract = await getContract();

    const tx = await contract.issueCertificate(
      certHash,
      name,
      course,
      ipfsHash
    );

    const receipt = await tx.wait();

    return {
      hash: tx.hash,
      receipt,
    };

  } catch (err) {
    console.error("ISSUE ERROR:", err);
    throw err;
  }
};

export const verifyCertificate = async (certHash) => {
  const contract = await getContract();

  const result = await contract.verifyCertificate(certHash);

  return {
    name: result[0],
    course: result[1],
    ipfsHash: result[2],
    issueDate: Number(result[3]) * 1000,
    issuer: result[4],
    isValid: result[5],
  };
};

export const revokeCertificate = async (certHash) => {
  const contract = await getContract();

  const tx = await contract.revokeCertificate(certHash);
  return await tx.wait();
};

export const addIssuer = async (address) => {
  const contract = await getContract();

  const tx = await contract.addIssuer(address);
  return await tx.wait();
};

export const isAuthorizedIssuer = async (address) => {
  const contract = await getContract();
  return await contract.authorizedIssuers(address);
};



export const shortenAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";

export const shortenHash = (hash) =>
  hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : "—";

export const formatTimestamp = (ms) => {
  if (!ms || ms === 0) return "—";

  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * queryFilterChunked — splits a large block range into chunks of `chunkSize`
 * and processes them SEQUENTIALLY to avoid rate-limiting free-tier RPCs.
 * On failure it waits with exponential backoff, then rotates the RPC provider.
 *
 * @param {ethers.Contract} contract
 * @param {ethers.EventFilter} filter
 * @param {number} fromBlock
 * @param {number|string} toBlock  — pass a number or "latest"
 * @param {ethers.Provider} provider — used to resolve "latest" block number
 * @param {number} chunkSize — blocks per request (default 5000 — safe for free-tier Infura)
 * @param {number} delayMs  — ms to wait between chunks (default 200)
 */
export const queryFilterChunked = async (
  contract,
  filter,
  fromBlock,
  toBlock,
  provider,
  // 9999 stays just under Infura's 10 000-block eth_getLogs limit, preventing
  // recursive binary splitting which would cascade into dozens of requests.
  chunkSize = 9999,
  delayMs = 600   // generous pause between chunks to stay under per-second rate limits
) => {
  let endBlock = toBlock;
  if (toBlock === "latest" || typeof toBlock === "string") {
    try {
      endBlock = await withProviderRetry(() => provider.getBlockNumber());
    } catch (err) {
      const cleanMsg = (err?.message || "").replace(/https?:\/\/[^\s"'`]+/g, "[hidden]");
      console.warn("[queryFilterChunked] getBlockNumber failed, returning empty:", cleanMsg);
      return [];
    }
  }

  if (fromBlock > endBlock) return [];

  // Build all chunk ranges
  const ranges = [];
  for (let start = fromBlock; start <= endBlock; start += chunkSize) {
    ranges.push([start, Math.min(start + chunkSize - 1, endBlock)]);
  }

  const _isRateLimit = (err) => isRateLimit(err);

  // Only fires for genuine "block range too large" responses, NOT rate-limit errors.
  // Previous broad terms like msg.includes("limit") also matched 429 rate-limit
  // messages, causing recursive binary splitting and an explosion of requests.
  const isBlockRangeError = (err) => {
    // Rate-limit errors must never be treated as block-range errors.
    if (_isRateLimit(err)) return false;
    const msg = (err?.message || "").toLowerCase();
    const info = err?.info || {};
    const body = (info?.responseBody || "").toLowerCase();
    return (
      msg.includes("block range") ||
      msg.includes("too large") ||
      body.includes("block range") ||
      body.includes("eth_getlogs is limited") ||
      body.includes("logs query") ||
      body.includes("query returned more than") ||
      (body.includes("range") && body.includes("blocks"))
    );
  };

  // Query a single chunk; on failure wait + rotate, then retry (max 3 attempts)
  const queryChunk = async (s, e, attempt = 0, maxRetries = 3) => {
    try {
      const activeProvider = getReadOnlyProvider();
      const activeContract = contract.connect(activeProvider);
      return await activeContract.queryFilter(filter, s, e);
    } catch (err) {
      // If it is a block range limit error, split the range in half and query recursively.
      // isBlockRangeError already guards against rate-limit errors, so this only
      // fires for genuine "range too large" responses.
      if (isBlockRangeError(err) && e - s > 100) {
        const mid = Math.floor(s + (e - s) / 2);
        const left = await queryChunk(s, mid, 0, maxRetries);
        const right = await queryChunk(mid + 1, e, 0, maxRetries);
        return [...left, ...right];
      }

      if (attempt >= maxRetries) throw err;

      const rl = _isRateLimit(err);
      // Exponential backoff: 1s, 2s, 4s … capped at 10s; plain errors get 300ms
      const waitMs = rl ? Math.min(1000 * 2 ** attempt, 10000) : 300;

      const cleanMsg = (err?.message || "").replace(/https?:\/\/[^\s"'`]+/g, "[hidden]");
      console.warn(
        `[queryFilterChunked] chunk [${s}-${e}] failed (attempt ${attempt + 1}, ${
          rl ? "rate-limited" : "error"
        }, waiting ${waitMs}ms):`,
        cleanMsg
      );

      await new Promise((r) => setTimeout(r, waitMs));
      rotateProvider();
      return queryChunk(s, e, attempt + 1, maxRetries);
    }
  };

  const results = [];

  // Process SEQUENTIALLY — one chunk at a time to stay within free-tier rate limits
  for (let i = 0; i < ranges.length; i++) {
    const [s, e] = ranges[i];
    const chunkResult = await queryChunk(s, e);
    results.push(...chunkResult);
    // Small pause between chunks so we don't burst-hit the RPC
    if (i < ranges.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
};