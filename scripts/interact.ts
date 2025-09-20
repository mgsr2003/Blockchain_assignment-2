// scripts/interact.ts
import "dotenv/config";
import { artifacts } from "hardhat";
import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { writeFileSync } from "fs";

// ---- Defaults to your current .env.local values, but can be overridden ----
const RPC_URL =
  process.env.RPC_URL || "http://127.0.0.1:8545";
const CHAIN_ID =
  Number(process.env.CHAIN_ID || "31337");
const PRIVATE_KEY =
  (process.env.PRIVATE_KEY || "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d").replace(/^0x/, "");
const TOKEN =
  (process.env.TOKEN || "0x8464135c8f25da09e49bc8782676a84730c318bc") as `0x${string}`;

// Any funded local account from `npx hardhat node` (defaulting to Account #2 here)
const RECIPIENT =
  (process.env.ACCT2 || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC") as `0x${string}`;

async function main() {
  if (!RPC_URL || !CHAIN_ID || !PRIVATE_KEY || !TOKEN) {
    throw new Error("Missing RPC_URL / CHAIN_ID / PRIVATE_KEY / TOKEN");
  }

  const { abi } = await artifacts.readArtifact("CampusCredit");

  const chain = {
    id: CHAIN_ID,
    name: `local-${CHAIN_ID}`,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  };

  const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);
  const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

  // amounts
  const amount1 = parseUnits("1000", 18);
  const amount2 = parseUnits("500", 18);
  const allowance = parseUnits("2000", 18);

  const balanceOf = async (addr: `0x${string}`) =>
    (await publicClient.readContract({
      address: TOKEN,
      abi,
      functionName: "balanceOf",
      args: [addr],
    })) as bigint;

  console.log("=== INTERACT ===");
  console.log("RPC_URL :", RPC_URL);
  console.log("CHAIN_ID:", CHAIN_ID);
  console.log("TOKEN   :", TOKEN);
  console.log("Sender  :", account.address);
  console.log("Recipient:", RECIPIENT);

  const beforeSender = await balanceOf(account.address as `0x${string}`);
  const beforeRcpt = await balanceOf(RECIPIENT);
  console.log("Before balances:");
  console.log("  sender :", beforeSender.toString());
  console.log("  recip  :", beforeRcpt.toString());

  // --- Transfer #1 (lower tip) ---
  const tx1 = await wallet.writeContract({
    address: TOKEN,
    abi,
    functionName: "transfer",
    args: [RECIPIENT, amount1],
    maxPriorityFeePerGas: 1_000_000_000n, // 1 gwei
    maxFeePerGas: 2_000_000_000n,        // 2 gwei
  });
  console.log("Transfer #1 tx:", tx1);
  const rc1 = await publicClient.waitForTransactionReceipt({ hash: tx1 });

  // --- Transfer #2 (higher tip) ---
  const tx2 = await wallet.writeContract({
    address: TOKEN,
    abi,
    functionName: "transfer",
    args: [RECIPIENT, amount2],
    maxPriorityFeePerGas: 3_000_000_000n, // 3 gwei
    maxFeePerGas: 4_000_000_000n,        // 4 gwei
  });
  console.log("Transfer #2 tx:", tx2);
  const rc2 = await publicClient.waitForTransactionReceipt({ hash: tx2 });

  // --- Approval (middle tip) ---
  const tx3 = await wallet.writeContract({
    address: TOKEN,
    abi,
    functionName: "approve",
    args: [RECIPIENT, allowance],
    maxPriorityFeePerGas: 2_000_000_000n, // 2 gwei
    maxFeePerGas: 3_000_000_000n,        // 3 gwei
  });
  console.log("Approval tx:", tx3);
  const rc3 = await publicClient.waitForTransactionReceipt({ hash: tx3 });

  const afterSender = await balanceOf(account.address as `0x${string}`);
  const afterRcpt = await balanceOf(RECIPIENT);
  console.log("After  balances:");
  console.log("  sender :", afterSender.toString());
  console.log("  recip  :", afterRcpt.toString());

  // Save tx hashes for analysis
  const out = {
    token: TOKEN,
    recipient: RECIPIENT,
    tx1: rc1.transactionHash,
    tx2: rc2.transactionHash,
    tx3: rc3.transactionHash,
  };
  writeFileSync("txhashes.json", JSON.stringify(out, null, 2));
  console.log("Saved tx hashes to txhashes.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
