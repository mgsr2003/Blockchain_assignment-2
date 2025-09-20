// scripts/analyze.ts
import "dotenv/config";
import { artifacts } from "hardhat";
import { createPublicClient, http, formatUnits, decodeEventLog } from "viem";
import fs from "fs";

// ---- Defaults to your current .env.local values, but can be overridden ----
const RPC_URL =
  process.env.RPC_URL || "http://127.0.0.1:8545";
const CHAIN_ID =
  Number(process.env.CHAIN_ID || "31337");

async function main() {
  if (!RPC_URL || !CHAIN_ID) throw new Error("Missing RPC_URL / CHAIN_ID");

  const chain = {
    id: CHAIN_ID,
    name: `local-${CHAIN_ID}`,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  };
  const pc = createPublicClient({ chain, transport: http(RPC_URL) });

  const { abi } = await artifacts.readArtifact("CampusCredit");

  const data = JSON.parse(fs.readFileSync("txhashes.json", "utf-8"));
  const hashes: string[] = [data.tx1, data.tx2, data.tx3];

  console.log("=== ANALYZE ===");
  console.log("RPC_URL :", RPC_URL);
  console.log("CHAIN_ID:", CHAIN_ID);
  console.log("TXs     :", hashes);

  for (const [i, h] of hashes.entries()) {
    const receipt = await pc.getTransactionReceipt({ hash: h as `0x${string}` });
    const tx = await pc.getTransaction({ hash: h as `0x${string}` });

    const gasUsed = receipt.gasUsed;
    // Prefer effectiveGasPrice when available (EIP-1559); otherwise fall back
    const eff = (receipt as any).effectiveGasPrice as bigint | undefined;
    const gasPrice =
      eff ??
      (tx.type === "eip1559"
        ? (tx.maxFeePerGas ?? tx.gasPrice ?? 0n)
        : (tx.gasPrice ?? 0n));
    const feeETH = Number(formatUnits(gasUsed * (gasPrice ?? 0n), 18));

    console.log(`\nTx #${i + 1}: ${h}`);
    console.log(`  block      : ${receipt.blockNumber}`);
    console.log(`  status     : ${receipt.status === "success" ? "success" : "reverted"}`);
    console.log(`  gasUsed    : ${gasUsed}`);
    console.log(`  gasPrice   : ${gasPrice ? formatUnits(gasPrice, 9) + " gwei" : "n/a"}`);
    console.log(`  fee (ETH)  : ${feeETH}`);

    // Decode ERC-20 logs
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
        if (decoded.eventName === "Transfer") {
          const [from, to, value] = decoded.args as any;
          console.log(
            `  event Transfer: from ${from} -> ${to}, amount ${formatUnits(value as bigint, 18)}`
          );
        } else if (decoded.eventName === "Approval") {
          const [owner, spender, value] = decoded.args as any;
          console.log(
            `  event Approval: owner ${owner} -> spender ${spender}, amount ${formatUnits(
              value as bigint,
              18
            )}`
          );
        }
      } catch {
        // ignore non-ERC20 events
      }
    }
  }

  // Show mined order explicitly
  const receipts = await Promise.all(
    hashes.map((h) => pc.getTransactionReceipt({ hash: h as `0x${string}` }))
  );
  const order = receipts
    .map((r) => ({ hash: r.transactionHash, block: r.blockNumber, index: r.transactionIndex }))
    .sort((a, b) => (a.block === b.block ? Number(a.index - b.index) : Number(a.block - b.block)));

  console.log("\nMined order (by block, then index):");
  for (const o of order) console.log(`  ${o.block}:${o.index}  ${o.hash}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
