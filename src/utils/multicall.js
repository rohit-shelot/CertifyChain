import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contractConfig";

/**
 * Multicall3 is deployed at the same address on every EVM chain.
 * https://www.multicall3.com/
 */
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" },
        ],
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate",
    outputs: [
      { name: "blockNumber", type: "uint256" },
      { name: "returnData", type: "bytes[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

/**
 * Build an ethers.Interface once for encoding / decoding verifyCertificate.
 */
const certInterface = new ethers.Interface(CONTRACT_ABI);

/**
 * batchVerifyCertificates
 *
 * Given an array of certHash values, batches them into a single Multicall3
 * `aggregate()` call and returns the decoded Certificate structs keyed by hash.
 *
 * @param {string[]} certHashes - Array of bytes32 cert hashes
 * @param {ethers.Provider} provider - An ethers v6 provider
 * @returns {Map<string, object>} hash → { name, course, ipfsHash, issueDate, issuer, isValid, isEdited }
 */
export const batchVerifyCertificates = async (certHashes, provider) => {
  if (!certHashes.length) return new Map();

  const results = new Map();

  try {
    const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

    // Encode each verifyCertificate(certHash) call
    const calls = certHashes.map((hash) => ({
      target: CONTRACT_ADDRESS,
      callData: certInterface.encodeFunctionData("verifyCertificate", [hash]),
    }));

    // Multicall3 has a gas limit, so split into batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < calls.length; i += BATCH_SIZE) {
      const batch = calls.slice(i, i + BATCH_SIZE);
      const batchHashes = certHashes.slice(i, i + BATCH_SIZE);

      const [, returnData] = await multicall.aggregate(batch);

      for (let j = 0; j < returnData.length; j++) {
        try {
          const decoded = certInterface.decodeFunctionResult(
            "verifyCertificate",
            returnData[j]
          );
          // decoded[0] is the Certificate tuple
          const cert = decoded[0];
          results.set(batchHashes[j], {
            name: cert[0] || cert.name || "",
            course: cert[1] || cert.course || "",
            ipfsHash: cert[2] || cert.ipfsHash || "",
            issueDate: cert[3] || cert.issueDate || 0n,
            issuer: cert[4] || cert.issuer || "",
            isValid: cert[5] ?? cert.isValid ?? false,
            isEdited: cert[6] ?? cert.isEdited ?? false,
          });
        } catch (_) {
          // Individual decode failure — skip this cert
        }
      }
    }
  } catch (err) {
    console.warn("[multicall] aggregate failed, falling back to parallel calls:", err.message);
    // Fallback: parallel individual calls (still faster than sequential)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const settled = await Promise.allSettled(
      certHashes.map((hash) => contract.verifyCertificate(hash))
    );
    for (let i = 0; i < settled.length; i++) {
      if (settled[i].status === "fulfilled") {
        const cert = settled[i].value;
        results.set(certHashes[i], {
          name: cert[0] || "",
          course: cert[1] || "",
          ipfsHash: cert[2] || "",
          issueDate: cert[3] || 0n,
          issuer: cert[4] || "",
          isValid: cert[5] ?? false,
          isEdited: cert[6] ?? false,
        });
      }
    }
  }

  return results;
};

/**
 * batchGetBlocks
 *
 * Given an array of block numbers, fetches each *unique* block only once
 * and returns a Map of blockNumber → block.
 *
 * @param {number[]} blockNumbers
 * @param {ethers.Provider} provider
 * @returns {Map<number, ethers.Block>}
 */
export const batchGetBlocks = async (blockNumbers, provider) => {
  const unique = [...new Set(blockNumbers)];
  const blockMap = new Map();

  // Fetch in parallel, batches of 20 to avoid rate-limits
  const BATCH = 20;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const blocks = await Promise.allSettled(
      batch.map((num) => provider.getBlock(num))
    );
    for (let j = 0; j < blocks.length; j++) {
      if (blocks[j].status === "fulfilled" && blocks[j].value) {
        blockMap.set(batch[j], blocks[j].value);
      }
    }
  }

  return blockMap;
};
