module vid_pipe::issuer {
    use std::signer;
    use aptos_std::event;
    use aptos_framework::account;
    use std::string::{Self, String};

    struct VC has key, store {
        did: address,
        claims: vector<u8>,  // Serialized claims (e.g., KYC JSON)
        signature: vector<u8>,
    }

    struct IssueEvents has key {
        issued: event::EventHandle<IssuedEvent>,
    }

    struct IssuedEvent has drop, store {
        did_uri: String,
    }

    public entry fun issue_vc(issuer: &signer, holder: address, claims: vector<u8>, sig: vector<u8>) acquires IssueEvents {
        let did_uri = std::string::utf8(b"did:aptos:");
        std::string::append(&mut did_uri, std::string::utf8(std::b256::to_bytes(&holder)));

        move_to(issuer, VC { did: holder, claims, signature: sig });

        let events = borrow_global_mut<IssueEvents>(@vid_pipe);
        event::emit_event(&mut events.issued, IssuedEvent { did_uri });
    }

    public fun initialize_events(admin: &signer) {
        move_to(admin, IssueEvents { issued: account::new_event_handle<IssuedEvent>(admin) });
    }
}
