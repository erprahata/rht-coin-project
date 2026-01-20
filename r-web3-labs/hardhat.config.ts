import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
// Baris ini memanggil library dotenv agar bisa baca file .env
require("dotenv").config();

// Mengambil kunci dari file .env
const ALCHEMY_SEPOLIA_URL = process.env.ALCHEMY_SEPOLIA_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: "0.8.20", // Sesuaikan dengan versi di RahataCoin.sol (misal 0.8.20 atau 0.8.28)
  networks: {
    // Konfigurasi jaringan Sepolia
    sepolia: {
      url: ALCHEMY_SEPOLIA_URL,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;