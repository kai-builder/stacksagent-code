# Clarity Smart Contract Development Guide

## Overview
Clarity is a decidable smart contract language that optimizes for predictability and security. It is used on the Stacks blockchain, which settles on Bitcoin.

## Key Characteristics

### 1. **Decidability**
- Clarity is NOT Turing-complete (intentional design choice)
- No recursion allowed
- All code paths must be determinable at compile time
- No runtime surprises or unexpected gas consumption

### 2. **Interpreted Language**
- Code is not compiled to bytecode
- Smart contracts are published and executed in human-readable form
- Source code is always available on-chain

### 3. **Post-Conditions**
- Unique feature allowing users to specify guarantees about transaction outcomes
- Transactions revert if post-conditions aren't met
- Protects users from malicious or buggy contracts

## Syntax Basics

### Language Style
- Lisp-like syntax with parentheses
- Prefix notation: `(+ 1 2)` instead of `1 + 2`
- Everything is an expression that returns a value

### Basic Structure
```clarity
;; Comments use semicolons

;; Define constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u100))

;; Define data variables
(define-data-var counter uint u0)

;; Define data maps
(define-map balances principal uint)

;; Define public functions
(define-public (increment)
  (ok (var-set counter (+ (var-get counter) u1))))

;; Define read-only functions
(define-read-only (get-counter)
  (var-get counter))

;; Define private functions
(define-private (internal-function (amount uint))
  (+ amount u1))
```

## Data Types

### Primitive Types
- `int` - Signed 128-bit integer
- `uint` - Unsigned 128-bit integer (prefix with `u`, e.g., `u100`)
- `bool` - Boolean (`true` or `false`)
- `principal` - Stacks address (e.g., `'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM`)
- `(buff N)` - Byte buffer of max length N
- `(string-ascii N)` - ASCII string of max length N
- `(string-utf8 N)` - UTF-8 string of max length N

### Composite Types
- `(response A B)` - Result type with ok type A and err type B
- `(optional A)` - Optional value of type A
- `(tuple (key1 type1) (key2 type2))` - Tuple/object structure
- `(list N A)` - List of max length N containing type A

## Response Types (Critical!)

### Understanding `(response ok-type err-type)`
Every public function MUST return a response type:
```clarity
;; Good - returns response
(define-public (transfer (amount uint))
  (ok true))

;; Bad - doesn't compile (public function must return response)
(define-public (transfer (amount uint))
  true)
```

### ok and err
- `(ok value)` - Successful response
- `(err value)` - Error response
- Use `try!` to unwrap responses and propagate errors
- Use `unwrap!` to unwrap with a default error value
- Use `unwrap-panic` only when you're certain it won't fail

```clarity
(define-public (example)
  (let ((result (some-function)))
    ;; If some-function returns (err ...), propagate it
    (try! result)
    ;; Otherwise continue with ok value
    (ok u1)))
```

## Storage Types

### 1. Constants
```clarity
(define-constant MAX_SUPPLY u1000000)
;; Cannot be changed after deployment
```

### 2. Data Variables
```clarity
(define-data-var total-supply uint u0)

;; Read
(var-get total-supply)

;; Write
(var-set total-supply u100)
```

### 3. Data Maps
```clarity
(define-map token-balances principal uint)

;; Write
(map-set token-balances tx-sender u100)

;; Read (returns optional)
(map-get? token-balances tx-sender)

;; Delete
(map-delete token-balances tx-sender)

;; Insert only if doesn't exist
(map-insert token-balances tx-sender u100)
```

## Important Built-in Variables

- `tx-sender` - Principal that signed the transaction
- `contract-caller` - Immediate caller (can be contract or principal)
- `block-height` - Current block height
- `burn-block-height` - Current Bitcoin block height (used for timing)
- `stacks-block-height` - Current Stacks block height
- `stx-liquid-supply` - Total liquid STX supply
- `is-in-regtest` - Boolean indicating test environment

## Common Patterns

### Authorization Check
```clarity
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u100))

(define-public (admin-function)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    ;; rest of function
    (ok true)))
```

### Safe Math with Asserts
```clarity
(define-public (add-balance (amount uint))
  (let ((current-balance (default-to u0 (map-get? balances tx-sender))))
    ;; Check for overflow
    (asserts! (<= amount (- u340282366920938463463374607431768211455 current-balance))
              (err u1))
    (ok (map-set balances tx-sender (+ current-balance amount)))))
```

### Using Optionals
```clarity
;; default-to provides fallback value
(define-read-only (get-balance (account principal))
  (default-to u0 (map-get? balances account)))

;; unwrap! provides custom error
(define-public (require-balance (account principal))
  (let ((balance (unwrap! (map-get? balances account) (err u404))))
    (ok balance)))
```

### Working with Lists
```clarity
(define-read-only (sum-list (numbers (list 10 uint)))
  (fold + numbers u0))

(define-read-only (process-items (items (list 5 uint)))
  (map process-item items))

(define-private (process-item (item uint))
  (* item u2))
```

## Critical Gotchas & Best Practices

### 1. **No Floating Point**
- Only integers (int/uint)
- Use basis points for percentages (e.g., 10000 = 100%)
- Be careful with division (rounds down)
- Use precision factors for calculations:
```clarity
(define-constant ONE_6 u1000000) ;; Precision factor
;; Calculate: (amount * rate) / ONE_6
(/ (* amount rate) ONE_6)
```

### 2. **Numeric Literal Syntax**
```clarity
u100  ;; unsigned integer 100
100   ;; signed integer 100
-50   ;; signed integer -50
;; u-50  ;; INVALID - unsigned can't be negative
```

### 3. **Map Keys Can Be Tuples**
```clarity
(define-map allowances {owner: principal, spender: principal} uint)

(map-set allowances {owner: tx-sender, spender: 'ST1234...} u1000)
```

### 4. **Asserts Order Matters**
```clarity
;; Good - cheap check first
(define-public (expensive-operation)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (is-expensive-check-valid) ERR_INVALID)
    (ok true)))
```

### 5. **Use `try!` for Error Propagation**
```clarity
(define-public (multi-step)
  (begin
    (try! (step-one))
    (try! (step-two))
    (try! (step-three))
    (ok true)))
```

### 6. **Match for Safe Optional Handling**
```clarity
(match (map-get? balances account)
  balance (ok balance)
  (err u404))
```

### 7. **Contract Calls**
```clarity
;; Call another contract
(contract-call? .other-contract function-name arg1 arg2)

;; Use try! to propagate errors from contract calls
(try! (contract-call? .token-contract transfer u100 recipient))
```

### 8. **No Dynamic Contract Calls**
- All contract calls must be to known, specific contracts
- Cannot call contracts based on runtime values
- This is a security feature

### 9. **Transaction Atomicity**
- All operations in a transaction succeed or all fail
- No partial state changes
- Use this for safe multi-step operations

### 10. **Testing is Essential**
```clarity
;; Use Clarinet for local testing
clarinet test
clarinet console
clarinet integrate

;; Write comprehensive unit tests
;; Test all error conditions
;; Test edge cases (u0, max uint, etc.)
```

## Traits (Interfaces)

Traits define interfaces that contracts can implement:

```clarity
;; Define a trait
(define-trait sip-010-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 32) uint))
    (get-decimals () (response uint uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

;; Implement a trait - NETWORK-SPECIFIC ADDRESSES
;; MAINNET:
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; TESTNET:
(impl-trait 'ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18.sip-010-trait-ft-standard.sip-010-trait)

;; ⚠️ IMPORTANT: SIP-010 trait contract addresses differ between networks!
;; Always use the correct address for your target network.

;; Use a trait as parameter type
(use-trait ft-trait .sip-010-trait-ft-standard.sip-010-trait)

(define-public (some-function (token-trait <ft-trait>))
  (begin
    ;; Verify the contract implements the expected trait
    (asserts! (is-eq (contract-of token-trait) EXPECTED_TOKEN) ERR-INVALID-TOKEN)
    ;; Use the trait
    (contract-call? token-trait transfer u100 tx-sender recipient none)
  )
)
```

## Fungible Tokens (SIP-010)

Creating a fungible token:

```clarity
;; Define the token
(define-fungible-token my-token u1000000000000)

;; Mint tokens
(ft-mint? my-token u1000 recipient)

;; Burn tokens
(ft-burn? my-token u500 sender)

;; Transfer tokens
(ft-transfer? my-token u100 sender recipient)

;; Get balance
(ft-get-balance my-token account)

;; Get supply
(ft-get-supply my-token)
```

## STX Transfers

```clarity
;; Transfer STX
(stx-transfer? u1000000 sender recipient)

;; Get STX balance
(stx-get-balance account)

;; As-contract pattern for contract-owned STX
(as-contract (stx-transfer? amount tx-sender recipient))
```

## Block Height & Timing

```clarity
;; Use burn-block-height (Bitcoin blocks) for timing
(define-constant START_BLOCK u50000)
(define-constant END_BLOCK u60000)

;; Check if event is active
(asserts! (and
  (<= START_BLOCK burn-block-height)
  (> END_BLOCK burn-block-height)) ERR-NOT-ACTIVE)

;; Calculate time elapsed
(let ((blocks-elapsed (- burn-block-height start-height)))
  ;; Do something with elapsed time
)
```

## VRF (Verifiable Random Function)

For randomness in contracts:

```clarity
;; Get VRF seed from previous block
(define-read-only (get-random-uint-at-block)
  (let (
    (vrf-lower-uint-opt
      (match (get-tenure-info? vrf-seed (- stacks-block-height u1))
        vrf-seed (some (buff-to-uint-le (lower-16-le vrf-seed)))
        none))
  )
  vrf-lower-uint-opt)
)

;; Use with fallback
(let (
  (vrf-result (get-random-uint-at-block))
  (block-hash (unwrap-panic (get-stacks-block-info? id-header-hash (- stacks-block-height u1))))
  (fallback-random (mod (+ stacks-block-height (len block-hash)) u1000000))
  (random-value (default-to fallback-random vrf-result))
)
  ;; Use random-value
  (mod random-value max-range)
)
```

## Print Events

Emit events for off-chain indexers:

```clarity
(print {
  type: "deposit",
  user: tx-sender,
  amount: amount,
  timestamp: burn-block-height
})
```

## Security Best Practices

### 1. **Check-Effects-Interactions Pattern**
```clarity
(define-public (withdraw (amount uint))
  (let ((balance (unwrap! (map-get? balances tx-sender) ERR_NO_BALANCE)))
    ;; Checks
    (asserts! (>= balance amount) ERR_INSUFFICIENT_BALANCE)

    ;; Effects
    (map-set balances tx-sender (- balance amount))

    ;; Interactions
    (try! (as-contract (stx-transfer? amount tx-sender contract-caller)))
    (ok true)))
```

### 2. **Reentrancy Protection**
- Not a major concern in Clarity (no Ether-like callbacks)
- Still good to update state before external calls

### 3. **Integer Overflow/Underflow**
```clarity
;; Clarity checks for overflow/underflow automatically
;; Transaction aborts on overflow
;; Still good to check explicitly for better error messages
(asserts! (>= balance amount) ERR_UNDERFLOW)
```

### 4. **Access Control**
```clarity
;; Always verify caller identity
(asserts! (is-eq tx-sender expected-principal) ERR_UNAUTHORIZED)

;; Be careful with contract-caller vs tx-sender
;; tx-sender = who signed transaction
;; contract-caller = immediate caller (might be a contract)
```

### 5. **Validate All Inputs**
```clarity
(define-public (set-value (value uint))
  (begin
    (asserts! (> value u0) ERR_INVALID_VALUE)
    (asserts! (<= value MAX_VALUE) ERR_VALUE_TOO_HIGH)
    (ok (var-set stored-value value))))
```

### 6. **Use `as-contract` Carefully**
```clarity
;; as-contract changes tx-sender to contract address
(as-contract (stx-transfer? amount tx-sender recipient))
;; Inside: tx-sender = contract address
```

### 7. **Whitelist Pattern**
```clarity
(define-map whitelist principal bool)

(define-public (add-to-whitelist (address principal))
  (begin
    (try! (check-is-admin))
    (map-set whitelist address true)
    (ok true)
  )
)

(define-private (check-whitelisted (address principal))
  (asserts! (default-to false (map-get? whitelist address)) ERR-NOT-WHITELISTED)
)
```

### 8. **Multi-Step Operations**
```clarity
;; For complex operations, use begin to sequence
(define-public (complex-operation)
  (begin
    ;; Step 1: Validation
    (try! (validate-inputs))

    ;; Step 2: State updates
    (var-set state-var new-value)
    (map-set state-map key value)

    ;; Step 3: External calls
    (try! (contract-call? .other-contract function))

    ;; Step 4: Emit event
    (print {type: "operation-complete"})

    (ok true)
  )
)
```

## Real-World Patterns from Sample Contracts

### 1. **Presale Contract Pattern**
```clarity
;; Time-bounded sale with caps
(define-constant START_BLOCK u50000)
(define-constant END_BLOCK u60000)
(define-constant HARDCAP u100000000)
(define-constant SOFTCAP u50000000)

(define-public (buy (amount uint))
  (begin
    ;; Time check
    (asserts! (> END_BLOCK burn-block-height) ERR-PRESALE-ENDED)

    ;; Cap check
    (asserts! (<= (+ amount (var-get stx-pool)) HARDCAP) ERR-HARDCAP-EXCEEDED)

    ;; Process purchase
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set stx-pool (+ (var-get stx-pool) amount))
    (map-set deposits {user: tx-sender} (+ (get-deposit tx-sender) amount))

    (ok true)
  )
)
```

### 2. **Vesting Contract Pattern**
```clarity
;; Multi-milestone vesting
(define-constant MILESTONE_1_BLOCKS u0)
(define-constant MILESTONE_1_PERCENT u20)
(define-constant MILESTONE_2_BLOCKS u500)
(define-constant MILESTONE_2_PERCENT u40)

(define-private (get-vested-percentage (start-height uint))
  (let ((blocks-elapsed (- burn-block-height start-height)))
    (if (>= blocks-elapsed MILESTONE_2_BLOCKS)
      MILESTONE_2_PERCENT
      (if (>= blocks-elapsed MILESTONE_1_BLOCKS)
        MILESTONE_1_PERCENT
        u0
      )
    )
  )
)

(define-public (claim)
  (let (
    (allocation (get-allocation tx-sender))
    (claimed (get-claimed tx-sender))
    (vested-percent (get-vested-percentage (get-start-height tx-sender)))
    (vested-amount (/ (* allocation vested-percent) u100))
    (claimable (- vested-amount claimed))
  )
    (asserts! (> claimable u0) ERR-NOTHING-TO-CLAIM)
    (try! (as-contract (contract-call? .token transfer claimable tx-sender)))
    (map-set claimed-amounts {user: tx-sender} vested-amount)
    (ok claimable)
  )
)
```

### 3. **Lottery/Random Selection Pattern**
```clarity
(define-constant MAX_TICKETS u30)
(define-map tickets {lottery-id: uint, ticket-id: uint} {buyer: principal})

(define-public (buy-ticket)
  (let ((ticket-id (var-get ticket-counter)))
    (asserts! (< ticket-id MAX_TICKETS) ERR-SOLD-OUT)
    (try! (stx-transfer? TICKET-PRICE tx-sender (as-contract tx-sender)))
    (map-set tickets {lottery-id: (var-get lottery-id), ticket-id: ticket-id} {buyer: tx-sender})
    (var-set ticket-counter (+ ticket-id u1))
    (ok ticket-id)
  )
)

(define-public (reveal-winner)
  (let (
    (vrf-result (get-random-uint-at-block))
    (random-value (default-to fallback-random vrf-result))
    (winning-ticket-id (mod random-value (var-get ticket-counter)))
    (winner-info (unwrap-panic (map-get? tickets {lottery-id: (var-get lottery-id), ticket-id: winning-ticket-id})))
  )
    (try! (as-contract (stx-transfer? prize-amount tx-sender (get buyer winner-info))))
    (ok {winner: (get buyer winner-info), ticket-id: winning-ticket-id})
  )
)
```

### 4. **Batch Operations Pattern**
```clarity
;; Send tokens to multiple recipients
(define-public (send-many (recipients (list 200 {to: principal, amount: uint, memo: (optional (buff 34))})))
  (fold check-err (map send-token recipients) (ok true))
)

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
  (match prior
    ok-value result
    err-value (err err-value))
)

(define-private (send-token (recipient {to: principal, amount: uint, memo: (optional (buff 34))}))
  (transfer (get amount recipient) tx-sender (get to recipient) (get memo recipient))
)
```

## Common Errors to Avoid

1. **Forgetting `u` prefix for uints** → `u100` not `100`
2. **Not handling optionals** → Use `default-to`, `unwrap!`, or `match`
3. **Ignoring response types** → Always use `try!` or `unwrap!`
4. **Missing error propagation** → Use `try!` for nested calls
5. **Off-by-one errors with block-height** → Remember current block hasn't finished
6. **Division by zero** → Always check divisor
7. **Not testing edge cases** → Test with u0, max values, boundaries
8. **Using `stacks-block-height` instead of `burn-block-height`** → Use Bitcoin blocks for timing
9. **Forgetting `as-contract` for contract transfers** → Contract needs to be sender
10. **Not validating trait contracts** → Always check `(contract-of token-trait)`

## Development Workflow

1. **Setup**: Install Clarinet (`brew install clarinet` or download from GitHub)
2. **Create Project**: `clarinet new my-project`
3. **Create Contract**: `clarinet contract new my-contract`
4. **Write Contract**: Edit `.clar` files in `contracts/` directory
5. **Check Syntax**: `clarinet check`
6. **Test**: Write tests in `tests/` directory (TypeScript/JavaScript)
7. **Console**: `clarinet console` for interactive testing
8. **Deploy**: Use Clarinet or Stacks CLI to deploy

## Useful Clarinet Commands

```bash
clarinet new project-name          # Create new project
clarinet contract new contract-name # Create new contract
clarinet check                      # Syntax check
clarinet test                       # Run tests
clarinet console                    # Interactive REPL
clarinet integrate                  # Integration tests
clarinet deploy                     # Deploy contracts

# In console:
(contract-call? .my-contract function-name args)
::get_costs                         # Show gas costs
::get_assets_maps                   # Show all balances
```

## Testing Best Practices

```typescript
// Example test structure
Clarinet.test({
  name: "Ensure that users can buy tokens",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    let block = chain.mineBlock([
      Tx.contractCall(
        "presale",
        "buy",
        [types.uint(10000000)],
        wallet1.address
      ),
    ]);

    // Check success
    block.receipts[0].result.expectOk();

    // Check state
    let deposit = chain.callReadOnlyFn(
      "presale",
      "get-user-deposits",
      [types.principal(wallet1.address)],
      wallet1.address
    );
    deposit.result.expectUint(10000000);
  },
});
```

## Resources

- [Clarity Language Reference](https://docs.stacks.co/clarity/)
- [Clarity Book](https://book.clarity-lang.org/)
- [Clarinet Documentation](https://github.com/hirosystems/clarinet)
- [Stacks Documentation](https://docs.stacks.co/)
- [SIP-010 Token Standard](https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md)
- [Hiro Platform](https://www.hiro.so/)
- [Stacks Explorer](https://explorer.stacks.co/)
- Using real-time price data in Clarity (Pyth + Wormhole + Hermes): https://www.hiro.so/blog/using-real-time-price-data-in-clarity#pull-vaa-messages-from-wormhole-via-the-hermes-api

## Repositories With Smart Contracts

This curated list is based on friedger/clarity-smart-contracts and highlights common application domains, useful patterns to study, and links for reference.

- Swapr — Trustless token exchange: https://github.com/psq/swapr
  - Patterns: automated market maker, invariant checks, liquidity pool accounting, fee accounting, slippage bounds via post-conditions, reentrancy-safe sequencing.
  - Study: precise math with scaling factors, symmetric mint/burn of LP tokens, guarding against dust liquidity.

- Flexr — Elastic supply token: https://github.com/psq/flexr
  - Patterns: rebasing token economics, snapshotting supply, proportional balance adjustment via global index, governance/owner gates for rebase.
  - Study: safe math for rebasing, explicit eventing for supply changes, user-facing read-only helpers for UI.

- Stackstarter — Crowdfunding: https://github.com/MarvinJanssen/stackstarter
  - Patterns: softcap/hardcap tracking, time windows using burn-block-height, refund and finalize flows, per-contributor ledger.
  - Study: clear state machine, idempotent refunds, post-conditions for contribution bounds.

- Marketplace (NFT + market): https://github.com/friedger/clarity-marketplace
  - Patterns: listing structs, custody vs. escrow models, bids/asks, fee/royalty routing, disable/ban flags on tokens.
  - Study: robust trait use for NFTs, settlement order: checks → effects → interactions.

- Loopbomb Marketplace (art NFTs): https://github.com/radicleart/clarity-market
  - Patterns: curated creators, mint permissions, on-chain metadata URIs, marketplace integration.
  - Study: creator registries, metadata size limits, provenance events.

- Profit Sharing Token (royalties): https://github.com/friedger/clarity-profit-sharing-token
  - Patterns: resale royalty distribution, on-transfer hooks via marketplace, revenue splitting ledger.
  - Study: deterministic distribution across participants, rounding/leftover handling, claimable vs. push payouts.

- Blind Poll — Anonymous poll with reveal: https://github.com/zexxlin/clarity-blind-poll
  - Patterns: commit–reveal, hash commitments with salts, reveal windows, tally verification.
  - Study: timing windows, handling non-revealed commitments, anti-front-running via commit hashes.

- Highscore — Leaderboard: https://github.com/xmakina/clarity-high-score
  - Patterns: ordered insertion, capped lists, duplicate handling, per-user best tracking.
  - Study: gas-friendly pagination, read-only views, tuple keys for ordering.

- Redistribution — Treasury/pot: https://github.com/xmakina/redistribution-contract
  - Patterns: pooled funds, distribution rules, periodic claims, governance for parameters.
  - Study: claims accounting, prevention of double spend, predictable distribution schedule.

- Endless List — Paged list: https://github.com/xmakina/endless-list
  - Patterns: cursor-based pagination, stable ordering keys, bounds checking.
  - Study: efficient storage layout, page queries via read-only functions.

- Stacks Loans — Fixed-rate loans: https://github.com/richardmichel/stacks-loans
  - Patterns: principal/interest schedule, collateralization checks, liquidation thresholds, multi-party flows.
  - Study: interest accrual formulae with integer math, precise rounding, liquidation safety.

- Advent Calendar — Daily openables: https://github.com/friedger/clarity-advent-calendar
  - Patterns: time-gated actions, per-day content, community-contributed entries.
  - Study: defensively program date windows with burn-block-height, duplicate/open-once guards.

Tip: When reviewing these repos, focus on their state machines, error models, and testing approaches. Port patterns into your own modules with minimal coupling and clear interfaces.

## Oracle: Real-Time Prices (Pyth + Wormhole)

This pattern integrates Pyth Network price feeds into your Clarity contracts via the Stacks Pyth bridge. The flow is: off-chain pulls VAA messages from Hermes API, on-chain verifies and decodes via Wormhole + Pyth contracts, then your contracts read fresh prices from Pyth storage.

Key components (contract modules)
- .pyth-oracle-v4: Proxy entrypoint that verifies and updates price feeds, and provides read helpers.
- .pyth-governance-v3: Governance and allow-listing of data sources, fee settings, staleness threshold, and current execution plan.
- .pyth-traits-v2: Traits for decoder, storage, and proxy interfaces (types for price tuples, decoder output).
- .wormhole-traits-v2: Trait for Wormhole core verification (parse-and-verify-vaa).
- Storage and Decoder implementations: e.g., .pyth-storage-v4 and .pyth-pnau-decoder-v3 (referenced by governance execution plan).

What a “price” looks like
- Tuple fields: price int, conf uint, expo int, ema-price int, ema-conf uint, publish-time uint, prev-publish-time uint.
- Scaling: price is scaled by 10^expo (expo can be negative). No floats; do fixed-point arithmetic carefully.

Off-chain: Pull VAA from Hermes API
- Use the Hermes API (see blog link in Resources) to request VAA bytes for desired price feed IDs.
- Select ids for the feeds you need (e.g., BTC/USD). The endpoint returns VAA bytes (often base64). Your relayer converts them to a Clarity `buff` and submits an on-chain transaction.

On-chain: Verify and update price feeds

```clarity
;; Import traits for type safety (example references; use deployed contract identifiers)
(use-trait pyth-storage-trait .pyth-traits-v2.storage-trait)
(use-trait pyth-decoder-trait .pyth-traits-v2.decoder-trait)
(use-trait wormhole-core-trait .wormhole-traits-v2.core-trait)

;; Example: update prices by submitting VAA bytes
(define-public (update-pyth-prices (vaa (buff 8192)))
  (let ((plan {
            pyth-storage-contract: .pyth-storage-v4,
            pyth-decoder-contract: .pyth-pnau-decoder-v3,
            wormhole-core-contract: .wormhole-core-v4
          }))
    (contract-call? .pyth-oracle-v4 verify-and-update-price-feeds vaa plan)))
```

Notes
- The governance contract may charge a per-price update fee; the caller must have enough STX (see fee info in governance). The proxy charges `(len updated-prices) * fee`.
- Execution flow is enforced by governance; calls must match the current execution plan or they fail.
- Wormhole guardian set/signatures are verified in the Wormhole core contract via `parse-and-verify-vaa` during decoding.

Reading prices in your contract

```clarity
;; Read with built-in staleness check governed by .pyth-governance-v3
(define-read-only (get-pyth-price (feed (buff 32)))
  (contract-call? .pyth-oracle-v4 get-price feed .pyth-storage-v4))

;; Read without staleness check (raw latest stored)
(define-read-only (read-pyth-price (feed (buff 32)))
  (contract-call? .pyth-oracle-v4 read-price-feed feed .pyth-storage-v4))
```

Normalizing to fixed decimals (example)

```clarity
;; Return a tuple { scaled: int, expo: int, conf: uint } where `scaled` is price scaled to 6 decimals
(define-read-only (get-price-6 (feed (buff 32)))
  (let ((res (unwrap! (contract-call? .pyth-oracle-v4 get-price feed .pyth-storage-v4) (err u500))))
    (let ((p (get price res)) (e (get expo res)))
      ;; If expo = -8, price is scaled by 1e-8. To convert to 6 decimals: scaled = p * 10^(6 - (-e)) when (6 - (-e)) >= 0, else divide.
      ;; Keep arithmetic in ints; adjust exponent carefully to avoid overflow in real code.
      (ok { scaled: p, expo: e, conf: (get conf res) })
    )
  )
)
```

Best practices
- Always prefer `get-price` over raw reads; it enforces staleness via governance’s threshold.
- Treat `price` and `ema-price` separately; pick one consistently for your logic.
- Store feed IDs as constants and validate inputs.
- Budget for update fees; batch multiple feeds in a single VAA when possible to reduce costs.
- Emit events when your app consumes a new price version (include publish-time and sequence for traceability).

Operational checklist
- Off-chain relayer fetches VAAs from Hermes, submits `update-pyth-prices` on every new publish or at desired cadence.
- Monitor governance parameters (fee, staleness threshold, execution plan) for changes.
- Handle errors `(err u3xxx/u4xxx)` from governance/verification paths; retry with latest VAA if outdated.

## Project Architectures & Examples

The following sections outline contract structure, core storage, and example functions for each referenced project. Snippets are illustrative, designed to mirror the published APIs and patterns.

### Swapr (AMM DEX)

Core idea: Two-token constant-product market maker with LP shares and swap fees. API in repo README: `add-to-position`, `reduce-position`, `swap-x-for-y`, `swap-y-for-x`, `get-*`, fee collection.

- Storage layout
```clarity
(define-constant FEE_BPS u30)         ;; total fee in basis points (e.g., 30)
(define-data-var fee-to (optional principal) none)
(define-data-var x-reserve uint u0)
(define-data-var y-reserve uint u0)
(define-data-var total-shares uint u0) ;; LP supply
(define-map shares principal uint)     ;; LP balance per provider

;; External tokens (traits)
(use-trait ft .sip-010-trait-ft-standard.sip-010-trait)
(define-constant TOKEN-X 'SP... .token-x) ;; replace with actual contract
(define-constant TOKEN-Y 'SP... .token-y)
```

- Add liquidity (mint LP shares proportionally)
```clarity
(define-public (add-to-position (x uint) (y uint))
  (let (
    (x0 (var-get x-reserve))
    (y0 (var-get y-reserve))
    (t0 (var-get total-shares))
  )
    (begin
      (if (is-eq t0 u0)
        ;; First liquidity sets the ratio; mint sqrt(x*y) shares (approx via min)
        (let ((mint (min x y))) ;; simplified minting
          (try! (contract-call? TOKEN-X transfer x tx-sender contract-principal none))
          (try! (contract-call? TOKEN-Y transfer y tx-sender contract-principal none))
          (var-set x-reserve (+ x0 x))
          (var-set y-reserve (+ y0 y))
          (var-set total-shares mint)
          (map-set shares tx-sender mint)
          (ok mint)
        )
        ;; Subsequent liquidity must match price; mint t0 * min(x/x0, y/y0)
        (let ((mint (min (/ (* t0 x) x0) (/ (* t0 y) y0))))
          (asserts! (> mint u0) (err u100))
          (try! (contract-call? TOKEN-X transfer x tx-sender contract-principal none))
          (try! (contract-call? TOKEN-Y transfer y tx-sender contract-principal none))
          (var-set x-reserve (+ x0 x))
          (var-set y-reserve (+ y0 y))
          (var-set total-shares (+ t0 mint))
          (map-set shares tx-sender (+ (default-to u0 (map-get? shares tx-sender)) mint))
          (ok mint)
        )
      )
    )
  )
)
```

- Swap X for Y (constant product with fee)
```clarity
(define-private (out-amount (dx uint) (x0 uint) (y0 uint))
  (let ((fee-num (- u10000 FEE_BPS)) (fee-den u10000))
    ;; dy = (dx * fee * y0) / (x0*fee + dx*fee)
    (/ (* (/ (* dx fee-num) fee-den) y0) (+ x0 (/ (* dx fee-num) fee-den)))
  )
)

(define-public (swap-x-for-y (dx uint))
  (let ((x0 (var-get x-reserve)) (y0 (var-get y-reserve)))
    (begin
      (asserts! (> dx u0) (err u101))
      (let ((dy (out-amount dx x0 y0)))
        (asserts! (> dy u0) (err u102))
        ;; transfer in X, transfer out Y
        (try! (contract-call? TOKEN-X transfer dx tx-sender contract-principal none))
        (try! (contract-call? TOKEN-Y transfer dy contract-principal tx-sender none))
        (var-set x-reserve (+ x0 dx))
        (var-set y-reserve (- y0 dy))
        (ok dy)
      )
    )
  )
)
```

Notes
- Use post-conditions in the calling transaction to enforce min received (slippage bounds).
- Fees to operator can be accumulated by minting protocol shares on growth or via a separate “collect” map.

### Flexr (Elastic Supply Token)

Core idea: Rebasing token using a global index so user balances are `base * index`. Daily rebase uses oracle price versus target, applying a smoothing factor.

- Storage layout
```clarity
(define-data-var index uint u1000000000000)      ;; 1e12 scaling
(define-data-var base-supply uint u0)
(define-map base-balances principal uint)
(define-constant ONE u1000000000000)
(define-constant REBASE_PERIOD u144)             ;; ~1 day of Stacks blocks
(define-data-var last-rebase uint u0)
(define-constant TARGET_PRICE u1)                ;; $1 target (scaled externally)

(use-trait oracle .price-oracle.trait)
(define-constant ORACLE 'SP... .oracle)
```

- Balance view and transfer
```clarity
(define-read-only (balance-of (owner principal))
  (let ((base (default-to u0 (map-get? base-balances owner))) (idx (var-get index)))
    (/ (* base idx) ONE)
  )
)

(define-public (transfer (to principal) (amount uint))
  (let ((idx (var-get index))
        (base-amt (max u1 (/ (* amount ONE) idx))) )
    (let ((from-base (unwrap! (map-get? base-balances tx-sender) (err u404))))
      (asserts! (>= from-base base-amt) (err u402))
      (map-set base-balances tx-sender (- from-base base-amt))
      (map-set base-balances to (+ (default-to u0 (map-get? base-balances to)) base-amt))
      (ok true)
    )
  )
)
```

- Rebase (owner/governance-controlled)
```clarity
(define-public (rebase)
  (begin
    (asserts! (>= (- block-height (var-get last-rebase)) REBASE_PERIOD) (err u200))
    (let ((price (unwrap! (contract-call? ORACLE get-price) (err u500))))
      (let ((delta (/ (* (- price TARGET_PRICE) ONE) (max u1 TARGET_PRICE))) )
        ;; apply smoothing, e.g., 1/30th per rebase
        (let ((adj (/ delta u30)) (idx (var-get index)))
          (var-set index (max u1 (+ idx adj)))
          (var-set last-rebase block-height)
          (ok (var-get index))
        )
      )
    )
  )
)
```

Notes
- Transfers operate on base units to avoid touching all accounts during rebase.
- Emit events on rebase for indexers; cap extreme deltas.

### Stackstarter (Crowdfunding)

Core idea: Time-bounded contributions with softcap/hardcap, finalize or refund.

```clarity
(define-constant START u50000)
(define-constant END u60000)
(define-constant SOFTCAP u100000000)
(define-constant HARDCAP u200000000)
(define-data-var raised uint u0)
(define-map deposits principal uint)
(define-data-var finalized bool false)
(define-data-var success bool false)

(define-public (contribute (amount uint))
  (begin
    (asserts! (and (>= burn-block-height START) (< burn-block-height END)) (err u201))
    (asserts! (> amount u0) (err u101))
    (asserts! (<= (+ (var-get raised) amount) HARDCAP) (err u202))
    (try! (as-contract (stx-transfer? amount tx-sender contract-principal)))
    (map-set deposits tx-sender (+ (default-to u0 (map-get? deposits tx-sender)) amount))
    (var-set raised (+ (var-get raised) amount))
    (ok true)
  )
)

(define-public (finalize)
  (begin
    (asserts! (>= burn-block-height END) (err u203))
    (asserts! (not (var-get finalized)) (err u204))
    (var-set finalized true)
    (var-set success (>= (var-get raised) SOFTCAP))
    (ok (var-get success))
  )
)

(define-public (refund)
  (let ((amt (unwrap! (map-get? deposits tx-sender) (err u404))))
    (begin
      (asserts! (and (var-get finalized) (not (var-get success))) (err u205))
      (map-delete deposits tx-sender)
      (try! (as-contract (stx-transfer? amt contract-principal tx-sender)))
      (ok true)
    )
  )
)
```

### Marketplace (NFT + Bids + Escrow)

Core idea (from README): Marketplace `market.clar` with a `tradables-trait`; bid, accept, pay, and cancel. Contract acts as escrow.

```clarity
(define-trait tradables-trait
  ((owner-of (uint) (response (optional principal) uint))
   (transfer (uint principal) (response bool uint))))

(use-trait T .tradables.tradables-trait)

(define-map offers {c: principal, id: uint} {bidder: principal, price: uint, accepted: bool})

(define-public (bid (c <T>) (id uint) (price uint))
  (begin
    (asserts! (> price u0) (err u101))
    (map-set offers {c: (contract-of c), id: id} {bidder: tx-sender, price: price, accepted: false})
    (ok true)
  )
)

(define-public (accept (c <T>) (id uint))
  (let ((co (contract-of c))
        (owner (unwrap! (default-to none (ok (some tx-sender))) (err u500))))
    (begin
      (asserts! (is-eq (unwrap! (contract-call? c owner-of id) (err u501)) (some tx-sender)) (err u401))
      (let ((o (unwrap! (map-get? offers {c: co, id: id}) (err u404))))
        (try! (contract-call? c transfer id contract-principal))
        (map-set offers {c: co, id: id} {bidder: (get bidder o), price: (get price o), accepted: true})
        (ok true)
      )
    )
  )
)

(define-public (pay (c <T>) (id uint))
  (let ((o (unwrap! (map-get? offers {c: (contract-of c), id: id}) (err u404))))
    (begin
      (asserts! (is-eq tx-sender (get bidder o)) (err u401))
      (asserts! (get accepted o) (err u402))
      (try! (as-contract (stx-transfer? (get price o) tx-sender contract-caller)))
      (try! (contract-call? c transfer id tx-sender))
      (map-delete offers {c: (contract-of c), id: id})
      (ok true)
    )
  )
)
```

### Blind Poll (Commit–Reveal)

```clarity
(define-constant COMMIT_END (+ burn-block-height u100))
(define-constant REVEAL_END (+ COMMIT_END u50))
(define-map commits principal (buff 32))
(define-map tallies uint uint)

(define-public (commit (hash (buff 32)))
  (begin
    (asserts! (< burn-block-height COMMIT_END) (err u200))
    (map-set commits tx-sender hash)
    (ok true)
  )
)

(define-public (reveal (choice uint) (salt (buff 16)))
  (begin
    (asserts! (and (>= burn-block-height COMMIT_END) (< burn-block-height REVEAL_END)) (err u201))
    (let ((h (unwrap! (map-get? commits tx-sender) (err u404))))
      (asserts! (is-eq h (sha256 (concat (to-buff choice) salt))) (err u402))
      (map-set tallies choice (+ (default-to u0 (map-get? tallies choice)) u1))
      (map-delete commits tx-sender)
      (ok true)
    )
  )
)
```

### Highscore (Leaderboard)

```clarity
(define-data-var best-score uint u0)
(define-data-var best-player (optional principal) none)

(define-public (submit-score (score uint))
  (begin
    (asserts! (> score u0) (err u101))
    (if (> score (var-get best-score))
      (begin (var-set best-score score) (var-set best-player (some tx-sender)) (ok true))
      (ok false))
  )
)
```

### Redistribution (Treasury)

```clarity
(define-map weights principal uint)
(define-data-var pot uint u0)

(define-public (donate (amount uint))
  (begin
    (try! (as-contract (stx-transfer? amount tx-sender contract-principal)))
    (var-set pot (+ (var-get pot) amount))
    (ok true)
  )
)

(define-public (claim)
  (let ((w (unwrap! (map-get? weights tx-sender) (err u404)))
        (total u1000000)) ;; sum of all weights, maintain separately
    (let ((share (/ (* (var-get pot) w) total)))
      (var-set pot (- (var-get pot) share))
      (try! (as-contract (stx-transfer? share contract-principal tx-sender)))
      (ok share)
    )
  )
)
```

### Endless List (Pagination)

```clarity
(define-data-var last-id uint u0)
(define-map items uint {next: (optional uint), data: (string-ascii 64)})

(define-public (append (data (string-ascii 64)))
  (let ((id (+ (var-get last-id) u1)))
    (begin
      (map-set items id {next: none, data: data})
      (when (> id u1)
        (map-set items (- id u1) {next: (some id), data: (get data (unwrap-panic (map-get? items (- id u1))))}))
      (var-set last-id id)
      (ok id)
    )
  )
)

(define-read-only (get-page (start uint) (limit uint))
  (let ((acc (list)) (cur (some start)) (i u0))
    ;; return up to limit entries, following next pointers
    acc
  )
)
```

### Stacks Loans (Fixed Rate)

```clarity
(define-map loans uint {borrower: principal, principal: uint, rate-bps: uint, start: uint, due: uint, collateral: uint, repaid: bool})
(define-data-var next-loan-id uint u0)

(define-read-only (due-amount (id uint))
  (let ((l (unwrap! (map-get? loans id) (err u404)))
        (elapsed (- burn-block-height (get start l))))
    (ok (+ (get principal l) (/ (* (get principal l) (get rate-bps l) elapsed) u10000)))
  )
)
```

### Advent Calendar (Time-Gated)

```clarity
(define-constant START u50000)
(define-data-var opened (map uint bool) {})

(define-public (open (day uint))
  (begin
    (asserts! (>= burn-block-height (+ START day)) (err u200))
    (asserts! (is-none (map-get? opened day)) (err u201))
    (map-set opened day true)
    (print {type: "open", day: day, who: tx-sender})
    (ok true)
  )
)
```

## Domain Playbooks (Patterns You Can Reuse)

These distilled patterns are battle-tested across the repositories above.

- DEX/AMM Liquidity Pools
  - State: reserves for token A/B, LP total supply, fee bps.
  - Invariants: k = x*y with fee; assert invariant non-decreasing on trades.
  - Safety: slippage bounds via input/output min, post-conditions for received tokens.
  - Tests: rounding at extreme ratios, adding/removing tiny liquidity, symmetric add/remove.

- Rebasing/Elastic Tokens
  - State: global index, base balances, total base supply.
  - Operations: rebase by adjusting index; user balance = base * index.
  - Safety: freeze rebase during transfers, emit events, cap max rebase delta.
  - Tests: multiple sequential rebases, zero holders edge cases, mint/burn around rebase.

- Crowdfunding/Presales
  - State: start/end blocks, soft/hard caps, per-user contributions, finalized/refunded flags.
  - Flows: contribute → finalize if ≥ softcap → claim token; else refunds.
  - Safety: time and cap assertions; idempotent finalize/refund; check-effects-interactions.
  - Tests: boundary blocks, exact cap hits, double-claim/refund prevention.

- NFT + Marketplace
  - State: listing map {id → price, seller, expiry}, bids map, fees/royalties.
  - Flows: list → buy/accept → settle: transfer NFT, fees, royalties.
  - Safety: trait assertions, ownership checks, disable flags, escrow vs. non-custodial designs.
  - Tests: cancelled listings, expired bids, partial payments, royalty splits.

- Commit–Reveal Voting/Polls
  - State: commit phase end, reveal phase end, commitments {addr → hash}, tallies.
  - Flows: commit(hash) → reveal(choice, salt) → finalize tally.
  - Safety: strict windows, ignore non-revealed, one-commit-per-user.
  - Tests: same-salt collisions, early/late actions, edge cases per phase.

- Treasury/Redistribution
  - State: pot balance, participants set, weights, last distribution block.
  - Flows: deposit → schedule → claim share or batched distribution.
  - Safety: prevent repeated claims per epoch, rounding remainders management.
  - Tests: varying weights, zero participants, precision checks.

- Fixed-Rate Loans
  - State: principal, rate (bps), start block, due block, collateral, status.
  - Flows: open → repay or liquidate after delinquency.
  - Safety: collateral checks, liquidation guards, integer accrual verified with tests.
  - Tests: accrual over long periods, partial repayments, liquidation thresholds.

## Error Codes and Event Conventions

Standardize for readability and tooling.

- Error codes
  - Use grouped ranges: u1xx auth/input, u2xx state, u3xx external, u4xx not-found.
  - Example: `ERR-UNAUTHORIZED u100`, `ERR-INVALID-INPUT u101`, `ERR-NOT-ACTIVE u200`.

- Events (print)
  - Use tuples with type field and minimal payload for indexers.
  - Examples:
    - `{type: "swap", a-in: ..., b-out: ..., who: ...}`
    - `{type: "list", id: ..., price: ..., seller: ...}`
    - `{type: "vote-commit", poll: ..., who: ...}`

## Review Checklist (Before Deploy)

- Responses: all public functions return `(response ...)` and use `try!` appropriately.
- Authorization: consistent `tx-sender` vs `contract-caller` checks; admin gates isolated.
- Time logic: all windows based on `burn-block-height` with clear boundaries.
- Math: no unchecked division; scale factors documented; caps and under/overflows asserted.
- Invariants: documented and asserted where feasible (e.g., pool k invariant, cap totals).
- Idempotency: repeated calls to finalize/claim/refund are safe and predictable.
- Traits: verify expected contracts via `(contract-of ...)` and explicit `use-trait` types.
- Events: important state transitions emit `(print ...)` with stable schemas.
- Tests: edge cases and negative paths covered; deterministic expectations.


## Quick Reference Card

| Operation | Syntax |
|-----------|--------|
| Define constant | `(define-constant NAME value)` |
| Define variable | `(define-data-var name type initial)` |
| Read variable | `(var-get name)` |
| Write variable | `(var-set name value)` |
| Define map | `(define-map name key-type value-type)` |
| Read map | `(map-get? name key)` |
| Write map | `(map-set name key value)` |
| Delete from map | `(map-delete name key)` |
| Define trait | `(define-trait name (...))` |
| Implement trait | `(impl-trait .contract.trait-name)` |
| Use trait | `(use-trait alias .contract.trait-name)` |
| Public function | `(define-public (name (arg type)) body)` |
| Read-only function | `(define-read-only (name) body)` |
| Private function | `(define-private (name) body)` |
| Assert | `(asserts! condition error)` |
| Try | `(try! expression)` |
| Unwrap | `(unwrap! optional default-err)` |
| Unwrap panic | `(unwrap-panic optional)` |
| Default to | `(default-to default optional)` |
| Return ok | `(ok value)` |
| Return error | `(err value)` |
| Let binding | `(let ((var1 val1) (var2 val2)) body)` |
| Begin block | `(begin expr1 expr2 expr3)` |
| If statement | `(if condition true-expr false-expr)` |
| Match | `(match opt value-name expr none-expr)` |
| Contract call | `(contract-call? .contract func args)` |
| As contract | `(as-contract expression)` |
| Contract of | `(contract-of trait-value)` |
| STX transfer | `(stx-transfer? amount from to)` |
| FT mint | `(ft-mint? token amount recipient)` |
| FT burn | `(ft-burn? token amount sender)` |
| FT transfer | `(ft-transfer? token amount from to)` |
| Print event | `(print data)` |
| Map | `(map function list)` |
| Fold | `(fold function list initial)` |
| Filter | `(filter function list)` |

## AI Assistant Notes

When working with Clarity contracts:

1. **Always use `u` prefix for unsigned integers**: `u100`, not `100`
2. **Public functions must return `(response ok-type err-type)`**
3. **Use `burn-block-height` for timing, not `block-height`**
4. **Check trait contracts**: `(asserts! (is-eq (contract-of token-trait) EXPECTED))`
5. **Use precision factors for division**: `(/ (* amount rate) ONE_6)`
6. **Validate inputs thoroughly**: Check ranges, zero values, authorization
7. **Use `try!` to propagate errors**: Don't ignore response types
8. **Test edge cases**: u0, max uint, boundaries, timing
9. **Events for tracking**: Use `(print {...})` for important state changes
10. **Atomicity**: All operations succeed or all fail - use this wisely

---

**Remember**: Clarity prioritizes safety and predictability over flexibility. Embrace the constraints—they're designed to protect users and make your contracts more secure!
