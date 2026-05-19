#!/usr/bin/env node

// OCP Reference Verifier v2.1.0
// Implements: evm/event-log extraction rule
// Dependencies: zero — Node.js stdlib only (https, crypto, fs)
// Spec: docs/spec/appendix-evm-r.md

"use strict";

const fs = require("fs");
const crypto = require("crypto");
const https = require("https");

// RPC endpoints — no API key required
const RPC = {
  "eip155:84532":    "https://sepolia.base.org",
  "eip155:8453":     "https://mainnet.base.org",
  "eip155:1":        "https://cloudflare-eth.com",
  "eip155:11155111": "https://rpc.sepolia.org",
};

// Network name to CAIP-2 chain ID (proof-format-v1 compatibility)
const NETWORK_TO_CHAIN_ID = {
  "base-sepolia": "eip155:84532",
  "base":         "eip155:8453",
  "mainnet":      "eip155:1",
  "homestead":    "eip155:1",
  "sepolia":      "eip155:11155111",
};

// keccak256("Recorded(bytes32,address)")
// Confirmed from live Base Sepolia transaction logs
const KNOWN_EVENT_TOPIC = "0xdca60c2087041cbb12d9a57628c6cad28ecbd0437e47c7ab6c3aa6e162bf4497";

// Identity pipeline sentinel hash
// Canonical identity spec: ipfs://QmTst97dG8i9tFrutdetqMbVhSHqJGJaxMmPzWCcVVTWDU
// Confirmed independently against Dinamic.eth implementation — locked
const IDENTITY_PIPELINE_SENTINEL = "8116eec29078e8f57c07077d5e8080a35bde73036581df3abb93755d1b1a16ea";

function fail(message) {
  console.error(`INVALID: ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(message);
}

function rpcCall(url, method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(`RPC error: ${parsed.error.message}`));
          else resolve(parsed.result);
        } catch (e) {
          reject(new Error(`Failed to parse RPC response: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function normalizeHash(h) {
  if (!h) return null;
  return h.toLowerCase().startsWith("0x") ? h.toLowerCase() : "0x" + h.toLowerCase();
}

function stripPrefix(h) {
  if (!h) return null;
  return h.toLowerCase().startsWith("0x") ? h.slice(2).toLowerCase() : h.toLowerCase();
}

function applyExtractionRule(receipt, eventTopic) {
  const extracted = new Set();
  if (!receipt.logs || !Array.isArray(receipt.logs)) return extracted;
  for (const log of receipt.logs) {
    if (!log.topics || log.topics.length < 2) continue;
    if (normalizeHash(log.topics[0]) !== normalizeHash(eventTopic)) continue;
    const digest = stripPrefix(log.topics[1]);
    if (digest) extracted.add(digest);
  }
  return extracted;
}

async function main() {
  const [, , filePath, proofArg] = process.argv;

  if (!filePath) {
    console.error("Usage: ocp-verify <file> [proof.json]");
    console.error("");
    console.error("Environment:");
    console.error("  OCP_RPC_URL=<url>   Override RPC endpoint (optional)");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) fail(`file not found: ${filePath}`);

  const proofPath = proofArg || filePath.replace(/(\.[^/.]+)?$/, ".proof.json");
  if (!fs.existsSync(proofPath)) fail(`proof not found: ${proofPath}`);

  const fileBytes = fs.readFileSync(filePath);
  let proof;
  try {
    proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  } catch {
    fail("invalid JSON in proof file");
  }

  const isEnvelope = !!proof.ocp;
  const isV1 = proof.version === "ocp-1";
  if (!isEnvelope && !isV1) fail("unrecognized proof format — expected ocp-1 or envelope format");

  let txHash, chainId, commitmentDigest, blockHash;

  if (isV1) {
    const requiredFields = ["version", "hash", "txHash", "network", "contract", "extractionRule"];
    for (const field of requiredFields) {
      if (!proof[field]) fail(`missing required field: ${field}`);
    }
    if (!/^0x[a-f0-9]{64}$/.test(proof.hash))        fail("invalid hash format");
    if (!/^0x[a-fA-F0-9]{64}$/.test(proof.txHash))   fail("invalid txHash format");
    if (!/^0x[a-fA-F0-9]{40}$/.test(proof.contract)) fail("invalid contract format");

    txHash           = proof.txHash;
    chainId          = NETWORK_TO_CHAIN_ID[proof.network];
    commitmentDigest = stripPrefix(proof.hash);
    blockHash        = null;

    if (!chainId) fail(`unknown network: ${proof.network} — add to NETWORK_TO_CHAIN_ID`);

  } else {
    if (!proof.chain?.id)                  fail("missing chain.id");
    if (!proof.chain?.namespace)           fail("missing chain.namespace");
    if (!proof.commitment?.digest)         fail("missing commitment.digest");
    if (!proof.commitment?.hash_function)  fail("missing commitment.hash_function");
    if (!proof.commitment?.serialization)  fail("missing commitment.serialization");
    if (!proof.ledger_ref?.transaction_id) fail("missing ledger_ref.transaction_id");
    if (!proof.ledger_ref?.block_hash)     fail("missing ledger_ref.block_hash");
    if (!proof.extraction?.rule_id)        fail("missing extraction.rule_id");

    if (proof.commitment.hash_function !== "sha2-256")
      fail(`unsupported hash function: ${proof.commitment.hash_function}`);
    if (proof.commitment.serialization !== "raw-bytes")
      fail(`unsupported serialization: ${proof.commitment.serialization}`);
    if (!proof.extraction.rule_id.startsWith("evm/"))
      fail(`unsupported extraction rule namespace: ${proof.extraction.rule_id}`);

    txHash           = proof.ledger_ref.transaction_id;
    chainId          = proof.chain.id;
    commitmentDigest = proof.commitment.digest.toLowerCase();
    blockHash        = proof.ledger_ref.block_hash;
  }

  // Step 1 — Recompute digest
  const computedHash = crypto.createHash("sha256").update(fileBytes).digest("hex");
  if (computedHash !== commitmentDigest) {
    fail(`hash mismatch\n  computed: ${computedHash}\n  proof:    ${commitmentDigest}`);
  }
  log(`  hash      MATCH  ${computedHash}`);

  // Step 2 — Resolve RPC
  const rpcUrl = process.env.OCP_RPC_URL || RPC[chainId];
  if (!rpcUrl) fail(`no RPC endpoint for chain ${chainId} — set OCP_RPC_URL`);

  log(`  chain     ${chainId}`);
  log(`  rpc       ${rpcUrl}`);
  log(`  tx        ${txHash}`);

  // Step 3 — Fetch receipt
  let receipt;
  try {
    receipt = await rpcCall(rpcUrl, "eth_getTransactionReceipt", [txHash]);
  } catch (e) {
    fail(`RPC call failed: ${e.message}`);
  }
  if (!receipt) fail(`transaction not found: ${txHash}`);

  // Step 4 — Confirm block hash (envelope only)
  if (blockHash) {
    const receiptBlockHash  = normalizeHash(receipt.blockHash);
    const expectedBlockHash = normalizeHash(blockHash);
    if (receiptBlockHash !== expectedBlockHash) {
      fail(`block hash mismatch\n  receipt: ${receiptBlockHash}\n  proof:   ${expectedBlockHash}`);
    }
    log(`  block     MATCH  ${receiptBlockHash}`);
  }

  // Step 5 — Apply extraction rule
  const extracted = applyExtractionRule(receipt, KNOWN_EVENT_TOPIC);
  if (extracted.size === 0) {
    fail(
      `no Recorded events found in transaction ${txHash}\n` +
      `  event topic: ${KNOWN_EVENT_TOPIC}\n` +
      `  logs found:  ${receipt.logs?.length ?? 0}`
    );
  }
  log(`  logs      found ${extracted.size} Recorded event(s)`);

  // Step 6 — Confirm inclusion
  if (!extracted.has(commitmentDigest)) {
    fail(
      `digest not found in transaction logs\n` +
      `  looking for: ${commitmentDigest}\n` +
      `  found:       ${[...extracted].join(", ")}`
    );
  }
  log(`  digest    MATCH  ${commitmentDigest}`);

  // Step 7 — Report finality
  if (isEnvelope && proof.ledger_ref?.finality) {
    const { depth, assertion_time_utc } = proof.ledger_ref.finality;
    log(`  finality  depth=${depth} at ${assertion_time_utc}`);
    if (depth < 3) log(`  WARNING   finality depth ${depth} is below recommended minimum (3)`);
  }

  log("");
  log("VALID");
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});