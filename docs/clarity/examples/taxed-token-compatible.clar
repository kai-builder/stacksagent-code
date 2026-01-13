;;  ---------------------------------------------------------
;; SIP-10 Taxed Fungible Token Contract | Compatible with External AMMs
;; ---------------------------------------------------------

;; Implements a token with a 10% tax on all transfers distributed as follows:
;; - 4% automatically provides liquidity to AMM contract (2% tokens + 2% converted to STX)
;; - 4% redistributed to STX treasury
;; - 2% burned to make the token deflationary

;; Errors 
(define-constant ERR-UNAUTHORIZED u401)
(define-constant ERR-NOT-OWNER u402)
(define-constant ERR-INVALID-PARAMETERS u403)
(define-constant ERR-NOT-ENOUGH-FUND u101)
(define-constant ERR-NOT-AMM-CONTRACT u501)
(define-constant ERR-SWAP-FAILED u502)
(define-constant ERR-ADD-LIQUIDITY-FAILED u503)

(impl-trait .sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant MAXSUPPLY u10000000000000000)  ;; 10 billion with 6 decimals
(define-constant LIQUIDITY-TAX-PERCENT u4)     ;; 4% for liquidity (2% tokens + 2% converted to STX)
(define-constant STX-REDISTRIBUTION-PERCENT u4) ;; 4% redistributed to STX treasury
(define-constant BURN-TAX-PERCENT u2)          ;; 2% burned
(define-constant TOTAL-TAX-PERCENT u10)         ;; 10% total tax

;; AMM Constants
(define-constant AMM-CONTRACT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.alex-amm)
(define-constant STX-CONTRACT 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx)
(define-constant POOL-FACTOR u1000000) ;; Standard pool factor for ALEX AMM
(define-constant TREASURY-WALLET 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) ;; Treasury wallet for STX redistribution

;; Variables
(define-fungible-token TAXED-TOKEN MAXSUPPLY)
(define-data-var contract-owner principal tx-sender)
(define-data-var whitelisted-contracts (list 10 principal) (list)) ;; Contracts that bypass tax

;; Whitelist management
(define-public (add-to-whitelist (contract-principal principal))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
        (var-set whitelisted-contracts (append (var-get whitelisted-contracts) contract-principal))
        (ok true)
    )
)

(define-public (remove-from-whitelist (contract-principal principal))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
        (var-set whitelisted-contracts (filter remove-principal (var-get whitelisted-contracts)))
        (ok true)
    )
)

(define-private (remove-principal (p principal))
    (not (is-eq p contract-principal))
)

(define-read-only (is-whitelisted (address principal))
    (is-some (index-of (var-get whitelisted-contracts) address))
)

;; SIP-10 Functions with tax mechanism
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq from tx-sender) (err ERR-UNAUTHORIZED))
        
        ;; Skip tax for transfers to/from whitelisted contracts
        (if (or (is-whitelisted from) (is-whitelisted to))
            (ft-transfer? TAXED-TOKEN amount from to)
            (apply-tax-and-transfer amount from to memo)
        )
    )
)

;; Apply tax and transfer remaining amount
(define-private (apply-tax-and-transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (let (
        ;; Calculate tax amounts
        (burn-amount (/ (* amount BURN-TAX-PERCENT) u100))
        (liquidity-token-amount (/ (* amount u2) u100)) ;; 2% tokens for LP
        (liquidity-swap-amount (/ (* amount u2) u100))  ;; 2% tokens to swap for STX for LP
        (treasury-amount (/ (* amount STX-REDISTRIBUTION-PERCENT) u100))
        (recipient-amount (- amount (+ burn-amount (+ liquidity-token-amount (+ liquidity-swap-amount treasury-amount)))))
    )
        ;; 1. Transfer main amount to recipient
        (try! (ft-transfer? TAXED-TOKEN recipient-amount from to))
        
        ;; 2. Burn the burn amount
        (try! (ft-burn? TAXED-TOKEN burn-amount from))
        
        ;; 3. Transfer liquidity token amount to contract for later use
        (try! (ft-transfer? TAXED-TOKEN liquidity-token-amount from (as-contract tx-sender)))
        
        ;; 4. Transfer liquidity swap amount to contract for swapping
        (try! (ft-transfer? TAXED-TOKEN liquidity-swap-amount from (as-contract tx-sender)))
        
        ;; 5. Transfer treasury amount to contract for swapping/distribution
        (try! (ft-transfer? TAXED-TOKEN treasury-amount from (as-contract tx-sender)))
        
        ;; 6. Process the tax (swap and add liquidity)
        (as-contract (process-tax liquidity-token-amount liquidity-swap-amount treasury-amount))
    )
)

;; Process tax by swapping tokens and adding liquidity
(define-private (process-tax (liquidity-token-amount uint) (liquidity-swap-amount uint) (treasury-amount uint))
    (begin
        ;; Only process if we have amounts to process
        (if (and (> liquidity-swap-amount u0) (> treasury-amount u0))
            (begin
                ;; 1. Swap liquidity-swap-amount for STX to pair with liquidity-token-amount
                (let (
                    (swap-result (try! (contract-call? 
                        AMM-CONTRACT 
                        swap-helper 
                        .taxed-token-compatible 
                        STX-CONTRACT 
                        POOL-FACTOR 
                        liquidity-swap-amount 
                        none)))
                )
                    ;; 2. Add liquidity with the tokens and STX we got from swap
                    (if (and (> liquidity-token-amount u0) (> swap-result u0))
                        (try! (contract-call? 
                            AMM-CONTRACT 
                            add-to-position 
                            .taxed-token-compatible 
                            STX-CONTRACT 
                            POOL-FACTOR 
                            liquidity-token-amount 
                            (some swap-result)))
                        (ok true)
                    )
                    
                    ;; 3. Swap treasury amount for STX and send to treasury
                    (let (
                        (treasury-swap-result (try! (contract-call? 
                            AMM-CONTRACT 
                            swap-helper 
                            .taxed-token-compatible 
                            STX-CONTRACT 
                            POOL-FACTOR 
                            treasury-amount 
                            none)))
                    )
                        ;; Send STX to treasury wallet
                        (stx-transfer? treasury-swap-result tx-sender TREASURY-WALLET)
                    )
                )
            )
            (ok true)
        )
    )
)

;; Public function to allow transfers from whitelisted AMM contracts without tax
(define-public (transfer-from-amm (amount uint) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-whitelisted tx-sender) (err ERR-NOT-AMM-CONTRACT))
        (as-contract (ft-transfer? TAXED-TOKEN amount tx-sender to))
    )
)

;; Public function to allow the AMM contract to transfer tokens without tax
;; This is needed for AMM operations to avoid double taxation
(define-public (transfer-from-amm (amount uint) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-whitelisted tx-sender) (err ERR-NOT-AMM-CONTRACT))
        (as-contract (ft-transfer? TAXED-TOKEN amount tx-sender to))
    )
)

;; DEFINE METADATA
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://example.com/taxed-token-metadata.json"))

(define-public (set-token-uri (value (string-utf8 256)))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
        (var-set token-uri (some value))
        (ok (print {
              notification: "token-metadata-update",
              payload: {
                contract-id: (as-contract tx-sender),
                token-class: "ft"
              }
            })
        )
    )
)

(define-read-only (get-balance (owner principal))
  (ok (ft-get-balance TAXED-TOKEN owner))
)

(define-read-only (get-name)
  (ok "Taxed Token")
)

(define-read-only (get-symbol)
  (ok "TAXT")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply TAXED-TOKEN))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

(define-read-only (get-owner)
  (ok (var-get contract-owner))
)

;; transfer ownership
(define-public (transfer-ownership (new-owner principal))
  (begin
    ;; Checks if the sender is the current owner
    (if (is-eq tx-sender (var-get contract-owner))
      (begin
        ;; Sets the new owner
        (var-set contract-owner new-owner)
        ;; Returns success message
        (ok "Ownership transferred successfully"))
      ;; Error if the sender is not the owner
      (err ERR-NOT-OWNER)))
)

;; Utility Functions
(define-public (send-many (recipients (list 200 { to: principal, amount: uint, memo: (optional (buff 34)) })))
  (fold check-err (map send-token recipients) (ok true))
)

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
  (match prior ok-value result err-value (err err-value))
)

(define-private (send-token (recipient { to: principal, amount: uint, memo: (optional (buff 34)) }))
  (send-token-with-memo (get amount recipient) (get to recipient) (get memo recipient))
)

(define-private (send-token-with-memo (amount uint) (to principal) (memo (optional (buff 34))))
  (let ((transferOk (try! (transfer amount tx-sender to memo))))
    (ok transferOk)
  )
)

;; Initial minting of tokens to the contract owner
(begin
    (try! (ft-mint? TAXED-TOKEN MAXSUPPLY (var-get contract-owner)))
    
    ;; Add AMM-CONTRACT to whitelist by default
    (var-set whitelisted-contracts (append (var-get whitelisted-contracts) AMM-CONTRACT))
)
