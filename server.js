/**
 * VID-Pipe Core Node
 * * enhanced for: 
 * 1. High Throughput (via LRU Caching)
 * 2. Security (Helmet, Rate Limiting, Input Validation)
 * 3. Observability (Structured Logging)
 * 4. Deterministic Verification (Simulating 0G Code-to-Cache)
 */

const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { LRUCache } = require("lru-cache");
const crypto = require("crypto");

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const CACHE_TTL = 1000 * 60 * 60; // 1 Hour Cache (Simulates 0G Persistence)

// --- Mock Verification Logic (Replace with actual WASM/Rust module later) ---
// This simulates the heavy compute task we want to avoid repeating.
const mockZeroKnowledgeVerify = async (issuer, credential) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Logic: If credential ID starts with 'valid', it passes.
      const isValid = credential.id && credential.id.startsWith("valid");
      resolve({
        verified: isValid,
        trustScore: isValid ? 98 : 0,
        timestamp: Date.now(),
        proof: crypto.randomBytes(16).toString("hex"), // Mock ZK-SNARK proof
      });
    }, 500); // Simulate 500ms compute latency
  });
};

// --- caching Layer ( The "0G" Simulation) ---
// Options configured for max performance and memory management
const proofCache = new LRUCache({
  max: 5000, // Max 5k items
  ttl: CACHE_TTL, 
  allowStale: false,
});

const app = express();

// --- Middleware Layer 1: Security & Optimization ---
app.use(helmet()); // Secure HTTP headers
app.use(compression()); // Gzip compression for faster payload transfer
app.use(express.json({ limit: "10kb" })); // Prevent large payload attacks
app.use(express.static("public"));

// Rate Limiting: Prevent Brute Force / DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/check", limiter);

// --- Middleware Layer 2: Deterministic ID Generation ---
// We create a unique hash for the input. If inputs match, the hash matches.
const generateRequestHash = (req, res, next) => {
  const { issuer, credential } = req.body;
  if (!issuer || !credential) {
    return res.status(400).json({ error: "Missing issuer or credential data" });
  }

  // Create a deterministic key based on the input data
  const dataString = JSON.stringify({ issuer, credential });
  const hash = crypto.createHash("sha256").update(dataString).digest("hex");
  
  req.requestHash = hash;
  next();
};

// --- Core Route: The VID-Pipe Logic ---
app.post("/check", generateRequestHash, async (req, res) => {
  const { requestHash } = req;
  const { issuer, credential } = req.body;

  try {
    // STEP 1: CACHE LOOKUP (The "Code-to-Cache" Speed)
    // If we have verified this specific data bundle before, return immediately.
    if (proofCache.has(requestHash)) {
      console.log(`[CACHE HIT] Serving proof for ${requestHash.substring(0, 8)}...`);
      const cachedResult = proofCache.get(requestHash);
      
      // Return cached result with specific header indicating source
      return res.status(200)
        .set('X-Source', 'Cache')
        .json({ ...cachedResult, source: "0G_CACHE_LAYER" });
    }

    // STEP 2: HEAVY COMPUTE (Run Verification)
    console.log(`[CACHE MISS] Running verification for ${requestHash.substring(0, 8)}...`);
    const result = await mockZeroKnowledgeVerify(issuer, credential);

    // STEP 3: CACHE COMMITMENT
    // Store the result. In production, this writes to the 0G DA Layer.
    proofCache.set(requestHash, result);

    // STEP 4: RESPONSE
    res.status(200)
      .set('X-Source', 'Compute')
      .json({ ...result, source: "NEW_COMPUTE" });

  } catch (error) {
    console.error("Verification Error:", error);
    res.status(500).json({ error: "Internal Verification Protocol Failed" });
  }
});

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`\n🚀 VID-Pipe Node active on http://localhost:${PORT}`);
  console.log(`🛡️  Security: Active`);
  console.log(`⚡ Caching: LRU Strategy (TTL: ${CACHE_TTL/1000}s)`);
});