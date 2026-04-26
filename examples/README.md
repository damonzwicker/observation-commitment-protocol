# Verification Examples

This folder contains minimal examples demonstrating OCP verification.

Each example is structured to allow independent verification of a committed observation.

---

## Example Structure

Each example includes:

- an observation (file)  
- its digest H  
- a referenced transaction tx  
- an extraction rule R (application-defined)  

Example files include:

- `observation` (e.g., example.txt)  
- `proof` (e.g., proof.json containing H and a reference to tx)

---

## Verification

To verify an example:

1. Compute H′ = hash(observation) using the same hash function and input encoding defined in the specification (e.g., SHA-256)  
2. Compare H′ to the provided digest H  
3. Resolve tx from the public ledger and inspect its contents using publicly available transaction data  
4. Apply R to extract values and confirm that H ∈ R(tx)  

No interaction with the originating system is required.

---

## Result

Verification succeeds if:

- H′ == H  
- H ∈ R(tx)

Otherwise, verification fails.

---

## Invariant

recompute → compare → confirm inclusion

---

## Falsification Condition

Altering any single byte in the observation must cause verification to fail.

If a modified observation still verifies successfully, the system is broken.

---

## Purpose

These examples demonstrate that:

- verification is independent of the originating system  
- no API or trusted intermediary is required  
- correctness is determined entirely by local computation and on-chain inclusion  

Extraction rules R are application-defined and out of scope of OCP.
