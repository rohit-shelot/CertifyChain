import axios from "axios";
import { configDotenv } from "dotenv";
import { PINATA_JWT, IPFS_GATEWAY } from "./contractConfig";

const PINATA_API = "https://api.pinata.cloud";

/**
 * Upload a file to IPFS via Pinata
 * @param {File} file
 * @param {object} metadata - { name, keyvalues }
 * @returns {string} IPFS CID
 */
export const uploadToIPFS = async (file, metadata = {}) => {

  const formData = new FormData();
  formData.append("file", file);
  formData.append("pinataMetadata", JSON.stringify({
    name: metadata.name || file.name,
    keyvalues: metadata.keyvalues || {},
  }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const response = await axios.post(
    `${PINATA_API}/pinning/pinFileToIPFS`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Upload progress: ${pct}%`);
      },
    }
  );

  return response.data.IpfsHash;
};

/**
 * Returns a full IPFS gateway URL for a given CID
 * @param {string} cid
 * @returns {string}
 */
export const ipfsUrl = (cid) => `${IPFS_GATEWAY}${cid}`;


export const testPinataAuth = async () => {
  const response = await axios.get(`${PINATA_API}/data/testAuthentication`, {
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
  });
  return response.data;
};