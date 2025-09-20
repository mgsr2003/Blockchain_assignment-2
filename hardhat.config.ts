// hardhat.config.ts
import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox-viem";

const RPC_URL = process.env.RPC_URL!;
const CHAIN_ID = Number(process.env.CHAIN_ID || "0");

export default {
  solidity: {
    version: "0.8.28", // or your chosen version; make sure it compiles all files
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    // remote DIDLab (leave as-is for later)
    didlab: {
      url: RPC_URL,
      chainId: CHAIN_ID,
      type: "http",
    },

    // local EDR sim (Hardhat's built-in)
    hardhat: {
      type: "edr-simulated",
      initialBaseFeePerGas: 1_000_000_000,
    },

    // ✅ NEW: local HTTP endpoint (Hardhat node at 127.0.0.1:8545)
    local: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      type: "http",
    },
  },
};

