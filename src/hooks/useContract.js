import { useCallback } from "react";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  CONTRACT_DEPLOYMENT_BLOCK,
  SEPOLIA_RPC,
  generateCertHash,
  queryFilterChunked,
  getReadOnlyProvider,
  withProviderRetry,
} from "../utils/ethers";
import { uploadToIPFS } from "../utils/pinata";
import { useWallet } from "../context/WalletContext";
import { loadCachedEvents, saveCachedEvents } from "../utils/eventCache";
const logErrorSafely = (context, err) => {
  const cleanMsg = (err?.message || "").replace(/https?:\/\/[^\s"'`]+/g, "[RPC_ENDPOINT]");
  console.error(`${context}:`, cleanMsg);
};

export const useContract = () => {
  const { account } = useWallet();

  const getContract = async () => {
    if (!window.ethereum) throw new Error("MetaMask not found");

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  };

  const getReadOnlyContract = () => {
    const provider = getReadOnlyProvider();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  };

  const issue = useCallback(async ({ name, course, institution, grade, certId, file }) => {
    if (!account) throw new Error("Wallet not connected");

    let ipfsHash = "";

    if (file) {
      const toastId = toast.loading("Uploading to IPFS...");
      try {
        ipfsHash = await uploadToIPFS(file, {
          name: `${certId}_${name}.pdf`,
          keyvalues: { certId, name, course },
        });
        toast.success("Uploaded to IPFS!", { id: toastId });
      } catch (err) {
        toast.error("IPFS upload failed: " + err.message, { id: toastId });
        throw err;
      }
    }

    const certHash = generateCertHash(certId, name, course, institution);
    const toastId = toast.loading("Preparing transaction...");

    try {
      const contract = await getContract();

      toast.loading("Confirm in MetaMask...", { id: toastId });

      const tx = await contract.issueCertificate(
        certHash,
        name,
        course,
        ipfsHash
      );

      const receipt = await tx.wait();

      toast.success("Certificate issued successfully!", { id: toastId });

      return {
        certHash,
        ipfsHash,
        txHash: tx.hash,
        receipt,
      };

    } catch (err) {
      logErrorSafely("ISSUE ERROR", err);
      toast.error("Transaction failed: " + (err.reason || err.message), { id: toastId });
      throw err;
    }
  }, [account]);

  const verify = useCallback(async (certHash) => {
    const toastId = toast.loading("Verifying on blockchain...");

    try {
      const data = await withProviderRetry((p) => {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, p);
        return contract.verifyCertificate(certHash);
      });

      const name      = data[0];
      const course    = data[1];
      const ipfsHash  = data[2];
      const issueDate = Number(data[3]) * 1000;
      const issuer    = data[4];
      const isValid   = data[5];
      const isEdited  = data[6];

      if (!name || name === "") {
        toast.error("Certificate not found", { id: toastId });
        return { found: false };
      }

      if (isValid) {
        toast.success("Certificate is Valid!", { id: toastId });
      } else {
        toast.error("Certificate has been Revoked!", { id: toastId });
      }

      return { found: true, name, course, ipfsHash, issueDate, issuer, isValid, isEdited };

    } catch (err) {
      logErrorSafely("VERIFY ERROR", err);
      toast.error("Certificate not found or invalid hash", { id: toastId });
      throw err;
    }
  }, [account]);

  const revoke = useCallback(async (certHash) => {
    if (!account) throw new Error("Wallet not connected");

    const toastId = toast.loading("Revoking certificate...");

    try {
      const contract = await getContract();

      const tx = await contract.revokeCertificate(certHash);
      const receipt = await tx.wait();

      toast.success("Certificate revoked!", { id: toastId });

      return receipt;

    } catch (err) {
      toast.error("Revocation failed: " + (err.reason || err.message), { id: toastId });
      throw err;
    }
  }, [account]);

  const edit = useCallback(async ({ certHash, name, course, file, existingIpfsHash }) => {
    if (!account) throw new Error("Wallet not connected");

    const toastId = toast.loading("Updating certificate...");

    try {
      let ipfsHash = existingIpfsHash || "";
      if (file) {
        toast.loading("Uploading new document to IPFS...", { id: toastId });
        const res = await uploadToIPFS(file);
        ipfsHash = res.IpfsHash;
      }

      const contract = await getContract();

      toast.loading("Confirm edit in MetaMask...", { id: toastId });
      const tx = await contract.editCertificate(certHash, name, course, ipfsHash);

      const receipt = await tx.wait();

      toast.success("Certificate updated successfully!", { id: toastId });

      return {
        certHash,
        ipfsHash,
        txHash: tx.hash,
        receipt,
      };

    } catch (err) {
      logErrorSafely("EDIT ERROR", err);
      toast.error("Edit failed: " + (err.reason || err.message), { id: toastId });
      throw err;
    }
  }, [account]);

  const addNewIssuer = useCallback(async (address) => {
    if (!account) throw new Error("Wallet not connected");

    const toastId = toast.loading("Adding issuer...");

    try {
      const contract = await getContract();

      const tx = await contract.addIssuer(address);
      const receipt = await tx.wait();

      toast.success("Issuer added!", { id: toastId });

      return receipt;

    } catch (err) {
      toast.error("Failed: " + (err.reason || err.message), { id: toastId });
      throw err;
    }
  }, [account]);
  const checkIssuer = useCallback(async (address) => {
    try {
      const result = await withProviderRetry((p) => {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, p);
        return contract.authorizedIssuers(address);
      });


      return result;

    } catch (err) {
      logErrorSafely("CHECK ERROR", err);
      return false;
    }
  }, []);

  const checkOwner = useCallback(async (address) => {
    try {
      const ownerAddr = await withProviderRetry((p) => {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, p);
        return contract.owner();
      });


      return ownerAddr.toLowerCase() === address.toLowerCase();

    } catch (err) {
      logErrorSafely("OWNER CHECK ERROR", err);
      return false;
    }
  }, []);

  const checkExists = useCallback(async (certHash) => {
    try {
      const data = await withProviderRetry((p) => {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, p);
        return contract.verifyCertificate(certHash);
      });
      return (data[0] && data[0] !== "");
    } catch (err) {
      return false;
    }
  }, []);

  const getIssuedCoursesCached = async () => {
    const CACHE_KEY = "certissued_all_courses";
    const cached = loadCachedEvents(CACHE_KEY);
    const provider = getReadOnlyProvider();
    const contract = getReadOnlyContract();
    const currentBlock = await withProviderRetry((p) => p.getBlockNumber());

    let courses = [];
    let startBlock = CONTRACT_DEPLOYMENT_BLOCK;

    if (cached) {
      courses = cached.events;
      if (currentBlock <= cached.lastBlock) {
        return courses;
      }
      startBlock = cached.lastBlock + 1;
    }

    const filter = contract.filters.CertificateIssued();
    const newLogs = await queryFilterChunked(contract, filter, startBlock, currentBlock, provider);
    const newCourses = newLogs.map((log) => log.args?.[2] || log.args?.course || "");

    const allCourses = [...courses, ...newCourses];
    saveCachedEvents(CACHE_KEY, currentBlock, allCourses);
    return allCourses;
  };

  const checkCertIdExists = useCallback(async (certId) => {
    try {
      const courses = await getIssuedCoursesCached();
      for (let courseStr of courses) {
        if (courseStr.includes(`| ID: ${certId}`)) {
          return true;
        }
      }
      return false;
    } catch (err) {
      logErrorSafely("Error checking events", err);
      return false;
    }
  }, []);

  const getNextCertId = useCallback(async () => {
    try {
      const courses = await getIssuedCoursesCached();
      let maxNum = 0;
      for (const courseStr of courses) {
        const match = courseStr.match(/CERT-(\d+)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
      return `CERT-${maxNum + 1}`;
    } catch (err) {
      logErrorSafely("getNextCertId error", err);
      return `CERT-1`;
    }
  }, []);

  return { issue, verify, revoke, edit, addNewIssuer, checkIssuer, checkOwner, checkExists, checkCertIdExists, getNextCertId };
};

export default useContract;