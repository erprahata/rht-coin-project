// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RahataCoin is ERC20, Ownable {
    uint256 public constant MINING_COOLDOWN = 1 minutes; 
    uint256 public constant MAX_SUPPLY = 10000000 * 10**18; 

    mapping(address => uint256) public lastMinedTime;

    event MiningSuccess(address indexed miner, uint256 amount);

    constructor() ERC20("RahataCoin", "RHT") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    function mineRahataCoin() public {
        require(block.timestamp >= lastMinedTime[msg.sender] + MINING_COOLDOWN, "Sabar bos! Masih cooldown.");
        require(totalSupply() < MAX_SUPPLY, "Maaf, seluruh RHT sudah habis (Sold Out)!");

        // --- LOGIKA RANDOM DESIMAL (0.001 - 2.0 RHT) ---
        uint256 randomHash = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.number)));
        
        // 1. Kita kocok angka antara 0 s/d 1999
        uint256 randomStep = randomHash % 2000; 

        // 2. Tambah 1, jadi rentangnya 1 s/d 2000
        uint256 finalStep = randomStep + 1;

        // 3. Konversi ke Wei
        // 1 RHT = 10^18 Wei
        // 0.001 RHT = 10^15 Wei
        // Jadi kita kalikan langkah tadi dengan 10^15
        uint256 finalReward = finalStep * (10**15);

        // Cek Supply agar tidak luber
        if (totalSupply() + finalReward > MAX_SUPPLY) {
            finalReward = MAX_SUPPLY - totalSupply();
        }

        lastMinedTime[msg.sender] = block.timestamp;
        _mint(msg.sender, finalReward);

        emit MiningSuccess(msg.sender, finalReward);
    }
}