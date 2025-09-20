// scripts/deploy.ts
import { artifacts } from "hardhat";
import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = process.env.RPC_URL!;
const CHAIN_ID = Number(process.env.CHAIN_ID!);
const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").replace(/^0x/, "");

async function main() {
  if (!RPC_URL || !CHAIN_ID || !PRIVATE_KEY) {
    throw new Error("Missing RPC_URL, CHAIN_ID, or PRIVATE_KEY in .env");
  }

  // Read compiled CampusCredit contract artifact
  const { abi, bytecode } = await artifacts.readArtifact("CampusCredit");

  // Build chain object for Viem
  const chain = {
    id: CHAIN_ID,
    name: `didlab-${CHAIN_ID}`,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  };

  const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);
  const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

  // Determine initial supply — use .env TOKEN_INITIAL if present, else 1,000,000
  const humanReadableSupply = process.env.TOKEN_INITIAL || "1000000";
  const initialSupply = parseUnits(humanReadableSupply, 18); // ✅ number for decimals

  console.log("Deploying CampusCredit...");
  console.log("Deployer address:", account.address);
  console.log("Initial supply:", humanReadableSupply, "CAMP");

  // Send deployment transaction
  const txHash = await wallet.deployContract({
    abi,
    bytecode,
    args: [initialSupply],
  });

  console.log("Deployment transaction hash:", txHash);

  // Wait until mined
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  console.log("✅ CampusCredit deployed successfully!");
  console.log("Contract address:", receipt.contractAddress);
  console.log("Block number:", receipt.blockNumber);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});

