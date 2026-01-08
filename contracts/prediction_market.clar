;; sBTC Prediction Market - Complete Set AMM
;; Implements zero-capital market creation, complete-set mint/burn,
;; constant-product swaps, oracle resolution (Pyth v4), and redemption.
;;
;; ARCHITECTURE OVERVIEW:
;; This contract implements a binary outcome prediction market using two parallel systems:
;;
;; UNITS: All amounts are denominated in SATS (satoshis)
;;   - 1 sBTC = 100,000,000 sats (8 decimals)
;;   - 1 share = 1 sat (share pegged to smallest unit)
;;   - Example: 10,000 sats = 0.0001 sBTC = ~$11 at $110k BTC
;;
;; 1. SHARE ISSUANCE SYSTEM (Real Ownership):
;;    - Tracks shares from complete set minting (yes-issued, no-issued)
;;    - Backed 1:1 by sBTC collateral in the vault
;;    - Complete sets (1 YES + 1 NO) can be minted for 1 sat or burned to redeem 1 sat
;;    - NOTE: Actual circulating shares can exceed yes-issued/no-issued due to swaps!
;;
;; 2. VIRTUAL RESERVE SYSTEM (Pricing Mechanism):
;;    - Uses constant-product AMM formula (price-yes * price-no = k)
;;    - Reserves start at virtual-liquidity parameter (e.g., 10,000,000 sats)
;;    - Reserves change with swaps to reflect market sentiment
;;    - Reserves != issued shares (this is intentional!)
;;
;; KEY INSIGHT: Reserves can be much larger than issued shares because they're a pricing
;; oracle, not a custody mechanism. This enables zero-capital market creation.
;;
;; !!! CRITICAL SECURITY WARNING - OVER-ISSUANCE RISK !!!
;; The swap-shares function can create MORE total shares than vault collateral!
;; This happens when swapping from scarce to abundant side via AMM pricing.
;;
;; Example:
;;   User swaps 1,000 YES -> receives 1,215 NO (net +215 shares)
;;   Vault stays same, but total circulating shares increased by 215!
;;
;; Consequence:
;;   Redemption uses PROPORTIONAL payout: (user_shares / total_circulating) * vault
;;   If total_circulating > vault, users get < 1 sat per share on redemption
;;   Example: 60k shares, 30k vault = 0.5 sats per share redemption ratio
;;
;; Mitigation:
;;   - Proportional redemption ensures fairness (everyone gets same ratio)
;;   - No "race to withdraw" - order doesn't matter
;;   - Users should monitor redemption ratio before resolution
;;
;; See redeem-shares and get-redemption-info for more details.

(use-trait pyth-storage-trait .pyth-traits-v2.storage-trait)
(use-trait pyth-decoder-trait .pyth-traits-v2.decoder-trait)
(use-trait wormhole-core-trait .wormhole-traits-v2.core-trait)

;; Fee denominator for basis point calculations (10000 = 100%)
;; Example: fee-bps of 30 = 30/10000 = 0.3% fee
(define-constant FEE-DENOMINATOR u10000)

;; Tax Configuration (1% tax on buy-shares and sell-shares)
(define-constant TAX-RATE u100) ;; 1% = 100/10000
(define-data-var tax-recipient principal 'ST5X3MK1FVHW52WRZN720041Y138263QSS9NR9AE)

;; Error codes
(define-constant ERR-NO-MARKET u1000)           ;; Market ID doesn't exist
(define-constant ERR-RESOLVED u1001)            ;; Market already resolved, can't trade
(define-constant ERR-TOO-EARLY u1002)           ;; Resolution block not reached yet
(define-constant ERR-NOTHING-TO-REDEEM u1003)   ;; No winning shares to redeem
(define-constant ERR-ZERO-AMOUNT u1004)         ;; Amount must be > 0
(define-constant ERR-INSUFFICIENT-BALANCE u1005);; User doesn't have enough shares
(define-constant ERR-INVALID-FEE u1006)         ;; Fee must be < 100%
(define-constant ERR-INVALID-V-LIQUIDITY u1007) ;; Virtual liquidity/reserve issue
(define-constant ERR-NOT-RESOLVED u1008)        ;; Market not resolved yet
(define-constant ERR-INVALID-COMPARISON u1009)  ;; Invalid comparison operator
(define-constant ERR-UNAUTHORIZED u1010)        ;; Not authorized for this action
(define-constant ERR-NOT-MARKET-CREATOR u1011)  ;; Caller is not an authorized market creator
(define-constant ERR-MARKET-CANCELLED u1012)    ;; Market has been cancelled
(define-constant ERR-NOT-CANCELLED u1013)       ;; Market is not cancelled
(define-constant ERR-TOO-LATE u1014)            ;; Resolution window has passed

;; Cancellation timeout: blocks to wait after resolution-block before allowing cancellation
;; Resolution window is 2 blocks (resolution-block to resolution-block + 1)
;; Setting to u2 means cancellation is available immediately after the window closes
;; Example: resolution-block = 98610, window = 98610-98611, can cancel at 98612
(define-constant CANCEL-TIMEOUT-BLOCKS u2)

(define-private (ensure
    (condition bool)
    (error-code uint)
  )
  (if condition
    (ok true)
    (err error-code)
  )
)

;; ====================================================================================
;; DATA STRUCTURES
;; ====================================================================================

;; Markets map: Stores all market metadata and state
(define-map markets
  { id: uint }
  {
    ;; Market definition
    question: (string-utf8 256),         ;; Market question/description
    resolution-block: uint,              ;; Bitcoin block height when resolution is allowed
    threshold-feed-id: (buff 32),        ;; Pyth price feed ID (e.g., BTC/USD)
    threshold-price: int,                ;; Threshold price for comparison (with expo scaling)
    comparison-type: (string-utf8 2),    ;; "GE", "GT", "LE", "LT", or "EQ"

    ;; SHARE ISSUANCE (Real ownership - backed by vault-sbtc)
    vault-sbtc: uint,                    ;; Total sBTC collateral locked in vault (in sats)
    yes-issued: uint,                    ;; Total YES shares from complete sets minted
    no-issued: uint,                     ;; Total NO shares from complete sets minted
    yes-circulating: uint,               ;; Total YES shares across ALL users (tracks swaps too)
    no-circulating: uint,                ;; Total NO shares across ALL users (tracks swaps too)
    ;; yes-issued/no-issued count only complete-set mint/burn activity — they ignore swaps and post-resolution burns
    ;; yes-circulating/no-circulating include every share minted or burned through swaps, redemptions, and refunds
    ;; Complete-set flows keep vault-sbtc, yes-issued, and no-issued aligned; redemption/refund flows intentionally decouple them
    ;; Redemption uses circulating counts for proportional payouts

    ;; VIRTUAL RESERVES (Pricing mechanism - NOT backed by collateral)
    price-yes: uint,                     ;; Virtual YES reserve for AMM pricing
    price-no: uint,                      ;; Virtual NO reserve for AMM pricing
    ;; Invariant: price-yes * price-no ~= k (constant product, adjusted by swaps)
    ;; Note: These can be much larger or smaller than yes-issued/no-issued!
    ;; Example: price-yes could be 90,116 while yes-issued is only 12,000

    virtual-liquidity: uint,             ;; Initial reserve value (stored for reference)

    ;; Fee tracking
    fee-bps: uint,                       ;; Trading fee in basis points (e.g., 30 = 0.3%)
    fees-yes: uint,                      ;; Cumulative YES shares collected as fees
    fees-no: uint,                       ;; Cumulative NO shares collected as fees

    ;; Resolution state
    resolved: bool,                      ;; Has the market been resolved?
    outcome: (optional bool),            ;; Winner: true = YES won, false = NO won
    cancelled: bool,                     ;; Has the market been cancelled (cannot resolve)?
  }
)

;; User balances: Tracks individual share ownership
;; Collateral originates from complete sets, but swaps can over-issue supply so totals may exceed vault-sbtc
;; Changed by:
;;   - mint-complete-set: increases both YES and NO for user
;;   - burn-complete-set: decreases both YES and NO for user
;;   - swap-shares: burns one side, mints the other side
(define-map balances
  {
    market-id: uint,
    user: principal,
    side: bool,           ;; true = YES shares, false = NO shares
  }
  uint                    ;; Number of shares owned
)

;; Authorized market creators: Only these principals can create markets
;; Key: principal, Value: true if authorized, false/none if not
(define-map market-creators principal bool)

;; Global state variables
(define-data-var next-market-id uint u1)              ;; Auto-incrementing market ID counter
(define-data-var protocol-treasury principal tx-sender) ;; Receives trading fees
(define-data-var contract-owner principal tx-sender)  ;; Contract owner (can manage market creators)

;; ====================================================================================
;; HELPER FUNCTIONS
;; ====================================================================================

;; Check if a principal is an authorized market creator
;; Returns true if principal is in market-creators map OR is the contract owner
(define-read-only (is-market-creator (who principal))
  (or
    (is-eq who (var-get contract-owner))
    (default-to false (map-get? market-creators who))
  )
)

;; Get next market ID and increment counter (private)
(define-private (claim-market-id)
  (let ((id (var-get next-market-id)))
    (var-set next-market-id (+ id u1))
    id
  )
)

;; Get this contract's principal address (used for vault custody)
(define-read-only (get-contract-principal)
  (as-contract tx-sender)
)

;; Fetch market data from storage (private helper)
(define-private (fetch-market (market-id uint))
  (match (map-get? markets { id: market-id })
    market (ok market)
    (err ERR-NO-MARKET)
  )
)

;; Public read-only function to get market data
(define-read-only (get-market (market-id uint))
  (fetch-market market-id)
)

;; Get user's balance for a specific side of a market
(define-read-only (get-balance
    (market-id uint)
    (user principal)
    (side bool)
  )
  (ok (default-to u0
    (map-get? balances {
      market-id: market-id,
      user: user,
      side: side,
    })
  ))
)

;; Validate comparison operator is one of: GE, GT, LE, LT, EQ
(define-private (valid-comparison? (comp (string-utf8 2)))
  (or
    (is-eq comp u"GE")
    (or
      (is-eq comp u"GT")
      (or
        (is-eq comp u"LE")
        (or
          (is-eq comp u"LT")
          (is-eq comp u"EQ")
        )
      )
    )
  )
)

;; Evaluate comparison for resolution (used by resolve-market)
;; Example: If comp="GE", threshold=100000, and price=110000, returns true (YES wins)
(define-private (evaluate-comparison
    (comp (string-utf8 2))
    (price int)
    (threshold int)
  )
  (if (is-eq comp u"GE")
    (>= price threshold)
    (if (is-eq comp u"GT")
      (> price threshold)
      (if (is-eq comp u"LE")
        (<= price threshold)
        (if (is-eq comp u"LT")
          (< price threshold)
          (if (is-eq comp u"EQ")
            (is-eq price threshold)
            false
          )
        )
      )
    )
  )
)

;; Ensure value is greater than zero
(define-private (ensure-positive (value uint))
  (ensure (> value u0) ERR-ZERO-AMOUNT)
)

;; Validate market invariants after state changes
;; CRITICAL INVARIANTS:
;;   1. yes-issued == no-issued (complete sets are always minted/burned in pairs)
;;   2. vault-sbtc == yes-issued == no-issued (1:1 collateral backing for issued shares)
(define-private (validate-market-invariants (market {
  question: (string-utf8 256),
  resolution-block: uint,
  threshold-feed-id: (buff 32),
  threshold-price: int,
  comparison-type: (string-utf8 2),
  vault-sbtc: uint,
  yes-issued: uint,
  no-issued: uint,
  yes-circulating: uint,
  no-circulating: uint,
  price-yes: uint,
  price-no: uint,
  virtual-liquidity: uint,
  fee-bps: uint,
  fees-yes: uint,
  fees-no: uint,
  resolved: bool,
  outcome: (optional bool),
  cancelled: bool,
}))
  (begin
    ;; Invariant 1: yes-issued must equal no-issued (complete sets are symmetric)
    (try! (ensure (is-eq (get yes-issued market) (get no-issued market)) ERR-INVALID-V-LIQUIDITY))
    ;; Invariant 2: vault-sbtc must equal yes-issued (and no-issued by transitivity)
    (try! (ensure (is-eq (get vault-sbtc market) (get yes-issued market)) ERR-INVALID-V-LIQUIDITY))
    (ok true)
  )
)

;; Require market exists, is unresolved, and not cancelled (can trade)
(define-private (require-market-open (market-id uint))
  (let ((market (try! (fetch-market market-id))))
    (try! (ensure-open market))
    (ok market)
  )
)

;; Require market exists and IS resolved (can redeem)
(define-private (require-resolved-market (market-id uint))
  (let ((market (try! (fetch-market market-id))))
    (try! (ensure (get resolved market) ERR-NOT-RESOLVED))
    (ok market)
  )
)

;; Helper function to calculate tax amount (rounded down to nearest sat)
(define-private (calculate-tax (amount uint))
  (/ (* amount TAX-RATE) FEE-DENOMINATOR)
)

;; Transfer sBTC from user to vault (increases vault custody)
(define-private (vault-deposit (amount uint))
  (contract-call? .sbtc-token transfer amount tx-sender (get-contract-principal) none)
)

;; Transfer sBTC from vault to user (decreases vault custody)
;; Validates contract has sufficient sBTC balance before withdrawal
(define-private (vault-withdraw (amount uint) (recipient principal))
  (let ((contract-balance (unwrap! (contract-call? .sbtc-token get-balance (get-contract-principal)) (err ERR-INSUFFICIENT-BALANCE))))
    ;; Ensure contract has enough sBTC to fulfill withdrawal
    (try! (ensure (>= contract-balance amount) ERR-INSUFFICIENT-BALANCE))
    (as-contract (contract-call? .sbtc-token transfer amount (get-contract-principal) recipient none))
  )
)

;; Check user has sufficient balance on given side
(define-private (ensure-sufficient-balance
    (market-id uint)
    (user principal)
    (side bool)
    (amount uint)
  )
  (let ((balance (default-to u0
      (map-get? balances {
        market-id: market-id,
        user: user,
        side: side,
      })
    )))
    (try! (ensure (>= balance amount) ERR-INSUFFICIENT-BALANCE))
    (ok balance)
  )
)

;; Check user has complete sets (both YES and NO shares >= amount)
(define-private (ensure-complete-set-holdings (market-id uint) (user principal) (amount uint))
  (let ((yes-bal (try! (ensure-sufficient-balance market-id user true amount)))
        (no-bal (try! (ensure-sufficient-balance market-id user false amount))))
    (ok (tuple (yes yes-bal) (no no-bal)))
  )
)

;; Return minimum of two uints
(define-private (min-uint (a uint) (b uint))
  (if (< a b) a b)
)

;; ====================================================================================
;; COMPLETE SET OPERATIONS
;; ====================================================================================
;; Complete sets are the foundation of this market: 1 YES + 1 NO = 1 sBTC worth of value
;; Users can always mint/burn complete sets at 1:1 ratio, providing implicit liquidity

;; Issue complete set to recipient (private helper)
;; Gives user equal amounts of YES and NO shares
;; Caller must handle vault deposit and market state updates
(define-private (issue-complete-set (market-id uint) (recipient principal) (amount uint))
  (let (
      (yes-balance (mint-shares market-id recipient true amount))   ;; Mint YES shares
      (no-balance (mint-shares market-id recipient false amount))   ;; Mint NO shares
    )
    true
  )
)

;; Burn complete set from owner (private helper)
;; Removes equal amounts of YES and NO shares from user
;; Caller must handle vault withdrawal and market state updates
(define-private (burn-complete-set-from (market-id uint) (owner principal) (amount uint))
  (begin
    (try! (burn-shares market-id owner true amount))   ;; Burn YES shares
    (try! (burn-shares market-id owner false amount))  ;; Burn NO shares
    (ok true)
  )
)

;; ====================================================================================
;; AMM PRICING LOGIC
;; ====================================================================================

;; Calculate output amount for constant-product AMM swap
;; Formula: x * y = k (constant product)
;;   - reserve-from increases by amount-in
;;   - reserve-to decreases by amount-out
;;   - Product remains approximately constant
;;
;; Example:
;;   reserve-from = 90,116 (YES)
;;   reserve-to = 110,967 (NO)
;;   amount-in = 1,000 (adding 1000 to YES reserve)
;;
;;   k = 90,116 * 110,967 = ~10 billion
;;   new-from = 90,116 + 1,000 = 91,116
;;   new-to = 10 billion / 91,116 = 109,752
;;   amount-out = 110,967 - 109,752 = 1,215 NO shares
;;
;; Note: You get MORE out than you put in when swapping from scarce to abundant side
(define-private (calculate-amount-out
    (reserve-from uint)
    (reserve-to uint)
    (amount-in uint)
  )
  (begin
    (try! (ensure (> reserve-from u0) ERR-INVALID-V-LIQUIDITY))
    (try! (ensure (> reserve-to u0) ERR-INVALID-V-LIQUIDITY))
    (try! (ensure (> amount-in u0) ERR-ZERO-AMOUNT))

    ;; Prevent overflow in multiplication
    (let ((product (mul-down reserve-from reserve-to))
          (new-from (+ reserve-from amount-in)))
      ;; Ensure new-from doesn't overflow
      (try! (ensure (>= new-from reserve-from) ERR-INVALID-V-LIQUIDITY))

      (let ((new-to (/ product new-from)))
        ;; Ensure reserve doesn't go negative (can approach but never reach 0)
        (try! (ensure (< new-to reserve-to) ERR-INVALID-V-LIQUIDITY))
        (ok (- reserve-to new-to))
      )
    )
  )
)

;; Safe multiplication helper (returns product or max uint on overflow)
(define-private (mul-down (a uint) (b uint))
  (let ((product (* a b)))
    ;; Check for overflow: if product / a != b, then overflow occurred
    (if (or (is-eq a u0) (is-eq (/ product a) b))
      product
      u340282366920938463463374607431768211455  ;; max uint128
    )
  )
)

;; ====================================================================================
;; SHARE BALANCE MANAGEMENT
;; ====================================================================================

;; Mint shares to recipient (increases balance AND circulating count)
;; This is the ONLY way to create new shares
;; Does NOT affect virtual reserves (those are updated separately in swap-shares)
(define-private (mint-shares
    (market-id uint)
    (recipient principal)
    (side bool)
    (amount uint)
  )
  (let ((current (default-to u0
      (map-get? balances {
        market-id: market-id,
        user: recipient,
        side: side,
      })
    )))
    (if (is-eq amount u0)
      current
      (begin
        ;; Update user balance
        (let ((next (+ current amount)))
          (map-set balances {
            market-id: market-id,
            user: recipient,
            side: side,
          } next)

          ;; Update circulating count
          (match (map-get? markets { id: market-id })
            market
              (begin
                (map-set markets { id: market-id }
                  (merge market {
                    yes-circulating: (if side
                      (+ (get yes-circulating market) amount)
                      (get yes-circulating market)),
                    no-circulating: (if (not side)
                      (+ (get no-circulating market) amount)
                      (get no-circulating market)),
                  })
                )
                next
              )
            next  ;; Market not found, just return next (shouldn't happen)
          )
        )
      )
    )
  )
)

;; Burn shares from owner (decreases balance AND circulating count)
;; This is the ONLY way to destroy shares
;; Does NOT affect virtual reserves (those are updated separately in swap-shares)
(define-private (burn-shares
    (market-id uint)
    (owner principal)
    (side bool)
    (amount uint)
  )
  (let ((current (default-to u0
      (map-get? balances {
        market-id: market-id,
        user: owner,
        side: side,
      })
    )))
    (if (is-eq amount u0)
      (ok current)
      (if (>= current amount)
        (begin
          ;; Update user balance
          (map-set balances {
            market-id: market-id,
            user: owner,
            side: side,
          } (- current amount))

          ;; Update circulating count
          (match (map-get? markets { id: market-id })
            market
              (let ((current-yes-circ (get yes-circulating market))
                    (current-no-circ (get no-circulating market)))
                ;; Ensure we don't underflow circulating counts
                (let ((new-yes-circ (if (and side (>= current-yes-circ amount))
                        (- current-yes-circ amount)
                        current-yes-circ))
                      (new-no-circ (if (and (not side) (>= current-no-circ amount))
                        (- current-no-circ amount)
                        current-no-circ)))
                  (map-set markets { id: market-id }
                    (merge market {
                      yes-circulating: new-yes-circ,
                      no-circulating: new-no-circ,
                    })
                  )
                  (ok (- current amount))
                )
              )
            (ok (- current amount))  ;; Market not found, just return (shouldn't happen)
          )
        )
        (err ERR-INSUFFICIENT-BALANCE)
      )
    )
  )
)

;; Check if market is open for trading (not resolved and not cancelled)
(define-private (ensure-open (market {
  question: (string-utf8 256),
  resolution-block: uint,
  threshold-feed-id: (buff 32),
  threshold-price: int,
  comparison-type: (string-utf8 2),
  vault-sbtc: uint,
  yes-issued: uint,
  no-issued: uint,
  yes-circulating: uint,
  no-circulating: uint,
  price-yes: uint,
  price-no: uint,
  virtual-liquidity: uint,
  fee-bps: uint,
  fees-yes: uint,
  fees-no: uint,
  resolved: bool,
  outcome: (optional bool),
  cancelled: bool,
}))
  (begin
    (if (get resolved market)
      (err ERR-RESOLVED)
      (if (get cancelled market)
        (err ERR-MARKET-CANCELLED)
        (ok true)
      )
    )
  )
)

;; ====================================================================================
;; PUBLIC FUNCTIONS - MARKET LIFECYCLE
;; ====================================================================================

;; Create a new prediction market with zero capital
;; Sets up virtual reserves for AMM pricing without requiring liquidity deposit
;; Market starts at 50/50 odds (price-yes = price-no = virtual-liquidity)
;;
;; Parameters:
;;   question: Market question (e.g., "Will BTC be above $100k by Dec 31?")
;;   resolution-block: Bitcoin block height when resolution is allowed
;;   feed-id: Pyth price feed ID (32 bytes, e.g., BTC/USD feed)
;;   threshold-price: Price threshold (with Pyth expo scaling, e.g., 100000 * 10^8)
;;   virtual-liquidity: Initial reserve size (e.g., 100000 = lower slippage)
;;   fee-bps: Trading fee in basis points (e.g., 30 = 0.3%)
;;   comparison-type: "GE", "GT", "LE", "LT", or "EQ"
(define-public (create-market
    (question (string-utf8 256))
    (resolution-block uint)
    (feed-id (buff 32))
    (threshold-price int)
    (virtual-liquidity uint)
    (fee-bps uint)
    (comparison-type (string-utf8 2))
  )
  (begin
    ;; AUTHORIZATION CHECK: Only authorized market creators can create markets
    (try! (ensure (is-market-creator tx-sender) ERR-NOT-MARKET-CREATOR))

    (try! (if (> (len question) u0)
      (ok true)
      (err ERR-ZERO-AMOUNT)
    ))
    (try! (if (> virtual-liquidity u0)
      (ok true)
      (err ERR-INVALID-V-LIQUIDITY)
    ))
    (try! (if (< fee-bps FEE-DENOMINATOR)
      (ok true)
      (err ERR-INVALID-FEE)
    ))
    (try! (if (> resolution-block burn-block-height)
      (ok true)
      (err ERR-TOO-EARLY)
    ))
    (try! (ensure (valid-comparison? comparison-type) ERR-INVALID-COMPARISON))
    (let ((id (claim-market-id)))
      (map-set markets { id: id } {
        question: question,
        resolution-block: resolution-block,
        threshold-feed-id: feed-id,
        threshold-price: threshold-price,
        comparison-type: comparison-type,
        vault-sbtc: u0,                 ;; No collateral yet
        yes-issued: u0,                 ;; No complete sets minted yet
        no-issued: u0,                  ;; No complete sets minted yet
        yes-circulating: u0,            ;; No shares circulating yet
        no-circulating: u0,             ;; No shares circulating yet
        price-yes: virtual-liquidity,   ;; Virtual reserve starts at 50%
        price-no: virtual-liquidity,    ;; Virtual reserve starts at 50%
        virtual-liquidity: virtual-liquidity,
        fee-bps: fee-bps,
        fees-yes: u0,
        fees-no: u0,
        resolved: false,
        outcome: none,
        cancelled: false,               ;; Not cancelled
      })
      (let ((market-created-details {
        event: "market-created",
        market-id: id,
        question: question,
        resolution-block: resolution-block,
        virtual-liquidity: virtual-liquidity,
        fee-bps: fee-bps,
        creator: tx-sender,
      }))
        (print market-created-details)
        (ok market-created-details)
      )
    )
  )
)

;; ====================================================================================
;; COMPLETE SET TRADING (Direct mint/burn)
;; ====================================================================================

;; Mint complete set: Exchange sBTC for equal YES + NO shares
;; This is primarily used by:
;;   - Arbitrageurs (when YES + NO price > 1 sBTC)
;;   - Market makers (to provide liquidity on both sides)
;;   - buy-shares function (as part of the mint+swap pattern)
;;
;; Economic effect:
;;   - Deposits sBTC into vault
;;   - Creates new YES and NO shares (increases yes-issued and no-issued)
;;   - Does NOT affect virtual reserves (reserves are for pricing only)
;;
;; Example: mint-complete-set(1000) with 12,000 existing:
;;   Before: vault=12000, yes-issued=12000, no-issued=12000
;;   After:  vault=13000, yes-issued=13000, no-issued=13000
;;   Reserves unchanged!
(define-public (mint-complete-set
    (market-id uint)
    (amount uint)
  )
  (begin
    (try! (ensure-positive amount))
    (let ((market (try! (require-market-open market-id))))
      (try! (vault-deposit amount))
      (issue-complete-set market-id tx-sender amount)

      ;; Re-fetch market after minting so we preserve fresh circulating counts
      (let ((latest (unwrap! (map-get? markets { id: market-id }) (err ERR-NO-MARKET))))
        (let ((updated-market (merge latest {
            vault-sbtc: (+ (get vault-sbtc latest) amount),
            yes-issued: (+ (get yes-issued latest) amount),
            no-issued: (+ (get no-issued latest) amount),
          })))
          (try! (validate-market-invariants updated-market))
          (map-set markets { id: market-id } updated-market)
        )
      )
      (print {
        event: "complete-set-minted",
        market-id: market-id,
        user: tx-sender,
        amount: amount,
        vault-total: (+ (get vault-sbtc market) amount),
      })
      (ok {
        yes: amount,
        no: amount,
      })
    )
  )
)

;; Burn complete set: Redeem equal YES + NO shares for sBTC
;; This is primarily used by:
;;   - Arbitrageurs (when YES + NO price < 1 sBTC)
;;   - sell-shares function (to automatically redeem matched pairs)
;;
;; Economic effect:
;;   - Withdraws sBTC from vault
;;   - Destroys YES and NO shares (decreases yes-issued and no-issued)
;;   - Does NOT affect virtual reserves (reserves are for pricing only)
;;
;; Example: burn-complete-set(1000) with 13,000 existing:
;;   Before: vault=13000, yes-issued=13000, no-issued=13000
;;   After:  vault=12000, yes-issued=12000, no-issued=12000
;;   Reserves unchanged!
(define-public (burn-complete-set
    (market-id uint)
    (amount uint)
  )
  (begin
    (try! (ensure-positive amount))
    (let ((market (try! (require-market-open market-id))))
      (try! (ensure-complete-set-holdings market-id tx-sender amount))
      (try! (burn-complete-set-from market-id tx-sender amount))
      (try! (vault-withdraw amount tx-sender))

      ;; Preserve updated circulating counts when recording vault reduction
      (let ((latest (unwrap! (map-get? markets { id: market-id }) (err ERR-NO-MARKET))))
        (let ((updated-market (merge latest {
            vault-sbtc: (- (get vault-sbtc latest) amount),
            yes-issued: (- (get yes-issued latest) amount),
            no-issued: (- (get no-issued latest) amount),
          })))
          (try! (validate-market-invariants updated-market))
          (map-set markets { id: market-id } updated-market)
        )
      )
      (print {
        event: "complete-set-burned",
        market-id: market-id,
        user: tx-sender,
        amount: amount,
        vault-remaining: (- (get vault-sbtc market) amount),
      })
      (ok amount)
    )
  )
)

;; ====================================================================================
;; AMM SWAP TRADING
;; ====================================================================================

;; Swap shares from one side to the other using constant-product AMM pricing
;; This is how users change their position without needing a counterparty
;;
;; !!! WARNING: Swaps can create NET NEW SHARES without adding collateral!
;; When swapping from scarce -> abundant side, you receive MORE shares than you burn.
;; This increases total circulating shares above vault collateral (over-issuance).
;; See top-level comments for over-issuance risk explanation.
;;
;; Flow:
;;   1. Calculate fee (e.g., 0.3% of amount-in)
;;   2. Use constant-product formula to determine output
;;   3. Burn user's from-side shares
;;   4. Mint fee shares to treasury (on from-side)
;;   5. Mint output shares to user (on to-side)
;;   6. Update virtual reserves (from-side increases, to-side decreases)
;;
;; Key insight: This DOES affect virtual reserves (unlike mint/burn complete sets)
;; Reserves change to reflect the new market price after the swap
;;
;; Example: swap-shares(from-side: true, amount-in: 1000)
;;   Swapping YES to NO
;;   Reserves: YES=90116, NO=110967
;;   Fee: 1000 * 0.003 = 3 shares
;;   Trade-in: 997 shares (after fee)
;;   Amount-out: ~1215 NO shares (from calculate-amount-out)
;;
;;   User loses: 1000 YES
;;   User gains: 1215 NO
;;   Treasury gains: 3 YES (fee)
;;   New reserves: YES=91113, NO=109752
;;
;; IMPORTANT: This DOES create/destroy shares in user balances, but does NOT update
;; yes-issued/no-issued counts (those only track complete sets).
;; This means actual circulating shares can diverge from yes-issued/no-issued values!
(define-public (swap-shares
    (market-id uint)
    (from-side bool)      ;; true = swap YES to NO, false = swap NO to YES
    (amount-in uint)      ;; How many shares to swap
  )
  (begin
    (try! (ensure-positive amount-in))
    (let ((market (try! (require-market-open market-id))))
      (try! (ensure-sufficient-balance market-id tx-sender from-side amount-in))

      ;; Determine which reserves to use (from-side increases, to-side decreases)
      (let ((reserve-from (if from-side (get price-yes market) (get price-no market)))
            (reserve-to (if from-side (get price-no market) (get price-yes market)))
            (fee-bps (get fee-bps market))
            (fee-recipient (var-get protocol-treasury)))

        ;; Calculate fee and amount going into AMM
        (let ((fee-share (/ (* amount-in fee-bps) FEE-DENOMINATOR)))
          ;; Ensure fee doesn't exceed amount-in (prevent underflow)
          (let ((safe-fee (if (> fee-share amount-in) amount-in fee-share)))
            (let ((trade-in (- amount-in safe-fee)))
              (try! (ensure (> trade-in u0) ERR-ZERO-AMOUNT))

            ;; Use constant-product formula to determine output
            (let ((amount-out (try! (calculate-amount-out reserve-from reserve-to trade-in))))

            ;; Execute balance changes
            (try! (burn-shares market-id tx-sender from-side amount-in))
            (if (> safe-fee u0)
              (begin
                (mint-shares market-id fee-recipient from-side safe-fee)  ;; Fee to treasury
                true)
              true)
            (mint-shares market-id tx-sender (not from-side) amount-out)   ;; Output to user

            ;; Update virtual reserves and fee tracking
            ;; Ensure amount-out doesn't exceed reserve-to (safety check)
            (try! (ensure (<= amount-out reserve-to) ERR-INVALID-V-LIQUIDITY))

            ;; Re-fetch market to get latest state (after mint-shares updated circulating counts)
            (let ((updated-market (unwrap! (map-get? markets { id: market-id }) (err ERR-NO-MARKET)))
                  (new-reserve-from (+ reserve-from trade-in))
                  (new-reserve-to (- reserve-to amount-out))
                  (updated-fees-yes (if from-side
                    (+ (get fees-yes updated-market) safe-fee)
                    (get fees-yes updated-market)))
                  (updated-fees-no (if from-side
                    (get fees-no updated-market)
                    (+ (get fees-no updated-market) safe-fee))))
              (map-set markets { id: market-id }
                (merge updated-market {
                  price-yes: (if from-side new-reserve-from new-reserve-to),
                  price-no: (if from-side new-reserve-to new-reserve-from),
                  fees-yes: updated-fees-yes,
                  fees-no: updated-fees-no,
                })
              )
              (print {
                event: "shares-swapped",
                market-id: market-id,
                user: tx-sender,
                from-side: from-side,
                amount-in: amount-in,
                amount-out: amount-out,
                fee: safe-fee,
                new-price-yes: (if from-side new-reserve-from new-reserve-to),
                new-price-no: (if from-side new-reserve-to new-reserve-from),
              })
              (ok amount-out)
            )
          )))
        )
      )
    )
  )
)

;; ====================================================================================
;; RESOLUTION & REDEMPTION
;; ====================================================================================

;; Resolve market using Pyth oracle price feed
;; Can only be called within a 2-block window at resolution-block
;;
;; Flow:
;;   1. Verify we're within resolution window (resolution-block <= burn-block-height <= resolution-block + 1)
;;   2. Submit VAA (Verifiable Action Approval) to Pyth oracle
;;   3. Pyth verifies Wormhole signatures and updates price storage
;;   4. Read the price from Pyth storage
;;   5. Compare price against threshold using comparison-type
;;   6. Set market as resolved with outcome (true = YES wins, false = NO wins)
;;
;; Example:
;;   Market: "Will BTC be >= $100k by block 890000?"
;;   resolution-block: 890000
;;   threshold-price: 100000 (with expo scaling)
;;   comparison-type: "GE"
;;
;;   At block 890000 or 890001 (2-block window):
;;     - Submit Pyth VAA with current price data
;;     - Price fetched: 110000
;;     - Comparison: 110000 >= 100000 => true
;;     - Outcome: YES wins
;;   At block 890002 or later: ERR-TOO-LATE (must use cancellation/refund instead)
(define-public (resolve-market
    (market-id uint)
    (vaa (buff 8192))                ;; Pyth VAA bytes from Hermes API
    (execution-plan {
      pyth-storage-contract: <pyth-storage-trait>,
      pyth-decoder-contract: <pyth-decoder-trait>,
      wormhole-core-contract: <wormhole-core-trait>,
    })
  )
  (let ((market (try! (require-market-open market-id))))
    ;; Check resolution window: resolution-block <= burn-block-height <= resolution-block + 1
    (try! (ensure (>= burn-block-height (get resolution-block market)) ERR-TOO-EARLY))
    (try! (ensure (<= burn-block-height (+ (get resolution-block market) u1)) ERR-TOO-LATE))

    ;; Verify VAA and update Pyth storage with latest price
    (try! (contract-call? .pyth-oracle-v4 verify-and-update-price-feeds vaa execution-plan))

    ;; Read price from Pyth storage
    (let ((price-response (try! (contract-call? .pyth-oracle-v4 get-price (get threshold-feed-id market)
            (get pyth-storage-contract execution-plan)
          ))))

      ;; Evaluate comparison to determine winner
      (let ((outcome (evaluate-comparison (get comparison-type market) (get price price-response)
          (get threshold-price market)
        )))
        ;; Mark market as resolved
        (map-set markets { id: market-id }
          (merge market {
            resolved: true,
            outcome: (some outcome),
          })
        )
        (let ((resolution-details {
          event: "market-resolved",
          market-id: market-id,
          outcome: outcome,
          resolution-price: (get price price-response),
          threshold-price: (get threshold-price market),
          resolver: tx-sender,
          block-height: burn-block-height,
        }))
          (print resolution-details)
          (ok resolution-details)
        )
      )
    )
  )
)

;; Redeem winning shares for sBTC using PROPORTIONAL REDEMPTION
;; Can only be called after market is resolved
;;
;; !!! WARNING: You may receive LESS than 1 sat per share due to over-issuance!
;; If total circulating shares > vault balance, redemption ratio will be < 100%.
;; Use get-redemption-info to check the current redemption ratio before claiming.
;;
;; PROPORTIONAL REDEMPTION:
;;   Instead of first-come-first-serve, everyone gets the same redemption ratio
;;   regardless of when they claim. This is FAIR and eliminates "race to redeem".
;;
;;   Formula: payout = (user_shares / total_circulating) * vault_balance
;;
;;   Example:
;;     - Vault: 30k sats
;;     - Total YES circulating: 60k shares
;;     - Redemption ratio: 30k / 60k = 50%
;;
;;     Alice (20k shares): 20k * 50% = 10k sats
;;     Bob (10k shares): 10k * 50% = 5k sats
;;     Charlie (20k shares): 20k * 50% = 10k sats
;;
;;     Order doesn't matter - everyone gets same 50% ratio!
;;
;; Mathematical property: The ratio stays constant as people redeem
;;   After Alice redeems: vault=20k, circulating=40k, ratio=50% (same!)
;;
;; Flow:
;;   1. Check market is resolved
;;   2. Determine winner (YES or NO)
;;   3. Check user has winning shares
;;   4. Calculate proportional payout based on circulating shares
;;   5. Burn ALL user's winning shares
;;   6. Withdraw proportional payout (may be less than shares if over-issued)
;;
;; Note: This is NOT the same as burn-complete-set!
;;   - burn-complete-set: requires both YES and NO, redeems before resolution
;;   - redeem-shares: requires only winning side, redeems after resolution with proportional payout
(define-public (redeem-shares (market-id uint))
  (let ((market (try! (require-resolved-market market-id))))
    (let (
        (winner (unwrap! (get outcome market) (err ERR-NOTHING-TO-REDEEM)))
        (user-shares (default-to u0
          (map-get? balances {
            market-id: market-id,
            user: tx-sender,
            side: winner,
          })
        ))
        (total-circulating (if winner
          (get yes-circulating market)
          (get no-circulating market)))
        (vault-balance (get vault-sbtc market))
      )

      ;; Validations
      (try! (ensure (> user-shares u0) ERR-NOTHING-TO-REDEEM))
      (try! (ensure (> total-circulating u0) ERR-INVALID-V-LIQUIDITY))
      (try! (ensure (> vault-balance u0) ERR-INSUFFICIENT-BALANCE))

      ;; Calculate proportional payout
      ;; payout = (user-shares * vault-balance) / total-circulating
      (let ((payout (/ (* user-shares vault-balance) total-circulating)))

        ;; Burn ALL user's winning shares (they get proportional payout, not 1:1)
        (try! (burn-shares market-id tx-sender winner user-shares))

        ;; Withdraw proportional payout
        (try! (vault-withdraw payout tx-sender))

        ;; Update market state based on latest storage snapshot so we do not
        ;; clobber the circulating counts that burn-shares just adjusted.
        (let ((post-burn-market (unwrap! (map-get? markets { id: market-id }) (err ERR-NO-MARKET))))
          (map-set markets { id: market-id }
            (merge post-burn-market {
              vault-sbtc: (- (get vault-sbtc post-burn-market) payout),
            })
          )
        )

        ;; Return redemption details
        (print {
          event: "shares-redeemed",
          market-id: market-id,
          user: tx-sender,
          winning-side: winner,
          shares-burned: user-shares,
          payout: payout,
          redemption-ratio-bps: (/ (* payout u10000) user-shares),
        })
        (ok {
          shares-burned: user-shares,
          payout: payout,
          redemption-ratio-bps: (/ (* payout u10000) user-shares),
        })
      )
    )
  )
)

;; ====================================================================================
;; CANCELLATION & REFUND MECHANISM
;; ====================================================================================

;; Cancel a market that cannot be resolved
;; Can be called by ANYONE after the 2-block resolution window expires
;; This provides a safety mechanism when:
;;   - Oracle stops publishing price data
;;   - No one has incentive to resolve the market
;;   - Market parameters were incorrect (wrong feed ID, etc.)
;;   - Price data not available at resolution time
;;
;; Once cancelled, users can call refund-shares to get their sBTC back
;;
;; Example timeline:
;;   resolution-block: 890000
;;   Resolution window: 890000-890001 (can resolve)
;;   Block 890002+: Can cancel (resolution-block + CANCEL-TIMEOUT-BLOCKS = 890000 + 2)
;;   Cancellation is available immediately after the resolution window closes
(define-public (cancel-market (market-id uint))
  (let ((market (try! (fetch-market market-id))))
    ;; Cannot cancel if already resolved
    (try! (ensure (not (get resolved market)) ERR-RESOLVED))

    ;; Cannot cancel if already cancelled
    (try! (ensure (not (get cancelled market)) ERR-MARKET-CANCELLED))

    ;; Must wait until resolution-block + timeout period
    (let ((cancel-block (+ (get resolution-block market) CANCEL-TIMEOUT-BLOCKS)))
      (try! (ensure (>= burn-block-height cancel-block) ERR-TOO-EARLY))

      ;; Mark market as cancelled
      (map-set markets { id: market-id }
        (merge market {
          cancelled: true,
        })
      )
      (print {
        event: "market-cancelled",
        market-id: market-id,
        cancelled-by: tx-sender,
        block-height: burn-block-height,
        vault-sbtc: (get vault-sbtc market),
      })
      (ok true)
    )
  )
)

;; Refund shares from a cancelled market
;; Returns sBTC proportionally based on total shares owned (YES + NO)
;; When cancelled, there's no winner/loser, so all shares have equal claim on vault
;;
;; Formula: payout = (user_total_shares / total_circulating) * vault
;;   where user_total_shares = user_yes + user_no
;;   and total_circulating = yes_circulating + no_circulating
;;
;; Example scenarios:
;;   Vault: 1000 sBTC, Total circulating: 2000 shares (1200 YES + 800 NO)
;;   1. User has 200 YES, 0 NO -> refund (200/2000)*1000 = 100 sBTC
;;   2. User has 100 YES, 100 NO -> refund (200/2000)*1000 = 100 sBTC
;;   3. User has 0 YES, 400 NO -> refund (400/2000)*1000 = 200 sBTC
;;
;; !!! WARNING: If vault is under-collateralized (over-issuance), uses proportional payout
(define-public (refund-shares (market-id uint))
  (let ((market (try! (fetch-market market-id))))
    ;; Market must be cancelled
    (try! (ensure (get cancelled market) ERR-NOT-CANCELLED))

    ;; Get user's YES and NO balances
    (let (
        (yes-balance (default-to u0
          (map-get? balances {
            market-id: market-id,
            user: tx-sender,
            side: true,
          })
        ))
        (no-balance (default-to u0
          (map-get? balances {
            market-id: market-id,
            user: tx-sender,
            side: false,
          })
        ))
      )

      ;; User's total shares (YES + NO)
      (let ((user-total-shares (+ yes-balance no-balance)))
        (try! (ensure (> user-total-shares u0) ERR-NOTHING-TO-REDEEM))

        ;; Calculate proportional refund based on total circulating shares
        (let (
            (total-circulating (+ (get yes-circulating market) (get no-circulating market)))
            (vault-balance (get vault-sbtc market))
          )
          (try! (ensure (> total-circulating u0) ERR-INVALID-V-LIQUIDITY))
          (try! (ensure (> vault-balance u0) ERR-INSUFFICIENT-BALANCE))

          ;; Proportional refund: (user_total_shares * vault) / total_circulating
          (let ((refund (/ (* user-total-shares vault-balance) total-circulating)))

            ;; Burn user's shares (both YES and NO if they have them)
            (begin
              (if (> yes-balance u0)
                (try! (burn-shares market-id tx-sender true yes-balance))
                u0
              )
              (if (> no-balance u0)
                (try! (burn-shares market-id tx-sender false no-balance))
                u0
              )
            )

            ;; Withdraw refund
            (try! (vault-withdraw refund tx-sender))

            ;; Update market vault balance and issued counts
            ;; Only reduce yes-issued/no-issued by complete sets (min of YES and NO)
            (let ((post-burn (unwrap! (map-get? markets { id: market-id }) (err ERR-NO-MARKET)))
                  (complete-sets-burned (min-uint yes-balance no-balance)))
              (map-set markets { id: market-id }
                (merge post-burn {
                  vault-sbtc: (- (get vault-sbtc post-burn) refund),
                  yes-issued: (- (get yes-issued post-burn) complete-sets-burned),
                  no-issued: (- (get no-issued post-burn) complete-sets-burned),
                })
              )
            )

            ;; Return refund details
            (print {
              event: "shares-refunded",
              market-id: market-id,
              user: tx-sender,
              yes-shares-burned: yes-balance,
              no-shares-burned: no-balance,
              total-shares-burned: user-total-shares,
              refund: refund,
              refund-ratio-bps: (/ (* refund u10000) user-total-shares),
            })
            (ok {
              yes-shares-burned: yes-balance,
              no-shares-burned: no-balance,
              total-shares-burned: user-total-shares,
              refund: refund,
              refund-ratio-bps: (/ (* refund u10000) user-total-shares),
            })
          )
        )
      )
    )
  )
)

;; ====================================================================================
;; USER-FRIENDLY BUY/SELL FUNCTIONS
;; ====================================================================================

;; Buy shares on one side using sBTC
;; This is the PRIMARY way users enter positions
;;
;; Tax: 1% tax is deducted upfront and sent to tax-recipient
;;
;; Strategy: "Mint + Swap" pattern (applied to net amount after tax)
;;   1. Deduct 1% tax from sbtc-in
;;   2. Mint complete set with net amount (get equal YES and NO)
;;   3. Swap the unwanted side to get more of the desired side (AMM fee still applies)
;;
;; Example: buy-shares(side: true, sbtc-in: 100)
;;   Step 0: Tax deduction
;;     - 1% tax: 1 sBTC sent to tax-recipient
;;     - Net amount: 99 sBTC
;;   Step 1: mint-complete-set(99)
;;     - Pay 99 sBTC (net amount)
;;     - Receive 99 YES + 99 NO
;;   Step 2: swap-shares(from-side: false, amount-in: 99)
;;     - Swap 99 NO to ~120 YES (amount depends on AMM pricing and trading fee)
;;   Final result:
;;     - You have ~219 YES shares (99 from mint + 120 from swap)
;;     - You spent 100 sBTC total (99 to market + 1 tax)
;;     - Effective price: ~0.46 sBTC per YES share
;;
;; Why this works:
;;   - Complete set minting is always 1:1 (no slippage)
;;   - AMM swap gives you favorable pricing when buying abundant side
;;   - Net result: more shares than simple AMM-only approach
(define-public (buy-shares
    (market-id uint)
    (side bool)          ;; true = buy YES, false = buy NO
    (sbtc-in uint)       ;; sBTC to spend
  )
  (let (
      ;; Calculate and transfer 1% tax
      (tax-amount (calculate-tax sbtc-in))
      (net-amount (- sbtc-in tax-amount))  ;; Amount after tax deduction
      (tax-transfer (try! (contract-call? .sbtc-token transfer tax-amount tx-sender (var-get tax-recipient) none)))
      ;; First, validate inputs and mint complete set with net amount
      (validation (try! (ensure-positive net-amount)))
      (mint-result (try! (mint-complete-set market-id net-amount)))
      ;; Then swap the unwanted side with net amount
      (swap-result (try! (swap-shares market-id (not side) net-amount)))
      ;; Finally get the balance
      (balance (default-to u0
        (map-get? balances {
          market-id: market-id,
          user: tx-sender,
          side: side,
        })
      ))
    )
    (print {
      event: "shares-bought",
      market-id: market-id,
      user: tx-sender,
      side: side,
      sbtc-spent: sbtc-in,
      tax-paid: tax-amount,
      final-balance: balance,
    })
    (ok balance)
  )
)

;; Sell shares on one side for sBTC
;; This is the PRIMARY way users exit positions
;;
;; Tax: 1% tax is deducted from the redeemed sBTC amount
;;
;; Strategy: "Swap + Burn" pattern
;;   1. Swap shares from desired side to opposite side (swap fee still applies)
;;   2. Burn any complete sets (matched YES+NO pairs) that remain after the swap
;;   3. Deduct 1% tax from the burn amount, send tax to tax-recipient
;;
;; Example: User holds 150 YES and 20 NO, calls sell-shares(side: true, amount: 100)
;;   Step 1: swap-shares(from-side: true, amount-in: 100)
;;     - Burns 100 YES, mints ~82 NO (subject to AMM pricing and trading fee)
;;     - User now has 50 YES and ~102 NO
;;   Step 2: Burn matched sets
;;     - burn-amount = min(50, 102) = 50 complete sets
;;   Step 3: Tax deduction
;;     - 1% tax: 0.5 sBTC sent to tax-recipient
;;     - Net withdrawal: 49.5 sBTC to user
;;   Final result:
;;     - Remaining position: 0 YES and ~52 NO
;;     - User receives 49.5 sBTC and pays 0.5 sBTC tax
;;
;; If the swap leaves no matched pairs (e.g., you sell your entire YES stack),
;; the function skips burning and simply leaves you holding the swapped side.
(define-public (sell-shares
    (market-id uint)
    (side bool)          ;; true = sell YES, false = sell NO
    (amount uint)        ;; Number of shares to sell
  )
  (begin
    (try! (ensure-positive amount))
    (try! (ensure-sufficient-balance market-id tx-sender side amount))
    (try! (swap-shares market-id side amount))          ;; Swap to opposite side

    ;; Check for complete sets and burn them automatically
    (let (
        (yes-bal (default-to u0
          (map-get? balances {
            market-id: market-id,
            user: tx-sender,
            side: true,
          })
        ))
        (no-bal (default-to u0
          (map-get? balances {
            market-id: market-id,
            user: tx-sender,
            side: false,
          })
        ))
      )
      (let ((burn-amount (min-uint yes-bal no-bal)))
        (if (> burn-amount u0)
          ;; Burn complete sets with tax deduction (instead of calling burn-complete-set)
          (let (
              (market-latest (try! (require-market-open market-id)))
              ;; Calculate tax BEFORE withdrawing
              (tax-amount (calculate-tax burn-amount))
              (net-amount (- burn-amount tax-amount))  ;; User gets this
            )
            (begin
              ;; Ensure user has complete sets
              (try! (ensure-complete-set-holdings market-id tx-sender burn-amount))
              ;; Burn the shares from user
              (try! (burn-complete-set-from market-id tx-sender burn-amount))
              ;; Withdraw net amount to user (after tax)
              (try! (vault-withdraw net-amount tx-sender))
              ;; Withdraw tax to tax recipient
              (if (> tax-amount u0)
                (try! (vault-withdraw tax-amount (var-get tax-recipient)))
                true
              )

              ;; Update market state (preserve circulating counts from burn-shares)
              (let ((post-burn (unwrap! (map-get? markets { id: market-id }) (err ERR-NO-MARKET))))
                (let ((updated-market (merge post-burn {
                    vault-sbtc: (- (get vault-sbtc post-burn) burn-amount),
                    yes-issued: (- (get yes-issued post-burn) burn-amount),
                    no-issued: (- (get no-issued post-burn) burn-amount),
                  })))
                  (try! (validate-market-invariants updated-market))
                  (map-set markets { id: market-id } updated-market)
                )
              )
              (print {
                event: "shares-sold",
                market-id: market-id,
                user: tx-sender,
                side: side,
                shares-sold: amount,
                sbtc-received: net-amount,
                tax-paid: tax-amount,
              })
              (ok net-amount)     ;; Return sBTC amount user actually received
            )
          )
          (begin
            (print {
              event: "shares-sold",
              market-id: market-id,
              user: tx-sender,
              side: side,
              shares-sold: amount,
              sbtc-received: u0,
              tax-paid: u0,
            })
            (ok u0)             ;; No complete sets to burn
          )
        )
      )
    )
  )
)

;; ====================================================================================
;; ADMIN & READ-ONLY FUNCTIONS
;; ====================================================================================

;; Add a principal to the authorized market creators list
;; Only contract owner can call this
(define-public (add-market-creator (creator principal))
  (begin
    (try! (ensure (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED))
    (map-set market-creators creator true)
    (ok true)
  )
)

;; Remove a principal from the authorized market creators list
;; Only contract owner can call this
(define-public (remove-market-creator (creator principal))
  (begin
    (try! (ensure (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED))
    (map-delete market-creators creator)
    (ok true)
  )
)

;; Transfer contract ownership to a new owner
;; Only current owner can call this
(define-public (set-contract-owner (new-owner principal))
  (begin
    (try! (ensure (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED))
    (var-set contract-owner new-owner)
    (ok new-owner)
  )
)

;; Get current contract owner
(define-read-only (get-contract-owner)
  (ok (var-get contract-owner))
)

;; Update protocol treasury address (receives trading fees)
;; Only current treasury can change this
(define-public (set-protocol-treasury (new-treasury principal))
  (begin
    (try! (ensure (is-eq tx-sender (var-get protocol-treasury)) ERR-UNAUTHORIZED))
    (var-set protocol-treasury new-treasury)
    (ok new-treasury)
  )
)

;; Get current protocol treasury address
(define-read-only (get-protocol-treasury)
  (ok (var-get protocol-treasury))
)

;; Update tax recipient address (receives 1% tax on buy/sell)
;; Only contract owner can change this
(define-public (set-tax-recipient (new-recipient principal))
  (begin
    (try! (ensure (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED))
    (var-set tax-recipient new-recipient)
    (print {
      event: "tax-recipient-updated",
      old-recipient: (var-get tax-recipient),
      new-recipient: new-recipient,
      updated-by: tx-sender,
    })
    (ok new-recipient)
  )
)

;; Get current tax recipient address
(define-read-only (get-tax-recipient)
  (ok (var-get tax-recipient))
)

;; ====================================================================================
;; TESTING HELPERS (Remove in production)
;; ====================================================================================

;; Mock resolution function for testing (bypasses Pyth oracle)
;; IMPORTANT: Remove this function before mainnet deployment!
(define-public (mock-resolve-market (market-id uint) (winner bool))
  (let ((market (try! (require-market-open market-id))))
    ;; Mark market as resolved with the specified outcome
    (map-set markets { id: market-id }
      (merge market {
        resolved: true,
        outcome: (some winner),
      })
    )
    (ok winner)
  )
)

;; Get cumulative fees collected for a market
;; fees-yes: YES shares collected as fees (held by treasury)
;; fees-no: NO shares collected as fees (held by treasury)
(define-read-only (get-market-fees (market-id uint))
  (match (map-get? markets { id: market-id })
    market (ok {
      fees-yes: (get fees-yes market),
      fees-no: (get fees-no market),
    })
    (err ERR-NO-MARKET)
  )
)

;; Get redemption info for resolved market
;; Shows current redemption ratio and lets users preview their payout
;;
;; Returns:
;;   winner: true = YES won, false = NO won
;;   vault-balance: Current sBTC in vault available for redemption
;;   total-circulating: Total winning shares across all users
;;   redemption-ratio-bps: Payout ratio in basis points (e.g., 5000 = 50%)
;;
;; Example:
;;   vault-balance: 30,000 sats
;;   total-circulating: 60,000 YES shares
;;   redemption-ratio-bps: 5000 (50%)
;;
;;   A user with 20,000 YES shares will receive:
;;   20,000 * (5000 / 10000) = 10,000 sats
(define-read-only (get-redemption-info (market-id uint))
  (match (map-get? markets { id: market-id })
    market
      (if (not (get resolved market))
        (err ERR-NOT-RESOLVED)
        (match (get outcome market)
          winner
            (let ((total-circulating (if winner
                    (get yes-circulating market)
                    (get no-circulating market)))
                  (vault-balance (get vault-sbtc market)))
              (ok {
                winner: winner,
                vault-balance: vault-balance,
                total-circulating: total-circulating,
                redemption-ratio-bps: (if (> total-circulating u0)
                  (/ (* vault-balance u10000) total-circulating)
                  u10000),
              })
            )
          (err ERR-NOTHING-TO-REDEEM)
        )
      )
    (err ERR-NO-MARKET)
  )
)

(define-read-only (get-burn-block-height)
  (ok burn-block-height)
)