import { useCallback } from "react";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  generateCertHash,
} from "../utils/ethers";
import { uploadToIPFS } from "../utils/pinata";
import { useWallet } from "../context/WalletContext";

export const useContract = () => {
  const { account } = useWallet();

  const getContract = async () => {
    if (!window.ethereum) throw new Error("MetaMask not found");

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
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

      const signerAddress = await contract.runner.getAddress();
      console.log("ISSUE → signer:", signerAddress);

      const isIssuer = await contract.authorizedIssuers(signerAddress);
      console.log("ISSUE → isIssuer:", isIssuer);

      if (!isIssuer) {
        toast.error("You are NOT an authorized issuer", { id: toastId });
        throw new Error("Not an authorized issuer");
      }

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
      console.error("ISSUE ERROR:", err);
      toast.error("Transaction failed: " + (err.reason || err.message), { id: toastId });
      throw err;
    }
  }, [account]);

  const verify = useCallback(async (certHash) => {
    const toastId = toast.loading("Verifying on blockchain...");

    try {
      const contract = await getContract();

      const data = await contract.verifyCertificate(certHash);

      const name      = data[0];
      const course    = data[1];
      const ipfsHash  = data[2];
      const issueDate = Number(data[3]) * 1000;
      const issuer    = data[4];
      const isValid   = data[5];

      if (!name || name === "") {
        toast.error("Certificate not found", { id: toastId });
        return { found: false };
      }

      toast.success("Verification complete", { id: toastId });

      return { found: true, name, course, ipfsHash, issueDate, issuer, isValid };

    } catch (err) {
      toast.error("Verification failed: " + err.message, { id: toastId });
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
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const result = await contract.authorizedIssuers(address);

      console.log("CHECK →", address, result);

      return result;

    } catch (err) {
      console.error("CHECK ERROR:", err);
      return false;
    }
  }, []);

  const checkOwner = useCallback(async (address) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const ownerAddr = await contract.owner();

      console.log("OWNER CHECK →", address, ownerAddr);

      return ownerAddr.toLowerCase() === address.toLowerCase();

    } catch (err) {
      console.error("OWNER CHECK ERROR:", err);
      return false;
    }
  }, []);

  const checkExists = useCallback(async (certHash) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const data = await contract.verifyCertificate(certHash);
      return (data[0] && data[0] !== "");
    } catch (err) {
      return false;
    }
  }, []);

  const checkCertIdExists = useCallback(async (certId) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const filter = contract.filters.CertificateIssued();
      const events = await contract.queryFilter(filter, 0, 'latest');
      for (let event of events) {
        const courseStr = event.args[2] || ""; 
        if (courseStr.includes(`| ID: ${certId}`)) {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("Error checking events:", err);
      return false; 
    }
  }, []);

  return { issue, verify, revoke, addNewIssuer, checkIssuer, checkOwner, checkExists, checkCertIdExists };
};

export default useContract;