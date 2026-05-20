// OCP Reference: Browser-native digest computation
// Uses Web Crypto API — no dependencies, no libraries
// Companion to reference-cli/verify.js (Node.js implementation)
//
// Spec: docs/spec/appendix-evm-r.md
// This is the write-side primitive: observation → digest
// The digest produced here is what gets passed to record(bytes32) on-chain

"use strict";

/**
 * Compute the OCP digest of a File object.
 *
 * Implements the commitment procedure from appendix-evm-r.md:
 *   - Serialization: raw-bytes (no encoding applied)
 *   - Hash function: sha2-256
 *   - Output: lowercase hex string, no 0x prefix
 *
 * @param {File} file - Any File object (browser File API)
 * @returns {Promise<string>} SHA-256 digest as lowercase hex, no 0x prefix
 */
async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute the OCP digest of an arbitrary byte array.
 *
 * @param {ArrayBuffer|Uint8Array} bytes - Raw bytes
 * @returns {Promise<string>} SHA-256 digest as lowercase hex, no 0x prefix
 */
async function hashBytes(bytes) {
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute the OCP digest of a UTF-8 string.
 * Note: the string is encoded as UTF-8 before hashing.
 * The verifier must apply the same encoding to reproduce the digest.
 *
 * @param {string} text - UTF-8 string
 * @returns {Promise<string>} SHA-256 digest as lowercase hex, no 0x prefix
 */
async function hashString(text) {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Usage example:
//
// const file = document.querySelector('input[type="file"]').files[0];
// const digest = await hashFile(file);
// // digest is ready to pass to record(bytes32) on-chain
// // or to include in an OCP proof envelope as commitment.digest

// Node.js export (if used in a build pipeline)
if (typeof module !== "undefined") {
  module.exports = { hashFile, hashBytes, hashString };
}
