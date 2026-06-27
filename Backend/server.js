const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const axios    = require("axios");
const FormData = require("form-data");
const path     = require("path");
require("dotenv").config();

const app = express();

const PORT       = process.env.PORT || 3001;
const PINATA_JWT = process.env.PINATA_JWT;

if (!PINATA_JWT) {
  console.error("❌  PINATA_JWT is not set in .env — the proxy cannot authenticate to Pinata.");
  process.exit(1);
}

app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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

    return res.json({ IpfsHash: response.data.IpfsHash });

  } catch (err) {
    const status  = err.response?.status  || 500;
    const message = err.response?.data?.error?.details || err.message || "Upload failed";
    console.error("[/api/upload] Pinata error:", status, message);
    return res.status(status).json({ error: message });
  }
});

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅  CertChain running on http://localhost:${PORT}`);
});
