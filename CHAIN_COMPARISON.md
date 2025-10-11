# Ethereum vs Base Chain Configuration Comparison

## Quick Reference: Complete Settings Extraction

### All Network Settings in Tabulated Format

| Setting Category | Setting Name | Ethereum Value | Base Value                                                           |
|------------------|--------------|----------------|----------------------------------------------------------------------|
| **Network** | Chain ID | `1` | `8453`                                                               |
| **Network** | Name | `Ethereum` | `Base`                                                               |
| **Network** | Short Name | `ETH` | `BASE`                                                               |
| **Network** | Native Currency Name | `Ether` | `Ether`                                                              |
| **Network** | Native Currency Symbol | `ETH` | `ETH`                                                                |
| **Network** | Native Currency Decimals | `18` | `18`                                                                 |
| **RPC** | Default RPC | `https://ethereum-rpc.publicnode.com` | `https://base-rpc.publicnode.com`                                    |
| **RPC** | Fallback RPC 1 | `https://cloudflare-eth.com` | `https://mainnet.base.org`                                           |
| **RPC** | Fallback RPC 2 | `https://rpc.ankr.com/eth` | `https://base.gateway.tenderly.co`                                   |
| **RPC** | Fallback RPC 3 | `https://ethereum.publicnode.com` | `https://base.blockpi.network/v1/rpc/public`                         |
| **RPC** | Fallback RPC 4 | `N/A` | `https://1rpc.io/base`                                               |
| **RPC** | Fallback RPC 5 | `N/A` | `https://base.meowrpc.com`                                           |
| **Explorer** | Name | `Etherscan` | `BaseScan`                                                           |
| **Explorer** | Base URL | `https://etherscan.io` | `https://basescan.org`                                               |
| **Explorer** | API URL | `https://api.etherscan.io/api` | `https://api.basescan.org/api`                                       |
| **Explorer** | Transaction URL | `https://etherscan.io/tx/` | `https://basescan.org/tx/`                                           |
| **Explorer** | Address URL | `https://etherscan.io/address/` | `https://basescan.org/address/`                                      |
| **Explorer** | Block URL | `https://etherscan.io/block/` | `https://basescan.org/block/`                                        |
| **Contracts** | XEN_CRYPTO | `0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8` | `0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5`                         |
| **Contracts** | COINTOOL | `0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628` | `0x9Ec1C3DcF667f2035FB4CD2eB42A1566fd54d2B7`                         |
| **Contracts** | XENFT_TORRENT | `0x0a252663DBCc0b073063D6420a40319e438Cfa59` | `0x379002701BF6f2862e3dFdd1f96d3C5E1BF450B6`                         |
| **Contracts** | XENFT_STAKE | `0xfEdA03b91514D31b435d4E1519Fd9e699C29BbFC` | `0xfC0eC2f733Cf35863178fa0DF759c6CE8C38ee7b`                         |
| **Contracts** | REMINT_HELPER | `0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98` | `0xc82ba627ba29fc4da2d3343e2f0a2d40119c2885`                         |
| **Events** | COINTOOL_MINT_TOPIC | `0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37` | `0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37` |
| **Events** | REMINT_SELECTOR | `0xc2580804` | `0xc2580804`                                                         |
| **Events** | CLAIM_MINT_REWARD_SELECTOR | `0xa2309ff8` | `0xa2309ff8`                                                         |
| **Events** | CLAIM_AND_STAKE_SELECTOR | `0xf2f4eb26` | `0xf2f4eb26`                                                         |
| **Constants** | SALT_BYTES_TO_QUERY | `0x01` | `0x01`                                                               |
| **Constants** | COINTOOL_SALT_BYTES | `0x29A2241A010000000000` | `0x29A2241A010000000000`                                             |
| **Constants** | XEN_GENESIS_TIMESTAMP | `1665250163` | `1692986123`                                                         |
| **Constants** | XEN_GENESIS_DATE_MS | `1665187200000` (Oct 8, 2022) | `1692980033000` (Aug 25, 2023)                                       |
| **Constants** | XEN_DEPLOYMENT_BLOCK | `15704871` | `3098388`                                                            |
| **Constants** | BASE_AMP | `3000` | `3000`                                                               |
| **Databases** | COINTOOL_DB | `ETH_DB_Cointool` | `BASE_DB_Cointool`                                                   |
| **Databases** | XENFT_DB | `ETH_DB_Xenft` | `BASE_DB_Xenft`                                                      |
| **Databases** | XEN_STAKE_DB | `ETH_DB_XenStake` | `BASE_DB_XenStake`                                                   |
| **Databases** | XENFT_STAKE_DB | `ETH_DB_XenftStake` | `BASE_DB_XenftStake`                                                 |
| **DB Versions** | COINTOOL | `3` | `1`                                                                  |
| **DB Versions** | XENFT | `1` | `1`                                                                  |
| **DB Versions** | STAKE | `1` | `1`                                                                  |
| **API** | CoinGecko XEN ID | `xen-crypto` | `xen-crypto`                                                         |

---

## Network Identifiers

| Property | Ethereum | Base |
|----------|----------|------|
| **Chain ID** | 1 | 8453 |
| **Name** | Ethereum | Base |
| **Short Name** | ETH | BASE |
| **Native Currency Name** | Ether | Ether |
| **Native Currency Symbol** | ETH | ETH |
| **Native Currency Decimals** | 18 | 18 |

---

## RPC Endpoints

| Type | Ethereum | Base |
|------|----------|------|
| **Default RPC** | `https://ethereum-rpc.publicnode.com` | `https://base-rpc.publicnode.com` |
| **Fallback RPC 1** | `https://cloudflare-eth.com` | `https://mainnet.base.org` |
| **Fallback RPC 2** | `https://rpc.ankr.com/eth` | `https://base.gateway.tenderly.co` |
| **Fallback RPC 3** | `https://ethereum.publicnode.com` | `https://base.blockpi.network/v1/rpc/public` |
| **Fallback RPC 4** | - | `https://1rpc.io/base` |
| **Fallback RPC 5** | - | `https://base.meowrpc.com` |
| **Total RPC Count** | 4 (1 default + 3 fallback) | 6 (1 default + 5 fallback) |

---

## Block Explorer Configuration

| Property | Ethereum | Base |
|----------|----------|------|
| **Explorer Name** | Etherscan | BaseScan |
| **Base URL** | `https://etherscan.io` | `https://basescan.org` |
| **API URL** | `https://api.etherscan.io/api` | `https://api.basescan.org/api` |
| **Transaction URL** | `https://etherscan.io/tx/` | `https://basescan.org/tx/` |
| **Address URL** | `https://etherscan.io/address/` | `https://basescan.org/address/` |
| **Block URL** | `https://etherscan.io/block/` | `https://basescan.org/block/` |

---

## Smart Contract Addresses

| Contract | Ethereum | Base |
|----------|----------|------|
| **XEN Crypto** | `0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8` | `0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5` |
| **Cointool** | `0x0dE8bf93dA2f7eecb3d9169422413A9bef4ef628` | `0x9Ec1C3DcF667f2035FB4CD2eB42A1566fd54d2B7` |
| **XENFT Torrent** | `0x0a252663DBCc0b073063D6420a40319e438Cfa59` | `0x379002701BF6f2862e3dFdd1f96d3C5E1BF450B6` |
| **XENFT Stake** | `0xfEdA03b91514D31b435d4E1519Fd9e699C29BbFC` | `0xfC0eC2f733Cf35863178fa0DF759c6CE8C38ee7b` |
| **Remint Helper** | `0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98` | `0xc82ba627ba29fc4da2d3343e2f0a2d40119c2885` ✅ |

> ✅ **Verified**: Base uses a different Remint Helper address. Both contracts are 1130 bytes and functionally identical.

---

## Event Signatures & Selectors

| Event/Selector | Ethereum | Base | Status |
|----------------|----------|------|--------|
| **Cointool Mint Topic** | `0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37` | `0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37` | ✅ Same |
| **Remint Selector** | `0xc2580804` | `0xc2580804` | ✅ Same |
| **Claim Mint Reward Selector** | `0xa2309ff8` | `0xa2309ff8` | ✅ Same |
| **Claim And Stake Selector** | `0xf2f4eb26` | `0xf2f4eb26` | ✅ Same |

> ✅ **Note**: All event signatures are identical between chains (Base uses same contract interfaces)

---

## XEN Protocol Constants

| Constant | Ethereum | Base | Difference |
|----------|----------|------|------------|
| **Salt Bytes to Query** | `0x01` | `0x01` | ✅ Same |
| **Cointool Salt Bytes** | `0x29A2241A010000000000` | `0x29A2241A010000000000` | ✅ Same |
| **XEN Genesis Timestamp** | `1665250163` | `1692986123` | +27,735,960 sec (~321 days) |
| **XEN Genesis Date** | Oct 8, 2022 00:00:00 UTC | Aug 25, 2023 16:13:53 UTC | ~10.5 months later |
| **XEN Deployment Block** | `15704871` | `3095343` | Different network, different block |
| **Base AMP** | `3000` | `3000` | ✅ Same |

### Genesis Date Details
- **Ethereum Launch**: October 8, 2022 at 00:00:00 UTC
- **Base Launch**: August 25, 2023 at 16:13:53 UTC
- **Time Difference**: Approximately 321 days (10.5 months)

---

## Database Configuration

### Database Names

| Database Type | Ethereum | Base |
|---------------|----------|------|
| **Cointool DB** | `ETH_DB_Cointool` | `BASE_DB_Cointool` |
| **XENFT DB** | `ETH_DB_Xenft` | `BASE_DB_Xenft` |
| **XEN Stake DB** | `ETH_DB_XenStake` | `BASE_DB_XenStake` |
| **XENFT Stake DB** | `ETH_DB_XenftStake` | `BASE_DB_XenftStake` |

> 🔒 **Isolation**: Each chain maintains completely separate IndexedDB databases to prevent data contamination

### Database Versions

| Database | Ethereum | Base | Notes |
|----------|----------|------|-------|
| **Cointool** | Version 3 | Version 1 | Ethereum more mature |
| **XENFT** | Version 1 | Version 1 | ✅ Same |
| **Stake** | Version 1 | Version 1 | ✅ Same |

---

## External API Integration

| Service | Ethereum | Base | Status |
|---------|----------|------|--------|
| **CoinGecko XEN ID** | `xen-crypto` | `xen-crypto` | ✅ Same ID used |

> 📊 **Price Data**: Both chains use the same CoinGecko API ID for XEN price tracking

---

## Current Protocol Status (as of today)

### Days Since Genesis

| Chain | Genesis Date | Days Since Genesis (approx) |
|-------|--------------|------------------------------|
| **Ethereum** | Oct 8, 2022 | ~854 days |
| **Base** | Aug 25, 2023 | ~412 days |

### Current AMP Values

| Chain | Formula | Current AMP (approx) |
|-------|---------|---------------------|
| **Ethereum** | `3000 - 854` | ~2,146 |
| **Base** | `3000 - 412` | ~2,588 |

> ⚡ **Note**: Base has higher current AMP due to later launch date

---

## Storage Keys & Namespacing

All localStorage and IndexedDB keys are prefixed with the chain identifier to prevent cross-chain contamination:

| Base Key | Ethereum Key | Base Key |
|----------|--------------|----------|
| `customRPC` | `ETHEREUM_customRPC` | `BASE_customRPC` |
| `customRPC_source` | `ETHEREUM_customRPC_source` | `BASE_customRPC_source` |
| `customRPC_lastKnown` | `ETHEREUM_customRPC_lastKnown` | `BASE_customRPC_lastKnown` |
| `scanState` | Stored in `ETH_DB_Cointool` | Stored in `BASE_DB_Cointool` |

---

## Key Architectural Differences

### 1. **RPC Resilience**
- **Ethereum**: 4 RPC endpoints (less redundancy)
- **Base**: 6 RPC endpoints (more redundancy, newer network needs it)

### 2. **Database Versioning**
- **Ethereum Cointool**: Version 3 (multiple migrations, mature)
- **Base Cointool**: Version 1 (newer deployment, no migrations yet)

### 3. **Network Maturity**
- **Ethereum**: ~854 days of XEN history
- **Base**: ~412 days of XEN history (launched later)

### 4. **Block Numbers**
- Networks have completely independent block progression
- Ethereum started XEN at block 15,704,871
- Base started XEN at block 3,095,343

---

## Cross-Chain Protection Mechanisms

The codebase implements several protections against cross-chain contamination:

1. **Database Isolation**: Separate IndexedDB databases per chain
2. **RPC Source Tracking**: `customRPC_source` metadata tracks which chain RPC settings belong to
3. **Last Known Values**: `customRPC_lastKnown` provides recovery from accidental overwrites
4. **Contamination Detection**: Heuristic checks to detect when one chain's settings overwrite another
5. **Chain-Specific Keys**: All localStorage keys prefixed with chain identifier

---

## Summary

| Aspect | Similarity Level | Notes |
|--------|-----------------|-------|
| **Contract Interfaces** | 🟢 100% Same | Event signatures, selectors identical |
| **Network Infrastructure** | 🔴 Completely Different | Different chain IDs, RPCs, explorers |
| **Smart Contracts** | 🔴 All Different | Separate deployments on each chain |
| **XEN Launch Timing** | 🔴 Different | ~321 days apart |
| **Database Architecture** | 🟡 Same Structure | Different names/versions for isolation |
| **Price Tracking** | 🟢 Same API | Both use CoinGecko `xen-crypto` |
| **Constants (Salt/AMP)** | 🟢 Same Values | Protocol constants identical |

---

**Legend**:
- 🟢 = Identical or very similar
- 🟡 = Same structure, different values
- 🔴 = Completely different
- ✅ = Confirmed same
- ⚠️ = Needs verification

---

*Generated from `js/config/chainConfig.js` - Last updated: 2025-10-10*
