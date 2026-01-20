import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RahataCoinModule = buildModule("RahataCoinModule", (m) => {
  // Memerintahkan untuk deploy kontrak bernama "RahataCoin"
  const rahataCoin = m.contract("RahataCoin");

  // Mengembalikan hasil deploy agar bisa dipakai
  return { rahataCoin };
});

export default RahataCoinModule;