/**
 * VID-Pipe Persistence Layer
 * --------------------------
 * Acts as the interface to the "0G Cache" (simulated via Supabase).
 * Implements the "Verify Once, Trust Forever" architecture.
 */

require("dotenv").config(); // Load environment variables securely
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

// --- 1. Singleton Database Connection ---
// Prevents connection leaks in serverless/high-load environments.
class DatabaseService {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error("❌ MISSING ENV: SUPABASE_URL or SUPABASE_KEY");
    }
    this.client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
      auth: { persistSession: false }, // Optimization: No auth needed for server-side
      db: { schema: 'public' }
    });
  }

  getClient() {
    return this.client;
  }
}

const supabase = new DatabaseService().getClient();

// --- 2. Helper: Deterministic Hashing ---
// Generates a unique "Fingerprint" for the credential. 
// If the Issuer + Credential are the same, this Hash is always the same.
const generateFingerprint = (issuer, credential) => {
  const payload = JSON.stringify({ issuer, credentialId: credential.id });
  return crypto.createHash("sha256").update(payload).digest("hex");
};

// --- 3. The Core Logic: Verification Pipeline ---
/**
 * The VID-Pipe Workflow:
 * 1. Calculate Hash.
 * 2. Check DB (Cache).
 * 3. If missing -> Verify (Compute) -> Store.
 */
const verifyIdentity = async (issuer, credential) => {
  const fingerprint = generateFingerprint(issuer, credential);
  console.log(`\n🔍 Processing Identity: ${fingerprint.substring(0, 8)}...`);

  try {
    // --- STEP A: THE CACHE LOOKUP (Read Layer) ---
    // We query specifically for the hash. This is extremely fast due to indexing.
    const { data: cachedProof, error: fetchError } = await supabase
      .from("verification_proofs")
      .select("*")
      .eq("content_hash", fingerprint)
      .gt("expires_at", new Date().toISOString()) // Only get non-expired proofs
      .single();

    if (cachedProof) {
      console.log("✅ CACHE HIT: Retrieved proof from Storage Layer.");
      return {
        success: true,
        verified: cachedProof.is_valid,
        trustScore: cachedProof.trust_score,
        source: "PERSISTENT_CACHE", // Provenance tracking
        proof: cachedProof.proof_data,
        latency: "Low (<50ms)" 
      };
    }

    // --- STEP B: THE VERIFICATION COMPUTE (Write Layer) ---
    // If we reach here, it's a "Cache Miss". We must do the heavy lifting.
    console.log("⚠️ CACHE MISS: Running Verification Logic...");
    
    // SIMULATION: This represents complex ZK-Circuit computation or DID Resolution
    // In a real hackathon, you'd use libraries like 'did-jwt' or 'circom' here.
    const verificationResult = await performHeavyVerification(issuer, credential);

    // --- STEP C: CACHE POPULATION ---
    // Store the result so the next request is instant.
    const { error: insertError } = await supabase
      .from("verification_proofs")
      .insert([
        {
          content_hash: fingerprint,
          is_valid: verificationResult.isValid,
          trust_score: verificationResult.score,
          proof_data: verificationResult.proof,
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24hr TTL
        },
      ]);

    if (insertError) {
      console.error("❌ Storage Failure:", insertError.message);
      // We don't fail the request, but we log that caching failed.
    } else {
      console.log("💾 CACHE UPDATED: Proof stored on-chain (simulated).");
    }

    return {
      success: true,
      verified: verificationResult.isValid,
      trustScore: verificationResult.score,
      source: "NEW_COMPUTE",
      proof: verificationResult.proof,
      latency: "High (Processed)"
    };

  } catch (err) {
    console.error("🚨 System Error:", err.message);
    return { success: false, error: "Identity Pipeline Failure" };
  }
};

// --- 4. Mock Verification Logic (The "Heavy" Lift) ---
const performHeavyVerification = async (issuer, credential) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock Logic: valid if issuer is trusted
      const isValid = issuer.startsWith("did:ethr"); 
      resolve({
        isValid,
        score: isValid ? 99 : 10,
        proof: { 
          method: "zk-snark", 
          timestamp: Date.now(),
          signature: crypto.randomBytes(32).toString('hex') 
        }
      });
    }, 1500); // Artificial 1.5s delay to demonstrate the benefit of caching
  });
};

module.exports = verifyIdentity;