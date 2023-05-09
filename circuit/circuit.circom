pragma circom 2.0.3;

include "../node_modules/circomlib/circuits/bitify.circom";
include "../zk-email-verify-circuits/sha.circom";
include "../zk-email-verify-circuits/rsa.circom";
include "../zk-email-verify-circuits/dkim_header_regex.circom";
include "../zk-email-verify-circuits/body_hash_regex.circom";
include "../zk-email-verify-circuits/base64.circom";
include "./venmo_offramper_id_regex.circom";
include "./venmo_amount_regex.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

// Here, n and k are the biginteger parameters for RSA
// This is because the number is chunked into n chunks of k bits each
// Max header bytes shouldn't need to be changed much per email,
// but the max mody bytes may need to be changed to be larger if the email has a lot of i.e. HTML formatting
template P2POnrampVerify(max_header_bytes, max_body_bytes, n, k) {
    assert(max_header_bytes % 64 == 0);
    assert(max_body_bytes % 64 == 0);
    assert(n * k > 2048); // constraints for 2048 bit RSA
    assert(k * 2 < 255); // we want a multiplication to fit into a circom signal

    var max_packed_bytes = (max_header_bytes - 1) \ 7 + 1; // ceil(max_num_bytes / 7)
    signal input in_padded[max_header_bytes]; // prehashed email data, includes up to 512 + 64? bytes of padding pre SHA256, and padded with lots of 0s at end after the length
    signal input modulus[k]; // rsa pubkey, verified with smart contract + optional oracle
    signal input signature[k];
    signal input in_len_padded_bytes; // length of in email data including the padding, which will inform the sha256 block length

    // Next 3 signals are for decreasing SHA constraints for parsing out information from the in-body text
    // The precomputed_sha value is the Merkle-Damgard state of our SHA hash uptil our first regex match
    // This allows us to save a ton of SHA constraints by only hashing the relevant part of the body
    // It doesn't have an impact on security since a user must have known the pre-image of a signed message to be able to fake it
    signal input precomputed_sha[32];
    // The lower two body signals are only the part we care about, a significant prefix of the body has been pre-hashed into precomputed_sha.
    signal input in_body_padded[max_body_bytes];
    signal input in_body_len_padded_bytes;

    // Not necessary.
    signal reveal[max_header_bytes]; // bytes to reveal
    signal reveal_packed[max_packed_bytes]; // packed into 7-bytes. TODO: make this rotate to take up even less space

    var max_venmo_id_len = 28;
    var max_venmo_id_packed_bytes = (max_venmo_id_len - 1) \ 7 + 1; // ceil(max_num_bytes / 7)

    // Venmo Offramper signals
    signal input venmo_offramper_id_idx;
    signal reveal_venmo_offramper[max_venmo_id_len][max_body_bytes];
    signal output packed_venmo_offramper_id_hash;
    
    var max_venmo_amount_len = 21;      // Arbitrary, but should be enough for most cases.
    var max_venmo_amount_packed_bytes = (max_venmo_amount_len - 1) \ 7 + 1; // ceil(max_num_bytes / 7)

    // Venmo message signals
    signal input venmo_amount_idx;
    signal reveal_venmo_amount[max_venmo_amount_len][max_header_bytes];
    signal output reveal_venmo_amount_packed[max_venmo_amount_packed_bytes]; // Amount not larger than; TODO: Confirm if 1 would work. 

    var LEN_SHA_B64 = 44;     // ceil(32/3) * 4, should be automatically calculated.
    signal input body_hash_idx;
    signal body_hash[LEN_SHA_B64][max_header_bytes];

    // SHA HEADER: 506,670 constraints
    // This calculates the SHA256 hash of the header, which is the "base_msg" that is RSA signed.
    // The header signs the fields in the "h=Date:From:To:Subject:MIME-Version:Content-Type:Message-ID;"
    // section of the "DKIM-Signature:"" line, along with the body hash.
    // Note that nothing above the "DKIM-Signature:" line is signed.
    component sha = Sha256Bytes(max_header_bytes);
    for (var i = 0; i < max_header_bytes; i++) {
        sha.in_padded[i] <== in_padded[i];
    }
    sha.in_len_padded_bytes <== in_len_padded_bytes;
    var msg_len = (256+n)\n;
    component base_msg[msg_len];
    for (var i = 0; i < msg_len; i++) {
        base_msg[i] = Bits2Num(n);
    }
    for (var i = 0; i < 256; i++) {
        base_msg[i\n].in[i%n] <== sha.out[255 - i];
    }
    for (var i = 256; i < n*msg_len; i++) {
        base_msg[i\n].in[i%n] <== 0;
    }

    // VERIFY RSA SIGNATURE: 149,251 constraints
    // The fields that this signature actually signs are defined as the body and the values in the header
    component rsa = RSAVerify65537(n, k);
    for (var i = 0; i < msg_len; i++) {
        rsa.base_message[i] <== base_msg[i].out;
    }
    for (var i = msg_len; i < k; i++) {
        rsa.base_message[i] <== 0;
    }
    for (var i = 0; i < k; i++) {
        rsa.modulus[i] <== modulus[i];
    }
    for (var i = 0; i < k; i++) {
        rsa.signature[i] <== signature[i];
    }

    // DKIM HEADER REGEX: 736,553 constraints
    // This extracts the from and the to emails, and the precise regex format can be viewed in the README
    component dkim_header_regex = DKIMHeaderRegex(max_header_bytes);
    for (var i = 0; i < max_header_bytes; i++) {
        dkim_header_regex.msg[i] <== in_padded[i];
    }
    dkim_header_regex.out === 2;
    for (var i = 0; i < max_header_bytes; i++) {
        reveal[i] <== dkim_header_regex.reveal[i+1];
    }
    log(dkim_header_regex.out);

    // BODY HASH REGEX: 617,597 constraints
    // This extracts the body hash from the header (i.e. the part after bh= within the DKIM-signature section)
    // which is used to verify the body text matches this signed hash + the signature verifies this hash is legit
    component body_hash_regex = BodyHashRegex(max_header_bytes);
    for (var i = 0; i < max_header_bytes; i++) {
        body_hash_regex.msg[i] <== in_padded[i];
    }
    body_hash_regex.out === 1;
    log(body_hash_regex.out);
    component body_hash_eq[max_header_bytes];
    for (var i = 0; i < max_header_bytes; i++) {
        body_hash_eq[i] = IsEqual();
        body_hash_eq[i].in[0] <== i;
        body_hash_eq[i].in[1] <== body_hash_idx;
    }
    for (var j = 0; j < 44; j++) {
        body_hash[j][j] <== body_hash_eq[j].out * body_hash_regex.reveal[j];
        for (var i = j + 1; i < max_header_bytes; i++) {
            body_hash[j][i] <== body_hash[j][i - 1] + body_hash_eq[i-j].out * body_hash_regex.reveal[i];
        }
    }

    // SHA BODY: 760,142 constraints
    // This verifies that the hash of the body, when calculated from the precomputed part forwards,
    // actually matches the hash in the header
    component sha_body = Sha256BytesPartial(max_body_bytes);
    for (var i = 0; i < max_body_bytes; i++) {
        sha_body.in_padded[i] <== in_body_padded[i];
    }
    for (var i = 0; i < 32; i++) {
        sha_body.pre_hash[i] <== precomputed_sha[i];
    }
    sha_body.in_len_padded_bytes <== in_body_len_padded_bytes;
    component sha_b64 = Base64Decode(32);
    for (var i = 0; i < 44; i++) {
        sha_b64.in[i] <== body_hash[i][max_header_bytes - 1];
    }
    component sha_body_bytes[32];
    for (var i = 0; i < 32; i++) {
        sha_body_bytes[i] = Bits2Num(8);
        for (var j = 0; j < 8; j++) {
            sha_body_bytes[i].in[7-j] <== sha_body.out[i*8+j];
        }
        sha_body_bytes[i].out === sha_b64.out[i];
    }

    //
    // Extract Venmo Offramper ID
    //
    // This computes the regex states on each character in the email body
    component venmo_offramper_regex = VenmoOfframperIdRegex(max_body_bytes);
    for (var i = 0; i < max_body_bytes; i++) {
        venmo_offramper_regex.msg[i] <== in_body_padded[i];
    }

    // Logging
    log("Found ", venmo_offramper_regex.out, " matches for Venmo Offramper ID");
    log("venmo Offramper id reveal start");
    for (var i = 0; i < max_body_bytes; i++) {
        log(venmo_offramper_regex.reveal[i]);
    }
    log("venmo Offramper id reveal end");

    // This ensures we found a match at least once
    component found_offramper_id = IsZero();
    found_offramper_id.in <== venmo_offramper_regex.out;
    found_offramper_id.out === 0;
    
    // We isolate where the venom id begins: eq there is 1, everywhere else is 0
    component venmo_offramper_id_eq[max_body_bytes];
    for (var i = 0; i < max_body_bytes; i++) {
        venmo_offramper_id_eq[i] = IsEqual();
        venmo_offramper_id_eq[i].in[0] <== i;
        venmo_offramper_id_eq[i].in[1] <== venmo_offramper_id_idx;
    }

    // This is the matrix that stores the reveal of the amount
    for (var j = 0; j < max_venmo_id_len; j++) {
        reveal_venmo_offramper[j][j] <== venmo_offramper_id_eq[j].out * venmo_offramper_regex.reveal[j];
        for (var i = j + 1; i < max_body_bytes; i++) {
            reveal_venmo_offramper[j][i] <== reveal_venmo_offramper[j][i - 1] + venmo_offramper_id_eq[i-j].out * venmo_offramper_regex.reveal[i];
        }
    }

    // Offramper ID PACKING
    // Pack output for solidity verifier to be < 24kb size limit
    var chunks = 7;
    component packed_venmo_offramper_id_output[max_venmo_id_packed_bytes];
    for (var i = 0; i < max_venmo_id_packed_bytes; i++) {
        packed_venmo_offramper_id_output[i] = Bytes2Packed(chunks);
        for (var j = 0; j < chunks; j++) {
            var reveal_idx = i * chunks + j;
            if (reveal_idx < max_body_bytes) {
                packed_venmo_offramper_id_output[i].in[j] <== reveal_venmo_offramper[i * chunks + j][max_body_bytes - 1];
            } else {
                packed_venmo_offramper_id_output[i].in[j] <== 0;
            }
        }
    }
    
    // Hashing; Calculate poseidon hash of the packed venmo Offramper id
    component packed_venmo_offramper_id_hasher = Poseidon(max_venmo_id_packed_bytes);
    for (var i = 0; i < max_venmo_id_packed_bytes; i++) {
        packed_venmo_offramper_id_hasher.inputs[i] <== packed_venmo_offramper_id_output[i].out;
    }
    packed_venmo_offramper_id_hash <== packed_venmo_offramper_id_hasher.out;
    log("Hash of packed Venmo Offramper ID", packed_venmo_offramper_id_hash);

    //
    // AMOUNT EXTRACTION
    //

    // This extracts the amount from the subject line
    component venmo_amount_regex = VenmoAmountRegex(max_header_bytes);
    for (var i = 0; i < max_header_bytes; i++) {
        venmo_amount_regex.msg[i] <== in_padded[i];
    }

    // Logging
    log("Found ", venmo_amount_regex.out, " matches for Venmo amount in subject line");
    log("venmo amount reveal start");
    for (var i = 0; i < max_header_bytes; i++) {
        log(venmo_amount_regex.reveal[i]);
    }
    log("venmo amount reveal end");

    // This ensures we found atleast one match
    component found_amount = IsZero();
    found_amount.in <== venmo_amount_regex.out;
    found_amount.out === 0;

    // We isolate where the amount begins: eq there is 1, everywhere else is 0
    component venmo_amount_eq[max_header_bytes];
    for (var i = 0; i < max_header_bytes; i++) {
        venmo_amount_eq[i] = IsEqual();
        venmo_amount_eq[i].in[0] <== i;
        venmo_amount_eq[i].in[1] <== venmo_amount_idx;
    }

    // This is the matrix that stores the reveal of the amount
    for (var j = 0; j < max_venmo_amount_len; j++) {
        reveal_venmo_amount[j][j] <== venmo_amount_eq[j].out * venmo_amount_regex.reveal[j];
        for (var i = j + 1; i < max_header_bytes; i++) {
            reveal_venmo_amount[j][i] <== reveal_venmo_amount[j][i - 1] + venmo_amount_eq[i-j].out * venmo_amount_regex.reveal[i];
        }
    }
    
    // Packing the amount
    component packed_venmo_amount_output[max_venmo_amount_packed_bytes];
    for (var i = 0; i < max_venmo_amount_packed_bytes; i++) {
        packed_venmo_amount_output[i] = Bytes2Packed(chunks);
        for (var j = 0; j < chunks; j++) {
            var reveal_idx = i * chunks + j;
            if (reveal_idx < max_header_bytes) {
                packed_venmo_amount_output[i].in[j] <== reveal_venmo_amount[i * chunks + j][max_header_bytes - 1];
            } else {
                packed_venmo_amount_output[i].in[j] <== 0;
            }
        }
        reveal_venmo_amount_packed[i] <== packed_venmo_amount_output[i].out;
    }
    
    // Pack outputs
    component packed_output[max_packed_bytes];
    for (var i = 0; i < max_packed_bytes; i++) {
        packed_output[i] = Bytes2Packed(chunks);
        for (var j = 0; j < chunks; j++) {
            var reveal_idx = i * chunks + j;
            if (reveal_idx < max_header_bytes) {
                packed_output[i].in[j] <== reveal[i * chunks + j];
            } else {
                packed_output[i].in[j] <== 0;
            }
        }
        reveal_packed[i] <== packed_output[i].out;
    }

    // The following signals do not take part in computation
    signal input order_id;
    signal input claim_id;
    signal order_id_squared;
    signal claim_id_squared;

    // Add constraint to tie the proof to a specific (order_id, claim_id) to prevent replay attacks and frontrunning.
    order_id_squared <== order_id * order_id;
    claim_id_squared <== claim_id * claim_id;
}

// In circom, all output signals of the main component are public (and cannot be made private), the input signals of the main component are private if not stated otherwise using the keyword public as above. The rest of signals are all private and cannot be made public.
// This makes modulus and reveal_venmo_user_packed public. hash(signature) can optionally be made public, but is not recommended since it allows the mailserver to trace who the offender is.

component main { public [ modulus, order_id, claim_id ] } = P2POnrampVerify(1024, 6400, 121, 17);
