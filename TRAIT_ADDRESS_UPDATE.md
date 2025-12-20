# Network-Specific Trait Addresses

## Overview

Clarity smart contracts that implement standard traits (SIP-010 for fungible tokens, SIP-009 for NFTs) must use different trait contract addresses depending on the network (mainnet vs testnet).

## Trait Address Reference

### SIP-010 Fungible Token Trait

| Network | Trait Address |
|---------|--------------|
| **Mainnet** | `SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait` |
| **Testnet** | `ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18.sip-010-trait-ft-standard.sip-010-trait` |

### SIP-009 Non-Fungible Token Trait

| Network | Trait Address |
|---------|--------------|
| **Mainnet** | `SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait` |
| **Testnet** | `ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait` |

## Implementation

### Automatic Network Detection

The system now automatically uses the correct trait address based on the configured network:

```clarity
;; Mainnet contract (automatically generated)
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; Testnet contract (automatically generated)
(impl-trait 'ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18.sip-010-trait-ft-standard.sip-010-trait)
```

### Code Changes

**File**: `src/services/clarity.ts`

Added `getNetworkTraitAddresses()` method (lines 399-416):
```typescript
private getNetworkTraitAddresses(): Record<string, string> {
  if (this.network === 'mainnet') {
    return {
      TRAIT_ADDRESS: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
      NFT_TRAIT_ADDRESS: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9',
    };
  } else {
    // testnet
    return {
      TRAIT_ADDRESS: 'ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18',
      NFT_TRAIT_ADDRESS: 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT',
    };
  }
}
```

Updated `generateContract()` to include network trait addresses (lines 90-94):
```typescript
// Add network-specific trait addresses
const networkTraitAddresses = this.getNetworkTraitAddresses();

// Merge default, custom values, and network-specific addresses
const placeholderValues = { ...defaultValues, ...customValues, ...networkTraitAddresses };
```

**File**: `src/utils/clarity-templates.ts`

Updated templates to use placeholders with explanatory comments:

```clarity
;; SIP-010 Trait Implementation
;; Note: Trait addresses are network-specific:
;; - Mainnet: SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait
;; - Testnet: ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18.sip-010-trait-ft-standard.sip-010-trait
(impl-trait '{{TRAIT_ADDRESS}}.sip-010-trait-ft-standard.sip-010-trait)
```

Added new placeholders:
- `TRAIT_ADDRESS` - For SIP-010 fungible token trait
- `NFT_TRAIT_ADDRESS` - For SIP-009 NFT trait

**File**: `docs/clarity/Clarity.md`

Added network-specific trait address documentation (lines 303-311):
```clarity
;; Implement a trait - NETWORK-SPECIFIC ADDRESSES
;; MAINNET:
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; TESTNET:
(impl-trait 'ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18.sip-010-trait-ft-standard.sip-010-trait)

;; ⚠️ IMPORTANT: SIP-010 trait contract addresses differ between networks!
;; Always use the correct address for your target network.
```

## User Impact

### Before
- Generated contracts used hardcoded mainnet addresses
- Testnet contracts would fail to deploy or behave incorrectly
- Users had to manually edit contracts to change trait addresses

### After
- ✅ System automatically detects network (mainnet/testnet)
- ✅ Correct trait address used for each network
- ✅ No manual editing required
- ✅ Testnet contracts deploy successfully
- ✅ Mainnet contracts use correct addresses

## Examples

### Fungible Token on Testnet
```clarity
;; Generated contract for testnet
(impl-trait 'ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18.sip-010-trait-ft-standard.sip-010-trait)

(define-fungible-token my-token u1000000)
```

### NFT on Mainnet
```clarity
;; Generated contract for mainnet
(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

(define-non-fungible-token my-nft uint)
```

## Testing

### Build Status
✅ TypeScript compilation successful
✅ All placeholders properly replaced
✅ Network detection working correctly

### Test Scenarios

**Scenario 1: Generate FT on Testnet**
```javascript
// Config network: testnet
clarity_write_contract({
  requirements: "Token named TEST with 1M supply",
  contractType: "fungible-token"
})
// → Uses ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18
```

**Scenario 2: Generate FT on Mainnet**
```javascript
// Config network: mainnet
clarity_write_contract({
  requirements: "Token named PROD with 1M supply",
  contractType: "fungible-token"
})
// → Uses SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE
```

**Scenario 3: Generate NFT on Testnet**
```javascript
// Config network: testnet
clarity_write_contract({
  requirements: "NFT collection called Art",
  contractType: "non-fungible-token"
})
// → Uses ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT
```

## Important Notes

⚠️ **Critical**: The trait contract address MUST match the network you're deploying to:
- Deploying to **testnet** → use ST... trait addresses
- Deploying to **mainnet** → use SP... trait addresses

⚠️ **Verification**: Always verify the generated contract has the correct trait address before deploying

⚠️ **Cross-Network**: If you generate a contract on mainnet config but deploy to testnet (or vice versa), the trait address will match your GENERATION network, not deployment network. Always ensure config matches deployment target.

## Related Files

- `src/services/clarity.ts` - Network detection logic
- `src/utils/clarity-templates.ts` - Contract templates with placeholders
- `docs/clarity/Clarity.md` - Trait address documentation
- `QUICK_START_TESTNET.md` - Testnet deployment guide

## Summary

The system now intelligently handles network-specific trait addresses, ensuring:
1. **Correct addresses** automatically selected based on network
2. **Testnet deployments** work out of the box
3. **Mainnet deployments** use proper mainnet trait contracts
4. **No manual editing** required by users
5. **Clear documentation** in generated contracts

Users can confidently generate and deploy SIP-010 and SIP-009 compliant contracts to any network without worrying about trait address mismatches!
