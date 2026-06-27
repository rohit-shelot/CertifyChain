export { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_DEPLOYMENT_BLOCK, SEPOLIA_RPC } from "./contractConfig";

import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_DEPLOYMENT_BLOCK, SEPOLIA_RPC, SEPOLIA_CHAIN_ID } from "./contractConfig";

// Sequential provider — tries each URL one at a time until one succeeds.
// Unlike FallbackProvider which fires ALL providers in parallel (causing 4× requests),
// this only uses one provider at a time and only falls over if it throws.
let _cachedProvider = null;
let _cachedProviderIndex = 0;

const FALLBACK_URLS = [
  "https://rpc.ankr.com/eth_sepolia",
  "https://sepolia.gateway.tenderly.co",
  "https://rpc.sepolia.ethpandaops.io",
  SEPOLIA_RPC,
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
 * and processes them in parallel batches of `concurrency`.
 * On a chunk failure it automatically rotates to the next RPC provider and retries.
 *
 * @param {ethers.Contract} contract
 * @param {ethers.EventFilter} filter
 * @param {number} fromBlock
 * @param {number|string} toBlock  — pass a number or "latest"
 * @param {ethers.Provider} provider — used to resolve "latest" block number
 * @param {number} chunkSize — blocks per request (default 20000)
 * @param {number} concurrency — max parallel fetches (default 4)
 */
export const queryFilterChunked = async (
  contract,
  filter,
  fromBlock,
  toBlock,
  provider,
  chunkSize = 20000,
  concurrency = 4
) => {
  let endBlock = toBlock;
  if (toBlock === "latest" || typeof toBlock === "string") {
    endBlock = await provider.getBlockNumber();
  }

  // Build all chunk ranges
  const ranges = [];
  for (let start = fromBlock; start <= endBlock; start += chunkSize) {
    ranges.push([start, Math.min(start + chunkSize - 1, endBlock)]);
  }

  const results = [];

  // Helper: query one chunk, auto-rotating provider on failure (max 3 retries)
  const queryChunk = async (s, e, retriesLeft = 3) => {
    try {
      const activeProvider = getReadOnlyProvider();
      const activeContract = contract.connect(activeProvider);
      return await activeContract.queryFilter(filter, s, e);
    } catch (err) {
      if (retriesLeft > 0) {
        console.warn(`[queryFilterChunked] chunk failed, rotating provider. (${retriesLeft} retries left):`, err?.message);
        rotateProvider();
        return queryChunk(s, e, retriesLeft - 1);
      }
      throw err;
    }
  };

  // Process in parallel batches of `concurrency`
  for (let i = 0; i < ranges.length; i += concurrency) {
    const batch = ranges.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(([s, e]) => queryChunk(s, e))
    );
    for (const r of batchResults) {
      if (r.status === "rejected") {
        throw new Error(r.reason?.message || "RPC query chunk failed after all retries");
      }
      results.push(...r.value);
    }
  }

  return results;
};