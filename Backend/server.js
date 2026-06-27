/**
 * CertChain Backend Proxy
 *
 * Keeps sensitive API keys (Pinata JWT) server-side so they never appear
 * in the browser bundle. The frontend calls /api/upload; this server
 * forwards to Pinata with the real credentials.
 */

const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const axios    = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const app = express();

// ── Config ────────────────────────────────────────────────────────────────────
const PORT            = process.env.PORT || 3001;
const PINATA_JWT      = process.env.PINATA_JWT;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

if (!PINATA_JWT) {
  console.error("❌  PINATA_JWT is not set in .env — the proxy cannot authenticate to Pinata.");
  process.exit(1);
}

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  FRONTEND_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like server-to-server health checks or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

// multer stores file in memory (fine for PDF/image uploads up to 20 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── POST /api/upload ──────────────────────────────────────────────────────────
// Accepts: multipart/form-data with fields:
//   file       — the file to pin
//   name       — (optional) file name for Pinata metadata
//   keyvalues  — (optional) JSON-encoded key/value pairs for Pinata metadata
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  try {
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.body.name || req.file.originalname || "file",
      contentType: req.file.mimetype,
    });

    // Optional metadata
    const metadata = {
      name: req.body.name || req.file.originalname || "file",
    };
    if (req.body.keyvalues) {
      try { metadata.keyvalues = JSON.parse(req.body.keyvalues); } catch (_) {}
    }
    form.append("pinataMetadata", JSON.stringify(metadata));
    form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    // Return just the CID — nothing sensitive
    return res.json({ IpfsHash: response.data.IpfsHash });

  } catch (err) {
    const status  = err.response?.status  || 500;
    const message = err.response?.data?.error?.details || err.message || "Upload failed";
    console.error("[/api/upload] Pinata error:", status, message);
    return res.status(status).json({ error: message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  CertChain backend proxy running on http://localhost:${PORT}`);
  console.log(`   Accepting requests from: ${FRONTEND_ORIGIN}`);
});
