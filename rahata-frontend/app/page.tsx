"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import { 
  Wallet, Pickaxe, Send, ArrowRightLeft, 
  History, Copy, RefreshCw, X, Database, Dices,
  ExternalLink, ChevronDown, ChevronUp, Clock ,
  Globe
} from "lucide-react";
import RahataCoinABI from "../utils/RahataCoinABI.json";

// --- GANTI DENGAN ALAMAT V4 (GACHA EDITION) ---
const CONTRACT_ADDRESS = "0xdD490d18d3E9De4f037565648789230690F8B17D"; 
const SEPOLIA_CHAIN_ID = "0xaa36a7";

interface Transaction {
  hash: string; from: string; to: string; amount: string; type: "Masuk" | "Keluar" | "Mining"; timestamp: number;
}

// Fungsi Helper: Mengubah timestamp menjadi "Beberapa menit yang lalu"
function timeAgo(timestamp: number) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " tahun lalu";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " bulan lalu";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " hari lalu";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " jam lalu";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " menit lalu";
  return Math.floor(seconds) + " detik lalu";
}

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  
  // Tokenomics
  const [totalSupply, setTotalSupply] = useState<string>("0");
  const [maxSupply, setMaxSupply] = useState<string>("10000000"); 
  const [supplyPercent, setSupplyPercent] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<"dashboard" | "global" | "send" | "receive">("dashboard"); // Tambahkan 'global'
  const [globalTransactions, setGlobalTransactions] = useState<Transaction[]>([]); // Penampung data global
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // STATE BARU UNTUK FITUR VIEW ALL & DETAIL
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Utility Copy Address (Universal)
  const copyToClipboard = (text: string, label: string = "Teks") => {
    navigator.clipboard.writeText(text);
    setStatus(`✅ ${label} berhasil disalin!`);
    // Hilangkan status setelah 2 detik
    setTimeout(() => setStatus(""), 2000);
  };

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const getContract = async (withSigner = false) => {
    if (!window.ethereum) throw new Error("No Wallet");
    const provider = new ethers.BrowserProvider(window.ethereum);
    if (withSigner) {
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, RahataCoinABI.abi, signer);
    }
    return new ethers.Contract(CONTRACT_ADDRESS, RahataCoinABI.abi, provider);
  };

  const refreshData = useCallback(async () => {
    if (!account) return;
    try {
      const contract = await getContract();
      const provider = new ethers.BrowserProvider(window.ethereum); // Butuh provider untuk cek waktu blok

      // ... (Bagian ambil saldo & supply TETAP SAMA, jangan diubah) ...
      const balanceRaw = await contract.balanceOf(account);
      setBalance(ethers.formatUnits(balanceRaw, 18));
      
      const totalRaw = await contract.totalSupply();
      const maxRaw = await contract.MAX_SUPPLY();
      setTotalSupply(parseFloat(ethers.formatUnits(totalRaw, 18)).toLocaleString());
      setMaxSupply(parseFloat(ethers.formatUnits(maxRaw, 18)).toLocaleString());
      setSupplyPercent((parseFloat(ethers.formatUnits(totalRaw, 18)) / parseFloat(ethers.formatUnits(maxRaw, 18))) * 100);

      // --- 1. PERSONAL HISTORY (Tetap seperti sebelumnya) ---
      const filterTo = contract.filters.Transfer(null, account);
      const filterFrom = contract.filters.Transfer(account, null);
      const logsTo = await contract.queryFilter(filterTo, -2000);
      const logsFrom = await contract.queryFilter(filterFrom, -2000);
      const allLogs = [...logsTo, ...logsFrom].sort((a, b) => b.blockNumber - a.blockNumber);
      const recentLogs = allLogs.slice(0, 20);
      
      const history = await Promise.all(recentLogs.map(async (log: any) => {
        const block = await provider.getBlock(log.blockNumber);
        const isIncome = log.args[1].toLowerCase() === account.toLowerCase();
        const isMining = log.args[0] === ethers.ZeroAddress;
        return {
          hash: log.transactionHash,
          from: log.args[0],
          to: log.args[1],
          amount: ethers.formatUnits(log.args[2], 18),
          type: isMining ? "Mining" : isIncome ? "Masuk" : "Keluar",
          timestamp: block ? block.timestamp : Math.floor(Date.now() / 1000)
        };
      }));
      setTransactions(history);

      // --- 2. GLOBAL HISTORY (LOGIC BARU) ---
      // Kita ambil semua event Transfer secara global (tanpa filter address)
      // Limit 10 transaksi terakhir saja biar ringan
      const globalFilter = contract.filters.Transfer(); 
      const globalLogs = await contract.queryFilter(globalFilter, -5000); // Cek 5000 blok terakhir
      const sortedGlobal = globalLogs.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 10);
      
      const globalHistory = await Promise.all(sortedGlobal.map(async (log: any) => {
         const block = await provider.getBlock(log.blockNumber);
         const isMining = log.args[0] === ethers.ZeroAddress;
         
         return {
           hash: log.transactionHash,
           from: log.args[0],
           to: log.args[1],
           amount: ethers.formatUnits(log.args[2], 18),
           type: isMining ? "Mining" : "Transfer", // Global cuma butuh tau Mining atau Transfer
           timestamp: block ? block.timestamp : Math.floor(Date.now() / 1000)
         };
      }));
      setGlobalTransactions(globalHistory);

    } catch (err) { console.error(err); }
  }, [account]);

  useEffect(() => { if (account) refreshData(); }, [account, refreshData]);

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install Metamask!");
    try {
      setIsLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (network.chainId.toString() !== "11155111") {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  useEffect(() => {
    const checkConn = async () => {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) setAccount(accounts[0]);
      }
    };
    checkConn();
  }, []);

  const handleMine = async () => {
    try {
      setIsLoading(true);
      setStatus("🎲 Mining Decimal Numeric..."); // Ubah teks biar sesuai
      
      const contract = await getContract(true);
      const tx = await contract.mineRahataCoin();
      
      setStatus("⛏️ Mining in progress... Waiting Confirmation Block");
      const receipt = await tx.wait();

      let rewardAmount = "???";
      
      for (const log of receipt.logs) {
         try {
            const parsedLog = contract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === "MiningSuccess") {
                rewardAmount = ethers.formatUnits(parsedLog.args[1], 18);
            }
         } catch (e) {}
      }

      // Tampilkan dengan 4 desimal agar angka kecil (0.001) terlihat
      const formattedReward = parseFloat(rewardAmount).toFixed(3); 
      
      setStatus(`🎉 Jackpot! You Got ${formattedReward} RHT`);
      refreshData();
    } catch (err: any) {
      if (err.reason?.includes("Sabar")) setStatus("⏳ Sabar bos! Masih Cooldown.");
      else if (err.reason?.includes("Sold")) setStatus("😭 Sold Out!");
      else setStatus("❌ Gagal: " + (err.reason || "Cek Console"));
    } finally { setIsLoading(false); }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setStatus("💸 Memproses Transfer...");
      const contract = await getContract(true);
      const tx = await contract.transfer(recipient, ethers.parseUnits(amount, 18));
      await tx.wait();
      setStatus("✅ Transfer Berhasil!");
      setRecipient(""); setAmount(""); refreshData();
    } catch (err) { setStatus("❌ Gagal Transfer"); } finally { setIsLoading(false); }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans selection:bg-cyan-500 selection:text-black">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-purple-600/20 blur-[120px] rounded-full" />
        <div className="absolute top-[40%] -right-[10%] w-[400px] h-[400px] bg-cyan-600/20 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col p-4">
        {/* HEADER */}
        <header className="flex justify-between items-center py-6">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-cyan-400 to-purple-500 p-2 rounded-lg">
              <Pickaxe className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Rahata<span className="text-cyan-400">Coin</span></h1>
          </div>
          
          {account ? (
             <div className="flex items-center gap-2">
               {/* 1. TOMBOL COPY BARU */}
               <button 
                 onClick={() => copyToClipboard(account, "Alamat Dompet")}
                 className="p-2 bg-slate-800/50 border border-slate-700 rounded-full hover:bg-cyan-500/20 hover:text-cyan-400 transition"
                 title="Salin Alamat"
               >
                 <Copy className="w-3 h-3" />
               </button>

               {/* 2. TOMBOL LOGOUT / ALAMAT (YANG LAMA) */}
               <button 
                 onClick={() => {setAccount(null); window.location.reload()}} 
                 className="text-xs bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-full hover:border-red-500 hover:text-red-400 transition"
                 title="Klik untuk Logout"
               >
                 {account.slice(0, 5)}...{account.slice(-4)}
               </button>
             </div>
          ) : (
            <button onClick={connectWallet} className="text-xs font-bold bg-cyan-500 text-black px-4 py-2 rounded-full">Connect</button>
          )}
        </header>

        {!account ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Gacha Mining<br/>System</h2>
            <p className="text-xs text-slate-500 mb-4">Random Reward: 0.001 - 2.0 RHT per Click.</p>
            <button onClick={connectWallet} className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-xl font-bold hover:scale-105 transition"><Wallet className="w-5 h-5" /> Hubungkan MetaMask</button>
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl relative overflow-hidden">
              <p className="text-slate-400 text-sm mb-1">Your Wallet</p>
              <h2 className="text-4xl font-bold text-white mb-6">{parseFloat(balance).toLocaleString()} <span className="text-cyan-400 text-lg">RHT</span></h2>
              {/* MENU NAVIGASI UTAMA */}
              <div className="grid grid-cols-4 gap-2 mt-6">
                <button 
                  onClick={() => setActiveTab("dashboard")} 
                  className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold transition ${activeTab === 'dashboard' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Wallet className="w-5 h-5" /> Home
                </button>
                
                <button 
                  onClick={() => setActiveTab("global")} 
                  className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold transition ${activeTab === 'global' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Globe className="w-5 h-5" /> Explorer
                </button>

                <button 
                  onClick={() => setActiveTab("send")} 
                  className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold transition ${activeTab === 'send' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <Send className="w-5 h-5" /> Send
                </button>

                <button 
                  onClick={() => setActiveTab("receive")} 
                  className={`p-3 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold transition ${activeTab === 'receive' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <ArrowRightLeft className="w-5 h-5" /> Receive
                </button>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Database className="w-3 h-3"/> Total Circulating Supply</span>
                  <span className="text-xs font-mono text-cyan-400">{supplyPercent.toFixed(4)}%</span>
               </div>
               <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full rounded-full transition-all duration-1000" style={{ width: `${supplyPercent}%` }}></div>
               </div>
               <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono">
                  <span>{totalSupply} RHT</span>
                  <span>MAX: {maxSupply} RHT</span>
               </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 min-h-[300px]">
              {status && <div className="mb-4 p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm text-center animate-pulse text-cyan-300">{status}</div>}
              {/* --- HALAMAN EXPLORER (GLOBAL) --- */}
              {activeTab === "global" && (
                <div className="text-left space-y-4">
                   <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Globe className="w-5 h-5 text-purple-400" /> Global Activity
                      </h3>
                      <button onClick={refreshData} className="p-1 bg-slate-800 rounded hover:text-cyan-400"><RefreshCw className="w-4 h-4"/></button>
                   </div>
                   
                   <p className="text-xs text-slate-500">Monitor all transactions occurring on the RahataCoin network in real-time.</p>

                   <div className="space-y-2">
                      {globalTransactions.length === 0 ? (
                        <div className="text-center py-8 text-slate-600">
                           <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50"/>
                           <p className="text-xs">Loading data blockchain...</p>
                        </div>
                      ) : (
                        globalTransactions.map((tx, idx) => (
                           <div key={idx} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex flex-col gap-2">
                              {/* Header Card: Waktu & Tipe */}
                              <div className="flex justify-between items-center text-[10px] text-slate-400">
                                 <span className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded text-slate-300">
                                    <Clock className="w-3 h-3" /> {timeAgo(tx.timestamp)}
                                 </span>
                                 <span className={`font-bold uppercase tracking-wider ${tx.type === 'Mining' ? 'text-purple-400' : 'text-blue-400'}`}>
                                    {tx.type}
                                 </span>
                              </div>

                              {/* Isi Card: Siapa & Berapa */}
                              <div className="flex justify-between items-center">
                                 <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${tx.type === 'Mining' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                       {tx.type === 'Mining' ? <Pickaxe className="w-4 h-4"/> : <ArrowRightLeft className="w-4 h-4"/>}
                                    </div>
                                    <div>
                                       {/* Pelaku Transaksi */}
                                       <div className="flex items-center gap-1">
                                          <span className="text-xs font-mono text-slate-300">
                                             {tx.type === 'Mining' ? tx.to.slice(0,6)+'...'+tx.to.slice(-4) : tx.from.slice(0,6)+'...'+tx.from.slice(-4)}
                                          </span>
                                          {/* Label kecil jika itu alamat kita sendiri */}
                                          {tx.to.toLowerCase() === account?.toLowerCase() || tx.from.toLowerCase() === account?.toLowerCase() ? (
                                             <span className="text-[8px] bg-cyan-900 text-cyan-400 px-1 rounded">YOU</span>
                                          ) : null}
                                       </div>
                                       <p className="text-[10px] text-slate-500">
                                          {tx.type === 'Mining' ? 'Menambang Rezeki' : `Mengirim ke ${tx.to.slice(0,4)}...`}
                                       </p>
                                    </div>
                                 </div>
                                 
                                 <div className="text-right">
                                    <p className="font-bold font-mono text-white text-sm">
                                       {parseFloat(tx.amount).toLocaleString('en-US', {maximumFractionDigits: 4})} RHT
                                    </p>
                                    <a href={`https://sepolia.etherscan.io/tx/${tx.hash}`} target="_blank" className="text-[10px] text-cyan-500 hover:underline flex justify-end items-center gap-1">
                                       Cek Hash <ExternalLink className="w-2 h-2"/>
                                    </a>
                                 </div>
                              </div>
                           </div>
                        ))
                      )}
                   </div>
                </div>
              )}

              {activeTab === "dashboard" && (
                <div className="text-center space-y-6">
                   <div className="p-4 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                      <h3 className="text-lg font-medium text-slate-300 mb-2 flex justify-center items-center gap-2"><Dices className="w-5 h-5"/> Lucky Area</h3>
                      <p className="text-xs text-slate-500 mb-4">Random Reward: 0.001 - 2.0 RHT per Click.</p>
                      <button onClick={handleMine} disabled={isLoading} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${isLoading ? 'bg-slate-700 text-slate-500' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-[0_0_20px_rgba(192,38,211,0.5)] text-white'}`}>
                         {isLoading ? <RefreshCw className="animate-spin" /> : <Pickaxe />} {isLoading ? "Mining the Blockchain..." : "Mining"}
                      </button>
                   </div>
                   {/* --- BAGIAN HISTORY BARU --- */}
                   <div className="text-left">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                          <History className="w-4 h-4" /> Transaction History
                        </h3>
                        {transactions.length > 2 && (
                          <button 
                            onClick={() => setShowAllHistory(!showAllHistory)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                          >
                            {showAllHistory ? "Tutup" : "View All"} 
                            {showAllHistory ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {transactions.length === 0 ? (
                           <p className="text-xs text-slate-600 text-center py-2">Nothing Recent Activity.</p>
                        ) : (
                          // LOGIC: Tampilkan semua jika showAllHistory=true, atau potong 2 jika false
                          (showAllHistory ? transactions : transactions.slice(0, 2)).map((tx, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedTx(tx)} // KLIK UNTUK DETAIL
                              className="group cursor-pointer flex justify-between p-3 bg-slate-800 rounded-lg text-xs border border-slate-700/50 hover:border-cyan-500/50 hover:bg-slate-800/80 transition relative overflow-hidden"
                            >
                              {/* Efek Hover Glow Kecil */}
                              <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition duration-500"/>

                              <div className="flex items-center gap-3 relative z-10">
                                <div className={`p-2 rounded-full ${tx.type === 'Masuk' || tx.type === 'Mining' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {tx.type === 'Mining' ? <Pickaxe className="w-3 h-3"/> : <ArrowRightLeft className="w-3 h-3"/>}
                                </div>
                                <div>
                                  <p className="font-bold text-white group-hover:text-cyan-300 transition">{tx.type}</p>
                                  <p className="text-slate-500 font-mono text-[10px]">{tx.hash.slice(0,6)}...{tx.hash.slice(-4)}</p>
                                  <div className="flex items-center gap-1 text-slate-500 text-[10px] font-mono">
                                   <span className="flex items-center gap-0.5 text-slate-400">
                                      <Clock className="w-2.5 h-2.5" /> {timeAgo(tx.timestamp)}
                                   </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className={`relative z-10 font-mono font-bold flex flex-col items-end justify-center ${tx.type === 'Keluar' ? 'text-red-400' : 'text-green-400'}`}>
                                <span>
                                  {tx.type === 'Keluar' ? '-' : '+'}
                                  {parseFloat(tx.amount).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 5})}
                                </span>
                                <span className="text-[9px] text-slate-600 font-sans group-hover:text-cyan-500/70">More detail &rarr;</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                   </div>
                </div>
              )}

              {activeTab === "send" && (
                <form onSubmit={handleTransfer} className="space-y-4">
                  <div className="flex justify-between"><h3 className="font-bold">Kirim</h3><X className="w-5 h-5 cursor-pointer" onClick={()=>setActiveTab("dashboard")}/></div>
                  <input type="text" placeholder="Address Penerima (0x...)" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm" required />
                  <input type="number" placeholder="Jumlah RHT" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm" required />
                  <button type="submit" disabled={isLoading} className="w-full bg-cyan-600 text-white font-bold py-3 rounded-lg flex justify-center gap-2">{isLoading ? <RefreshCw className="animate-spin"/> : <Send/>} Kirim</button>
                </form>
              )}

              {activeTab === "receive" && (
                <div className="text-center">
                   <div className="flex justify-between mb-4"><h3 className="font-bold">Terima</h3><X className="w-5 h-5 cursor-pointer" onClick={()=>setActiveTab("dashboard")}/></div>
                   <div className="bg-white p-4 rounded-xl inline-block mb-4"><QRCodeSVG value={account || ""} size={150} /></div>
                   <div className="bg-slate-950 p-3 rounded-lg text-xs font-mono break-all">{account}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* --- MODAL DETAIL TRANSAKSI --- */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
            
            <button 
              onClick={() => setSelectedTx(null)}
              className="absolute top-4 right-4 p-1 hover:bg-slate-800 rounded-full transition"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>

            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" /> Detail Transaksi
            </h3>

            <div className="space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-xl text-center border border-slate-700/50">
                 <p className="text-slate-400 text-xs mb-1">Total Amount</p>
                 <p className={`text-2xl font-bold ${selectedTx.type === 'Keluar' ? 'text-red-400' : 'text-green-400'}`}>
                    {selectedTx.type === 'Keluar' ? '-' : '+'} 
                    {parseFloat(selectedTx.amount).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 5})} RHT
                 </p>
                 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded mt-2 inline-block">
                    Status: Success ✅
                 </span>
              </div>

              <div className="space-y-3 text-xs">
                 <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-500">Tipe</span>
                    <span className="font-bold text-white">{selectedTx.type}</span>
                 </div>

                 {/* UPDATE: COPY FROM */}
                 <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-slate-500">Dari</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-300 truncate w-24 text-right">{selectedTx.from}</span>
                      <button onClick={() => copyToClipboard(selectedTx.from, "Alamat Pengirim")} className="text-slate-500 hover:text-cyan-400">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                 </div>

                 {/* UPDATE: COPY TO */}
                 <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-slate-500">Ke</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-300 truncate w-24 text-right">{selectedTx.to}</span>
                      <button onClick={() => copyToClipboard(selectedTx.to, "Alamat Penerima")} className="text-slate-500 hover:text-cyan-400">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                 </div>

                 {/* UPDATE: COPY HASH */}
                 <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500">Hash ID</span>
                    <div className="flex items-center gap-2">
                       <a 
                         href={`https://sepolia.etherscan.io/tx/${selectedTx.hash}`}
                         target="_blank"
                         rel="noopener noreferrer" 
                         className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline"
                       >
                         {selectedTx.hash.slice(0, 6)}... <ExternalLink className="w-3 h-3" />
                       </a>
                       <button onClick={() => copyToClipboard(selectedTx.hash, "Transaction Hash")} className="text-slate-500 hover:text-cyan-400">
                          <Copy className="w-3 h-3" />
                       </button>
                    </div>
                 </div>
                 <div className="flex justify-between items-center border-t border-slate-800 pt-3 mt-1">
                    <span className="text-slate-500">Waktu</span>
                    <span className="font-mono text-slate-300 text-xs">
                       {new Date(selectedTx.timestamp * 1000).toLocaleString('id-ID', {
                          dateStyle: 'medium', 
                          timeStyle: 'medium'
                       })} WIB
                    </span>
                 </div>
              </div>

              <button 
                onClick={() => setSelectedTx(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl mt-4 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}