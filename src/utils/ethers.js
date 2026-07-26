export { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_DEPLOYMENT_BLOCK, SEPOLIA_RPC } from "./contractConfig";

import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_DEPLOYMENT_BLOCK, SEPOLIA_RPC, SEPOLIA_CHAIN_ID } from "./contractConfig";

// Sequential provider — tries each URL one at a time until one succeeds.
// Unlike FallbackProvider which fires ALL providers in parallel (causing 4× requests),
// this only uses one provider at a time and only falls over if it throws.
let _cachedProvider = null;
let _cachedProviderIndex = 0;

const FALLBACK_URLS = [
  SEPOLIA_RPC, // Primary: from .env (VITE_SEPOLIA_RPC)
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.ankr.com/eth_sepolia",
  "https://sepolia.gateway.tenderly.co",
  "https://rpc.sepolia.ethpandaops.io",
  "https://rpc2.sepolia.org",
].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i); // unique

export const getReadOnlyProvider = () => {
  // Return the cached active provider so we don't recreate on every call
  if (_cachedProvider) return _cachedProvider;
  _cachedProvider = new ethers.JsonRpcProvider(
    FALLBACK_URLS[_cachedProviderIndex],
    11155111,
    { staticNetwork: true }
  );
  return _cachedProvider;
};

// Called when the current provider fails — rotates to the next URL
export const rotateProvider = () => {
  _cachedProviderIndex = (_cachedProviderIndex + 1) % FALLBACK_URLS.length;
  _cachedProvider = new ethers.JsonRpcProvider(
    FALLBACK_URLS[_cachedProviderIndex],
    11155111,
    { staticNetwork: true }
  );
  console.info(`[RPC] Rotated to: ${FALLBACK_URLS[_cachedProviderIndex]}`);
  return _cachedProvider;
};

/**
 * Wraps a provider-dependent async call with auto-rotation on failure.
 * Retries up to `maxRetries` times, rotating the RPC provider each attempt.
 *
 * Usage: await withProviderRetry(() => contract.owner())
 */
export const withProviderRetry = async (fn, maxRetries = FALLBACK_URLS.length - 1) => {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[RPC] Call failed (attempt ${attempt + 1}), rotating provider:`, err?.message);
      rotateProvider();
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
  chunkSize = 5000,
  delayMs = 200
) => {
  let endBlock = toBlock;
  if (toBlock === "latest" || typeof toBlock === "string") {
    endBlock = await withProviderRetry(() => provider.getBlockNumber());
  }

  if (fromBlock > endBlock) return [];

  // Build all chunk ranges
  const ranges = [];
  for (let start = fromBlock; start <= endBlock; start += chunkSize) {
    ranges.push([start, Math.min(start + chunkSize - 1, endBlock)]);
  }

  const results = [];

  // Returns true if the error is a rate-limit (HTTP 429 / RPC -32005)
  const isRateLimit = (err) => {
    const msg = err?.message || "";
    const info = err?.info || {};
    if (msg.includes("429") || msg.includes("Too Many")) return true;
    const body = info?.responseBody || "";
    try {
      const parsed = JSON.parse(body);
      if (parsed?.error?.code === -32005) return true;
    } catch (_) { /* not JSON */ }
    // ethers wraps batch errors as arrays in err.value
    if (Array.isArray(err?.value)) {
      return err.value.some((v) => v?.error?.code === -32005 || v?.code === -32005);
    }
    return false;
  };

  // Query a single chunk; on failure wait + rotate, then retry (max `maxRetries` times)
  const queryChunk = async (s, e, attempt = 0, maxRetries = FALLBACK_URLS.length * 2) => {
    try {
      const activeProvider = getReadOnlyProvider();
      const activeContract = contract.connect(activeProvider);
      return await activeContract.queryFilter(filter, s, e);
    } catch (err) {
      if (attempt >= maxRetries) throw err;

      const rateLimit = isRateLimit(err);
      // Exponential backoff: 1s, 2s, 4s … capped at 10s; plain errors get 300ms
      const waitMs = rateLimit ? Math.min(1000 * 2 ** attempt, 10000) : 300;

      console.warn(
        `[queryFilterChunked] chunk [${s}-${e}] failed (attempt ${attempt + 1}, ${
          rateLimit ? "rate-limited" : "error"
        }, waiting ${waitMs}ms):`,
        err?.message
      );

      await new Promise((r) => setTimeout(r, waitMs));
      rotateProvider();
      console.info(`[RPC] Rotated to: ${FALLBACK_URLS[_cachedProviderIndex]}`);
      return queryChunk(s, e, attempt + 1, maxRetries);
    }
  };

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