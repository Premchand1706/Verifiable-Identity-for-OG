module vid_pipe::cache {
    use aptos_std::table::{Self, Table};
    use std::vector;

    struct CacheStore has key {
        proofs: Table<address, vector<u8>>,
    }

    struct CachedProof has store {
        hash: vector<u8>,
        timestamp: u64,
    }

    public entry fun store_proof(signer: &signer, did: address, hash: vector<u8>) acquires CacheStore {
        if (!exists<CacheStore>(@vid_pipe)) {
            move_to(signer, CacheStore { proofs: table::new() });
        };
        let store = borrow_global_mut<CacheStore>(@vid_pipe);
        table::add(&mut store.proofs, did, CachedProof { hash, timestamp: std::timestamp::now_seconds() });
        // Off-chain: Call 0G SDK to cache tx hash
    }
}
