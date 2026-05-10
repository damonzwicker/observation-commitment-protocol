# OCP Falsification Challenge

This example demonstrates the core OCP verification invariant:

recompute → compare → confirm inclusion

The observation is `example-observation.txt`.

The proof is `example-proof.ocp.json`.

---

## Manual Verification

You can verify this example independently using any SHA-256 implementation and a public block explorer.

### Step 1 — Compute the digest

Run:

shasum -a 256 example-observation.txt

This produces H′.

---

### Step 2 — Compare

Confirm that:

H′ == hash

where `hash` is the committed digest in `example-proof.ocp.json`.

---

### Step 3 — Confirm inclusion

Open the referenced transaction:

https://sepolia.basescan.org/tx/0xf13f8a754ac1c0a312699d1b4e0932bc32ef0618424b8f71d26c6e5831fa9d6b

Inspect the transaction logs using the extraction rule:

evm-event:Recorded(bytes32 indexed digest,address indexed recorder)

Confirm that the digest appears in the transaction.

---

If all checks pass, verification succeeds.

If any check fails, verification fails.

---

## Optional UI Verification

You can also verify this example using the VeraFile demo:

https://observation-commitment-protocol.vercel.app/

Upload the file and proof.

The system will perform the same verification steps automatically.

Use of this interface is not required for verification.

---

## Falsification Test

1. Verify the original `example-observation.txt`
2. Modify any single character in the file
3. Repeat verification

The modified file must fail verification.

If it still verifies successfully, the system is broken.
