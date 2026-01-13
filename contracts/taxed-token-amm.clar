;; @title Taxed Token Uniswap-like AMM Contract
;; @notice This decentralized exchange (DEX) facilitates the trading of the taxed token using a constant product formula (x*y=k),
;; handles the tax collection logic, and provides liquidity provider (LP) functionality.
;; @version 1.0

(use-trait ft-trait 'ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18.sip-010-trait-ft-standard.sip-010-trait)

;; Error constants
(define-constant ERR-UNAUTHORIZED (err u3000))
(define-constant ERR-UNAUTHORIZED-TOKEN (err u3001))
(define-constant ERR-ALREADY-INITIALIZED (err u3002))
(define-constant ERR-TRADING-DISABLED (err u3003))
(define-constant ERR-NOT-TOKEN-CONTRACT (err u3004))
(define-constant ERR-ZERO-AMOUNT (err u3005))
(define-constant ERR-SLIPPAGE-TOLERANCE (err u3006))
(define-constant ERR-INSUFFICIENT-STX (err u3007))
(define-constant ERR-FIRST-LIQUIDITY (err u3008))
(define-constant ERR-INSUFFICIENT-LP-TOKENS (err u3009))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u3010))
(define-constant ERR-K-VALUE (err u3011))
(define-constant ERR-INVARIANT-AFTER-SWAP (err u3012))

;; Constants
(define-constant AMM-ADDRESS (as-contract tx-sender)) ;; AMM contract address
(define-constant SWAP-FEE-PERCENT u2) ;; 2% fee on regular swaps
(define-constant MINIMUM-LIQUIDITY u1000) ;; Minimum liquidity to prevent price manipulation

;; Fee wallets
(define-constant PROTOCOL-FEE-WALLET 'SP1WRH525WGKZJDCY8FSYASWVNVYB62580QNARMXP) ;; Receives swap fees

;; LP Token implementation
(define-fungible-token lp-token) ;; Liquidity provider token

;; Data vars
(define-data-var contract-owner principal tx-sender)
(define-constant TOKEN-CONTRACT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.taxed-token) ;; Hardcoded taxed token contract
(define-data-var token-reserve uint u0) ;; Current token balance in the AMM
(define-data-var stx-reserve uint u0) ;; Current STX balance in the AMM
(define-data-var liquidity-token-tax uint u0) ;; Accumulated tokens from tax for liquidity
(define-data-var redistributed-stx uint u0) ;; Accumulated STX from redistribution
(define-data-var trading-enabled bool false)
(define-data-var lp-token-uri (optional (string-utf8 256)) (some u"https://example.com/taxed-token-lp-metadata.json"))
(define-data-var total-fees-collected uint u0) ;; Tokens accumulated from the liquidity tax

;; LP Token metadata is defined above

;; Read-only function for LP token info
(define-read-only (get-lp-token-name) (ok "Taxed Token LP"))
(define-read-only (get-lp-token-symbol) (ok "TAXT-LP"))
(define-read-only (get-lp-token-decimals) (ok u6))
(define-read-only (get-lp-token-uri) (ok (var-get lp-token-uri)))
(define-read-only (get-lp-token-supply) (ok (ft-get-supply lp-token)))
(define-read-only (get-lp-balance (owner principal)) (ok (ft-get-balance lp-token owner)))

;; Initialize the contract - enable trading
(define-public (initialize)
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
        (asserts! (not (var-get trading-enabled)) (err ERR-ALREADY-INITIALIZED))
        (var-set trading-enabled true)
        (ok true)
    )
)

;; Process tax collection from the token contract, only called by the token contract
(define-public (process-tax-collection (liquidity-amount uint) (stx-redistribution-amount uint))
    (begin
        (asserts! (is-eq contract-caller TOKEN-CONTRACT) ERR-NOT-TOKEN-CONTRACT)
        
        ;; Add the liquidity tokens to accumulate for automated liquidity
        (var-set liquidity-token-tax (+ (var-get liquidity-token-tax) liquidity-amount))
        
        ;; Track redistributed STX from token taxes
        (var-set redistributed-stx (+ (var-get redistributed-stx) stx-redistribution-amount))
        
        (ok true)
    )
)

;; Add liquidity to the AMM
(define-public (add-liquidity 
                (token-trait <sip-010-trait>) 
                (token-amount uint) 
                (stx-amount uint)
                (min-lp-tokens uint))
    (begin
        (asserts! (var-get trading-enabled) ERR-TRADING-DISABLED)
        (asserts! (is-eq TOKEN-CONTRACT (contract-of token-trait)) ERR-UNAUTHORIZED-TOKEN)
        (asserts! (> token-amount u0) ERR-ZERO-AMOUNT)
        (asserts! (> stx-amount u0) ERR-ZERO-AMOUNT)
        
        (let (
            (total-liquidity (ft-get-supply lp-token))
            (token-reserve-amount (var-get token-reserve))
            (stx-reserve-amount (var-get stx-reserve))
            (lp-tokens-to-mint uint)
        )
            ;; Calculate LP tokens to mint
            (if (is-eq total-liquidity u0)
                ;; First liquidity provider
                ;; Initial LP tokens = sqrt(token-amount * stx-amount)
                (begin
                    ;; Set LP tokens to mint = sqrt of product of token and stx amounts
                    ;; For simplicity using stx-amount as initial liquidity
                    (asserts! (>= stx-amount MINIMUM-LIQUIDITY) ERR-FIRST-LIQUIDITY)
                    ;; First liquidity has minimum of 1000 tokens to prevent price manipulation
                    (var-set lp-tokens-to-mint (- stx-amount MINIMUM-LIQUIDITY))
                    ;; Mint minimum liquidity to contract (locked forever)
                    (try! (ft-mint? lp-token MINIMUM-LIQUIDITY AMM-ADDRESS))
                )
                ;; Existing liquidity
                ;; LP tokens = min(token-amount * total-liquidity / token-reserve, stx-amount * total-liquidity / stx-reserve)
                (begin
                    (let (
                        (token-based-lp (/ (* token-amount total-liquidity) token-reserve-amount))
                        (stx-based-lp (/ (* stx-amount total-liquidity) stx-reserve-amount))
                    )
                        ;; Mint the minimum of the two to maintain equal value contribution
                        (var-set lp-tokens-to-mint (if (< token-based-lp stx-based-lp) token-based-lp stx-based-lp))
                    )
                )
            )
            
            ;; Ensure slippage tolerance is met
            (asserts! (>= (var-get lp-tokens-to-mint) min-lp-tokens) ERR-SLIPPAGE-TOLERANCE)
            
            ;; Transfer token and STX to AMM
            (try! (contract-call? token-trait transfer token-amount tx-sender AMM-ADDRESS none))
            (try! (stx-transfer? stx-amount tx-sender AMM-ADDRESS))
            
            ;; Mint LP tokens to provider
            (try! (ft-mint? lp-token (var-get lp-tokens-to-mint) tx-sender))
            
            ;; Update reserves
            (var-set token-reserve (+ token-reserve-amount token-amount))
            (var-set stx-reserve (+ stx-reserve-amount stx-amount))
            
            (ok (var-get lp-tokens-to-mint))
        )
    )
)

;; Remove liquidity from the AMM
(define-public (remove-liquidity 
                (token-trait <sip-010-trait>) 
                (lp-token-amount uint)
                (min-token-amount uint)
                (min-stx-amount uint))
    (begin
        (asserts! (var-get trading-enabled) ERR-TRADING-DISABLED)
        (asserts! (is-eq TOKEN-CONTRACT (contract-of token-trait)) ERR-UNAUTHORIZED-TOKEN)
        (asserts! (> lp-token-amount u0) ERR-ZERO-AMOUNT)
        
        (let (
            (user-lp-balance (ft-get-balance lp-token tx-sender))
            (total-liquidity (ft-get-supply lp-token))
            (token-reserve-amount (var-get token-reserve))
            (stx-reserve-amount (var-get stx-reserve))
            ;; Calculate proportion of reserves to return based on LP token amount
            (token-amount (/ (* lp-token-amount token-reserve-amount) total-liquidity))
            (stx-amount (/ (* lp-token-amount stx-reserve-amount) total-liquidity))
        )
            ;; Verify user has enough LP tokens
            (asserts! (>= user-lp-balance lp-token-amount) ERR-INSUFFICIENT-LP-TOKENS)
            
            ;; Ensure slippage tolerance is met
            (asserts! (>= token-amount min-token-amount) ERR-SLIPPAGE-TOLERANCE)
            (asserts! (>= stx-amount min-stx-amount) ERR-SLIPPAGE-TOLERANCE)
            
            ;; Burn LP tokens from user
            (try! (ft-burn? lp-token lp-token-amount tx-sender))
            
            ;; Transfer tokens and STX to user
            (try! (as-contract (contract-call? token-trait transfer-from-amm token-amount tx-sender none)))
            (try! (as-contract (stx-transfer? stx-amount tx-sender tx-sender)))
            
            ;; Update reserves
            (var-set token-reserve (- token-reserve-amount token-amount))
            (var-set stx-reserve (- stx-reserve-amount stx-amount))
            
            (ok {token-amount: token-amount, stx-amount: stx-amount})
        )
    )
)

;; Swap STX for tokens
(define-public (swap-stx-for-tokens 
               (token-trait <sip-010-trait>)
               (stx-amount uint) 
               (min-tokens-out uint))
  (begin
    (asserts! (var-get trading-enabled) ERR-TRADING-DISABLED)
    (asserts! (> stx-amount u0) ERR-ZERO-AMOUNT)
    (asserts! (is-eq (var-get token-contract) (contract-of token-trait)) ERR-UNAUTHORIZED-TOKEN)
    
    ;; Try to add any accumulated tax liquidity before calculating swap
    (try! (add-tax-liquidity-internal))
    
    (let (
      (token-reserve-amount (var-get token-reserve))
      (stx-reserve-amount (var-get stx-reserve))
      (protocol-fee (/ (* stx-amount SWAP-FEE-PERCENT) u100)) ;; 2% fee
      (stx-amount-after-fee (- stx-amount protocol-fee))
      (invariant (* token-reserve-amount stx-reserve-amount))
      (new-stx-reserve (+ stx-reserve-amount stx-amount-after-fee))
      (new-token-reserve (/ invariant new-stx-reserve))
      (tokens-out (- token-reserve-amount new-token-reserve))
      (recipient tx-sender)
    )
      ;; Ensure minimum tokens out is met (slippage protection)
      ;; Note: The user will receive 90% of tokens-out due to 10% tax applied by token contract
      (asserts! (>= (/ (* tokens-out u90) u100) min-tokens-out) ERR-SLIPPAGE-TOLERANCE)
      
      ;; Send protocol fee to fee wallet
      (try! (stx-transfer? protocol-fee tx-sender PROTOCOL-FEE-WALLET))
      
      ;; User sends STX to AMM
      (try! (stx-transfer? stx-amount-after-fee tx-sender AMM-ADDRESS))
      
      ;; AMM sends tokens to user - token contract will apply 10% tax automatically
      (try! (as-contract (contract-call? token-trait transfer tokens-out tx-sender recipient none)))
      
      ;; Update reserves
      (var-set stx-reserve new-stx-reserve)
      (var-set token-reserve new-token-reserve)
      (var-set total-fees-collected (+ (var-get total-fees-collected) protocol-fee))
      
      (print {event: "swap-stx-for-tokens", stx-in: stx-amount-after-fee, tokens-out: tokens-out, fee: protocol-fee})
      ;; Return the pre-tax amount, as the actual received amount will be 90% of this due to token tax
      (ok tokens-out)
    )
  )
)

;; Swap tokens for STX
(define-public (swap-tokens-for-stx
               (token-trait <sip-010-trait>)
               (token-amount uint) 
               (min-stx-out uint))
  (begin
    (asserts! (var-get trading-enabled) ERR-TRADING-DISABLED)
    (asserts! (> token-amount u0) ERR-ZERO-AMOUNT)
    (asserts! (is-eq (var-get token-contract) (contract-of token-trait)) ERR-UNAUTHORIZED-TOKEN)
    
    ;; Try to add any accumulated tax liquidity before calculating swap
    (try! (add-tax-liquidity-internal))
    
    (let (
      (token-reserve-amount (var-get token-reserve))
      (stx-reserve-amount (var-get stx-reserve))
      ;; Calculate the STX amount before fee
      (invariant (* token-reserve-amount stx-reserve-amount))
      ;; Calculate new token reserve with tax considered (90% of tokens go to AMM)
      ;; Taxed token contract will handle the tax distribution
      (actual-tokens-in-after-tax (/ (* token-amount u90) u100)) ;; Estimate after 10% tax
      (new-token-reserve (+ token-reserve-amount actual-tokens-in-after-tax))
      (new-stx-reserve (/ invariant new-token-reserve))
      (gross-stx-out (- stx-reserve-amount new-stx-reserve))
      (protocol-fee (/ (* gross-stx-out SWAP-FEE-PERCENT) u100))
      (net-stx-out (- gross-stx-out protocol-fee))
      (recipient tx-sender)
    )
      ;; Ensure minimum STX out is met (slippage protection)
      (asserts! (>= net-stx-out min-stx-out) ERR-SLIPPAGE-TOLERANCE)
      (asserts! (>= stx-reserve-amount net-stx-out) ERR-INSUFFICIENT-STX)
      
      ;; User sends tokens to AMM - this will trigger the tax mechanism
      (try! (contract-call? token-trait transfer token-amount tx-sender AMM-ADDRESS none))
      
      ;; AMM sends STX to user and fee to protocol
      (try! (as-contract (stx-transfer? net-stx-out tx-sender recipient)))
      (try! (as-contract (stx-transfer? protocol-fee tx-sender PROTOCOL-FEE-WALLET)))
      
      ;; Update reserves - note the actual token reserve increase will be less due to tax
      ;; We update based on actual tokens received after tax
      (var-set stx-reserve new-stx-reserve)
      (var-set token-reserve new-token-reserve)
      (var-set total-fees-collected (+ (var-get total-fees-collected) protocol-fee))
      
      (print {event: "swap-tokens-for-stx", tokens-in: token-amount, tokens-in-after-tax: actual-tokens-in-after-tax, stx-out: net-stx-out, fee: protocol-fee})
      (ok net-stx-out)
    )
  )
)

;; Add accumulated liquidity from taxes to the pool - can be called by owner manually
(define-public (add-tax-liquidity (token-trait <sip-010-trait>))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (asserts! (is-eq (var-get token-contract) (contract-of token-trait)) ERR-UNAUTHORIZED-TOKEN)
    (asserts! (> (var-get liquidity-token-tax) u0) ERR-ZERO-AMOUNT)
    (asserts! (> (var-get redistributed-stx) u0) ERR-ZERO-AMOUNT)
    
    (try! (add-tax-liquidity-internal))
    (ok true)
  )
)

;; Internal function to add tax liquidity - can be called automatically during swaps
(define-private (add-tax-liquidity-internal)
  (let (
    (tokens-to-add (var-get liquidity-token-tax))
    (stx-to-add (var-get redistributed-stx))
    (token-reserve-amount (var-get token-reserve))
    (stx-reserve-amount (var-get stx-reserve))
  )
    ;; Only proceed if there are tokens and STX to add
    (if (and (> tokens-to-add u0) (> stx-to-add u0))
      (begin
        ;; Add accumulated tax tokens and STX to reserves
        (var-set token-reserve (+ token-reserve-amount tokens-to-add))
        (var-set stx-reserve (+ stx-reserve-amount stx-to-add))
        
        ;; Reset accumulators
        (var-set liquidity-token-tax u0)
        (var-set redistributed-stx u0)
        
        (print {event: "add-tax-liquidity-auto", tokens-added: tokens-to-add, stx-added: stx-to-add})
        (ok true)
      )
      (ok true) ;; Nothing to add, just return ok
    )
  )
)

;; Quote functions for price estimation

;; Get tokens out for STX in (price quote for swapping STX to tokens)
(define-read-only (get-tokens-out-for-stx-in (stx-amount uint))
  (let (
      (token-reserve-amount (var-get token-reserve))
      (stx-reserve-amount (var-get stx-reserve))
      (protocol-fee (/ (* stx-amount SWAP-FEE-PERCENT) u100))
      (stx-amount-after-fee (- stx-amount protocol-fee))
      (invariant (* token-reserve-amount stx-reserve-amount))
      (new-stx-reserve (+ stx-reserve-amount stx-amount-after-fee))
      (new-token-reserve (/ invariant new-stx-reserve))
      (gross-tokens-out (- token-reserve-amount new-token-reserve))
      ;; Account for 10% tax that will be applied by token contract
      (tokens-out-after-tax (/ (* gross-tokens-out u90) u100))
    )
    (ok {
      tokens-out-before-tax: gross-tokens-out,
      tokens-out-after-tax: tokens-out-after-tax,
      fee-amount: protocol-fee,
      stx-amount-with-fee: stx-amount,
      effective-price: (/ (* stx-amount u1000000) tokens-out-after-tax) ;; price in microSTX per token after tax
    })
  )
)

;; Get STX out for tokens in (price quote for swapping tokens to STX)
(define-read-only (get-stx-out-for-tokens-in (token-amount uint))
  (let (
      (token-reserve-amount (var-get token-reserve))
      (stx-reserve-amount (var-get stx-reserve))
      ;; Account for 10% tax on token transfers
      (actual-tokens-in-after-tax (/ (* token-amount u90) u100))
      (invariant (* token-reserve-amount stx-reserve-amount))
      (new-token-reserve (+ token-reserve-amount actual-tokens-in-after-tax))
      (new-stx-reserve (/ invariant new-token-reserve))
      (gross-stx-out (- stx-reserve-amount new-stx-reserve))
      (protocol-fee (/ (* gross-stx-out SWAP-FEE-PERCENT) u100))
      (net-stx-out (- gross-stx-out protocol-fee))
    )
    (ok {
      stx-out: net-stx-out,
      fee-amount: protocol-fee,
      tokens-in-with-tax: token-amount,
      effective-price: (/ (* net-stx-out u1000000) token-amount) ;; price in microSTX per token
    })
  )
)

;; Get current spot price (in microSTX per token)
(define-read-only (get-spot-price)
  (let (
      (token-reserve-amount (var-get token-reserve))
      (stx-reserve-amount (var-get stx-reserve))
    )
    (if (and (> token-reserve-amount u0) (> stx-reserve-amount u0))
      (ok (/ (* stx-reserve-amount u1000000) token-reserve-amount))
      (err ERR-INSUFFICIENT-LIQUIDITY)
    )
  )
)

;; Get current reserves
(define-read-only (get-reserves)
  (ok {
    token-reserve: (var-get token-reserve),
    stx-reserve: (var-get stx-reserve),
    lp-total-supply: (ft-get-supply lp-token)
  })
)

;; Get AMM details
(define-read-only (get-amm-details)
  (ok {
    token-contract: TOKEN-CONTRACT,
    trading-enabled: (var-get trading-enabled),
    token-reserve: (var-get token-reserve),
    stx-reserve: (var-get stx-reserve),
    accumulated-fees: (var-get total-fees-collected),
    liquidity-token-tax: (var-get liquidity-token-tax),
    redistributed-stx: (var-get redistributed-stx),
    contract-owner: (var-get contract-owner)
  })
)

;; Add emergency token recovery (in case tokens get stuck)
(define-public (recover-tokens (token-trait <sip-010-trait>) (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    ;; Don't allow recovery of the primary trading token unless in emergency
    (asserts! (not (is-eq TOKEN-CONTRACT (contract-of token-trait))) ERR-UNAUTHORIZED-TOKEN)
    (try! (as-contract (contract-call? token-trait transfer amount tx-sender recipient none)))
    (ok true)
  )
)

;; Emergency withdraw STX
(define-public (recover-stx (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (try! (as-contract (stx-transfer? amount tx-sender recipient)))
    (ok true)
  )
)

;; Set trading status
(define-public (set-trading-status (enabled bool))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (var-set trading-enabled enabled)
    (ok enabled)
  )
)

;; Update LP token URI
(define-public (set-lp-token-uri (new-uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (var-set lp-token-uri new-uri)
    (ok true)
  )
)

;; Transfer ownership
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (var-set contract-owner new-owner)
    (ok true)
  )
)
