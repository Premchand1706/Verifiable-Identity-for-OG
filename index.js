// index.js - The "All-in-One" VID-Pipe Server

// 1. CONFIGURATION & IMPORTS
const path = require('path');
// Load .env from the current directory immediately
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { LRUCache } = require("lru-cache");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

console.log("-----------------------------------------");
console.log("🚀 Starting VID-Pipe Server...");
console.log("-----------------------------------------");

// 2. DATABASE CONNECTION (Supabase)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ CRITICAL ERROR: .env file is missing SUPABASE_URL or SUPABASE_KEY");
  process.exit(1); // Force crash if keys are missing
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});
console.log("✅ Database Client Initialized");

// 3. CACHE CONFIGURATION (0G Simulation)
const CACHE_TTL = 1000 * 60 * 60; // 1 Hour
const proofCache = new LRUCache({
  max: 5000,
  ttl: CACHE_TTL,
  allowStale: false,
});
console.log("✅ In-Memory Cache Initialized");

// 4. VERIFICATION LOGIC
function generateIdentityHash(issuer, credential) {
  const dataString = JSON.stringify({
    issuer: issuer.trim().toLowerCase(),
    credential: credential.trim(),
  });
  return crypto.createHash("sha256").update(dataString).digest("hex");
}

function generateMockProof() {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

// 5. SERVER SETUP
const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.static("public")); // Serve the HTML UI

// 6. MAIN API ROUTE
app.post("/check", async (req, res) => {
  const { issuer, credential } = req.body;

  if (!issuer || !credential) {
    return res.status(400).json({ error: "Missing issuer or credential" });
  }

  // Create Deterministic ID (CID)
  const requestHash = generateIdentityHash(issuer, credential);

  try {
    // --- LAYER 1: MEMORY CACHE (Fastest - <5ms) ---
    if (proofCache.has(requestHash)) {
      console.log(`⚡ [CACHE HIT] Serving ${requestHash.substring(0,8)} from RAM`);
      const cachedResult = proofCache.get(requestHash);
      return res.status(200).json({ ...cachedResult, source: "0G_RAM_CACHE" });
    }

    // --- LAYER 2: SUPABASE STORAGE (Fast - ~100ms) ---
    const { data: dbData } = await supabase
      .from("identity_verifications")
      .select("*")
      .eq("hash", requestHash)
      .single();

    if (dbData) {
      console.log(`💾 [DB HIT] Serving ${requestHash.substring(0,8)} from Disk`);
      // Update RAM cache for next time
      const result = {
        success: true,
        verified: dbData.verified,
        proof: dbData.proof_signature,
        message: "Retrieved from persistent storage"
      };
      proofCache.set(requestHash, result);
      return res.status(200).json({ ...result, source: "0G_DISK_CACHE" });
    }

    // --- LAYER 3: COMPUTE (Slow - ~1500ms) ---
    console.log(`⚙️ [COMPUTE] Verifying New Identity: ${issuer}`);
    
    // Simulate Heavy ZK Computation
    await new Promise(r => setTimeout(r, 1500)); 

    const isVerified = true; // Hackathon Demo: Always verify valid inputs
    const proofSignature = generateMockProof();

    const newResult = {
      success: true,
      verified: isVerified,
      proof: proofSignature,
      message: "New Identity Verified & Cached"
    };

    // Save to DB (Fire & Forget)
    supabase.from("identity_verifications").insert([{
      hash: requestHash,
      issuer: issuer,
      credential: credential,
      verified: isVerified,
      proof_signature: proofSignature
    }]).then(() => console.log("📝 Saved to DB"));

    // Save to RAM
    proofCache.set(requestHash, newResult);

    res.status(200).json({ ...newResult, source: "NEW_COMPUTE" });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Verification Failed" });
  }
});

// 7. START LISTENER
app.listen(PORT, () => {
  console.log(`\n🟢 SERVER ONLINE at http://localhost:${PORT}`);
  console.log("   ready for requests...\n");
});