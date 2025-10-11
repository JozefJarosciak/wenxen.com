# Multi-Chain Configuration Comparison

Complete configuration reference for Ethereum, Base, and Avalanche networks in WenXen.com.

---

## Quick Reference Table

| Category | Ethereum | Base | Avalanche |
|----------|----------|------|-----------|
| **Chain ID** | 1 | 8453 | 43114 |
| **Short Name** | ETH | BASE | AVAX |
| **Explorer** | Etherscan | BaseScan | SnowTrace |
| **XEN Launch** | Oct 8, 2022 | Aug 25, 2023 | Oct 13, 2022 |
| **Deployment Block** | 15,704,871 | 3,098,388 | 27,265,450 |

---

## Network Details

### Ethereum Mainnet
- **Chain ID**: 1
- **Name**: Ethereum
- **Short Name**: ETH
- **Native Currency**: Ether (ETH), 18 decimals
- **Explorer**: [Etherscan](https://etherscan.io)

### Base Network
- **Chain ID**: 8453
- **Name**: Base
- **Short Name**: BASE
- **Native Currency**: Ether (ETH), 18 decimals
- **Explorer**: [BaseScan](https://basescan.org)

### Avalanche C-Chain
- **Chain ID**: 43114
- **Name**: Avalanche
- **Short Name**: AVAX
- **Native Currency**: Avalanche (AVAX), 18 decimals
- **Explorer**: [SnowTrace](https://snowtrace.io)

---

## RPC Endpoints

### Ethereum
- **Default**: `https://ethereum-rpc.publicnode.com`
- **Fallback**:
  - `https://cloudflare-eth.com`
  - `https://rpc.ankr.com/eth`
  - `https://ethereum.publicnode.com`

### Base
- **Default**: `https://base-rpc.publicnode.com`
- **Fallback**:
  - `https://mainnet.base.org`
  - `https://base.gateway.tenderly.co`
  - `https://base.blockpi.network/v1/rpc/public`
  - `https://1rpc.io/base`
  - `https://base.meowrpc.com`

### Avalanche
- **Default**: `https://api.avax.network/ext/bc/C/rpc`
- **Fallback**:
  - `https://avalanche-c-chain.publicnode.com`
  - `https://rpc.ankr.com/avalanche`
  - `https://avalanche.public-rpc.com`
  - `https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc`
  - `https://avalanche.drpc.org`

---

## Smart Contract Addresses

| Contract | Ethereum | Base | Avalanche |
|----------|----------|------|-----------|
| **XEN Crypto** | `0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8` | `0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5` | `0xC0C5AA69Dbe4d6DDdfBc89c0957686ec60F24389` |
| **CoinTool** | `0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628` | `0x9Ec1C3DcF667f2035FB4CD2eB42A1566fd54d2B7` | `0x9Ec1C3DcF667f2035FB4CD2eB42A1566fd54d2B7` |
| **XENFT Torrent** | `0x0a252663DBCc0b073063D6420a40319e438Cfa59` | `0x379002701BF6f2862e3dFdd1f96d3C5E1BF450B6` | `0x94d9E02D115646DFC407ABDE75Fa45256D66E043` |
| **XENFT Stake** | `0xfEdA03b91514D31b435d4E1519Fd9e699C29BbFC` | `0xfC0eC2f733Cf35863178fa0DF759c6CE8C38ee7b` | `0x1Ac17FFB8456525BfF46870bba7Ed8772ba063a5` |
| **Remint Helper** | `0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98` | `0xc82ba627ba29fc4da2d3343e2f0a2d40119c2885` ✅ | `0xd8fb02f08f940d9d87ae1ab81d78ac6ef134ca2e` ✅ |

> ✅ **Verified**: Each chain uses a different Remint Helper address. All contracts are 1130 bytes and functionally identical.

---

## Event Signatures & Selectors

**All chains use identical event signatures:**

| Event/Selector | Value | Status |
|----------------|-------|--------|
| **CoinTool Mint Topic** | `0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37` | ✅ Universal |
| **Remint Selector** | `0xc2580804` | ✅ Universal |
| **Claim Mint Reward Selector** | `0xa2309ff8` | ✅ Universal |
| **Claim And Stake Selector** | `0xf2f4eb26` | ✅ Universal |

---

## XEN Protocol Constants

| Constant | Ethereum | Base | Avalanche |
|----------|----------|------|-----------|
| **Genesis Timestamp** | 1665250163 | 1692986123 | 1665700430 |
| **Genesis Date** | Oct 8, 2022 00:00 UTC | Aug 25, 2023 16:13 UTC | Oct 13, 2022 19:40 UTC |
| **Deployment Block** | 15,704,871 | 3,098,388 | 27,265,450 |
| **Days Since Genesis** (approx) | ~1,189 | ~441 | ~1,184 |
| **Current AMP** (approx) | ~1,811 | ~2,559 | ~1,816 |
| **Base AMP** | 3000 | 3000 | 3000 |
| **Salt Bytes** | `0x01` | `0x01` | `0x01` |
| **CoinTool Salt** | `0x29A2241A010000000000` | `0x29A2241A010000000000` | `0x29A2241A010000000000` |

---

## Database Configuration

### Ethereum
- **CoinTool**: `ETH_DB_Cointool` (v3)
- **XENFT**: `ETH_DB_Xenft` (v1)
- **XEN Stake**: `ETH_DB_XenStake` (v1)
- **XENFT Stake**: `ETH_DB_XenftStake` (v1)

### Base
- **CoinTool**: `BASE_DB_Cointool` (v1)
- **XENFT**: `BASE_DB_Xenft` (v1)
- **XEN Stake**: `BASE_DB_XenStake` (v1)
- **XENFT Stake**: `BASE_DB_XenftStake` (v1)

### Avalanche
- **CoinTool**: `AVAX_DB_Cointool` (v1)
- **XENFT**: `AVAX_DB_Xenft` (v1)
- **XEN Stake**: `AVAX_DB_XenStake` (v1)
- **XENFT Stake**: `AVAX_DB_XenftStake` (v1)

> 🔒 **Complete Isolation**: Each chain maintains separate IndexedDB databases to prevent data contamination.

---

## API Integration

**All chains use the same CoinGecko API:**
- **XEN ID**: `xen-crypto`

**Explorer APIs:**
- **Ethereum**: `https://api.etherscan.io/api`
- **Base**: Uses Etherscan V2 API with `chainid=8453`
- **Avalanche**: Uses Etherscan V2 API with `chainid=43114`

---

## Key Similarities & Differences

### ✅ **Identical Across All Chains**
- Event signatures and function selectors
- Protocol constants (Salt, Base AMP, CoinTool Salt)
- Database structure (different names, same schema)
- CoinGecko integration

### ⚠️ **Chain-Specific**
- All smart contract addresses (except CoinTool on Base/Avalanche)
- Remint Helper addresses (different on each chain)
- XEN genesis dates and deployment blocks
- RPC endpoints and block explorers
- Current AMP values (time-dependent)

### 🎯 **Implementation Notes**
- **CoinTool**: Same address on Base and Avalanche (`0x9Ec1...`)
- **Remint Helpers**: All 1130 bytes, functionally identical, different addresses
- **Database Versions**: Ethereum CoinTool at v3 (mature), others at v1 (newer)

---

## Timeline Comparison

| Event | Ethereum | Avalanche | Base |
|-------|----------|-----------|------|
| **XEN Launch** | Oct 8, 2022 | Oct 13, 2022 (+5 days) | Aug 25, 2023 (+321 days) |
| **Maturity** | ~1,189 days | ~1,184 days | ~441 days |
| **Status** | Most mature | Similar to ETH | Newest deployment |

---

*Last Updated: 2025-01-10*
*Generated from `js/config/chainConfig.js`*
