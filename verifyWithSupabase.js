// verifyWithSupabase.js
const crypto = require("crypto");
const supabase = require("./supabaseClient");

/**
 * HELPER: Deterministic Fingerprinting
 * Creates a unique SHA-256 hash for the input data.
 * In a real Web3 app, this mimics the Content ID (CID) used in decentralized storage.
 */
function generateIdentityHash(issuer, credential) {
  const dataString = JSON.stringify({
    issuer: issuer.trim().toLowerCase(),
    credential: credential.trim(),
  });
  return crypto.createHash("sha256").update(dataString).digest("hex");
}

/**
 * HELPER: Mock Zero-Knowledge Proof Generator
 * Simulates the cryptographic output of a verification process.
 */
function generateMockProof() {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

/**
 * MAIN FUNCTION: Verify Identity with Caching Strategy
 * ----------------------------------------------------
 * Optimization Goal: Reduce latency by serving cached results ("Cache Hit")
 * instead of re-running logic every time ("Cache Miss").
 */
async function verifyIdentity(issuer, credential) {
  // 1. Input Validation (Security Guardrail)
  if (!issuer || !credential) {
    return {
      success: false,
      error: "Invalid Input: 'issuer' and 'credential' are required.",
    };
  }

  const identityHash = generateIdentityHash(issuer, credential);
  console.log(`\n🆔 Processing Identity Hash: ${identityHash.substring(0, 8)}...`);

  try {
    // --- STEP 1: CACHE LOOKUP (Read Layer) ---
    // Check if we have already verified this specific data before.
    const { data: cachedData, error: readError } = await supabase
      .from("identity_verifications")
      .select("*")
      .eq("hash", identityHash) // Lookup by unique hash
      .single();

    // If we found data, return it immediately! (Performance Win)
    if (cachedData && !readError) {
      console.log("⚡ CACHE HIT: Serving verification from Storage.");
      return {
        success: true,
        verified: cachedData.verified,
        proof: cachedData.proof_signature,
        source: "CACHE (0G_LAYER)", // Metadata for your demo UI
        timestamp: cachedData.created_at,
        message: "Identity retrieved from cache (Zero Compute Cost).",
      };
    }

    // --- STEP 2: VERIFICATION LOGIC (Compute Layer) ---
    // If not in cache, we must run the verification logic.
    console.log("⚙️ CACHE MISS: Computing verification logic...");

    // (Refined Logic for Demo)
    const isVerified =
      issuer.toLowerCase() === "jain university" &&
      credential.toLowerCase().includes("student");

    // Generate a mock "Proof of Trust"
    const proofSignature = isVerified ? generateMockProof() : null;

    // --- STEP 3: CACHE COMMITMENT (Write Layer) ---
    // Save the result so the NEXT request will be instant.
    const { error: writeError } = await supabase
      .from("identity_verifications")
      .insert([
        {
          hash: identityHash, // The unique key
          issuer: issuer,
          credential: credential,
          verified: isVerified,
          proof_signature: proofSignature,
          created_at: new Date().toISOString(),
        },
      ]);

    if (writeError) {
      console.error("❌ Database Error:", writeError.message);
      // Even if storage fails, return the result to the user, but log the error.
    } else {
      console.log("💾 CACHE UPDATED: Verification stored successfully.");
    }

    return {
      success: true,
      verified: isVerified,
      proof: proofSignature,
      source: "COMPUTE (NEW_EXECUTION)",
      message: isVerified
        ? "Identity verified and cached for future use."
        : "Identity verification failed.",
    };

  } catch (err) {
    console.error("🔥 Critical Failure:", err);
    return {
      success: false,
      message: "Internal Server Error during verification pipeline.",
    };
  }
}

module.exports = verifyIdentity;