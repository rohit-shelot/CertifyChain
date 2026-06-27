import axios from "axios";
import { IPFS_GATEWAY } from "./contractConfig";

/**
 * Base URL of the backend proxy server.
 * The proxy holds the Pinata JWT — it never appears in the browser bundle.
 *
 * In development  → http://localhost:3001  (Backend/server.js running locally)
 * In production   → set VITE_API_BASE_URL to your deployed backend URL
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

/**
 * Upload a file to IPFS via the backend proxy (which forwards to Pinata).
 * The Pinata JWT never touches the browser.
 *
 * @param {File} file
 * @param {object} metadata - { name, keyvalues }
 * @returns {string} IPFS CID
 */
export const uploadToIPFS = async (file, metadata = {}) => {
  const formData = new FormData();
  formData.append("file", file);

  if (metadata.name) {
    formData.append("name", metadata.name);
  }
  if (metadata.keyvalues) {
    formData.append("keyvalues", JSON.stringify(metadata.keyvalues));
  }

  const response = await axios.post(`${API_BASE}/api/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (progressEvent) => {
      const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      console.log(`Upload progress: ${pct}%`);
    },
  });

  return response.data.IpfsHash;
};

/**
 * Returns a full IPFS gateway URL for a given CID
 * @param {string} cid
 * @returns {string}
 */
export const ipfsUrl = (cid) => `${IPFS_GATEWAY}${cid}`;