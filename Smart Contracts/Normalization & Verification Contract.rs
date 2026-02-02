module vid_pipe::verifier {
    use std::vector;
    use aptos_std::hash::keccak256;
    use std::string::String;
    use vid_pipe::issuer::VC;

    struct VerificationResult has key, store {
        did_uri: String,
        verified_hash: vector<u8>,
        valid: bool,
    }

    public fun verify_vc(did: address, expected_issuer: address): vector<u8> acquires VC {
        let vc = borrow_global<VC>(did);
        // Deterministic sig check (simplified; use ed25519_verify in prod)
        let proof_hash = keccak256(&vector::append(&mut vector::empty(), &vc.claims));
        let full_hash = keccak256(&vector::append(&mut proof_hash, &vc.signature));
        move_to(@verifier, VerificationResult {
            did_uri: std::string::utf8(b"did:aptos:" + std::b256::to_bytes(&did)),
            verified_hash: full_hash,
            valid: true  // Placeholder logic
        });
        full_hash
    }
}
