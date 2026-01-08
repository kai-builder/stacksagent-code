;;  ---------------------------------------------------------
;; SIP-10 Taxed Fungible Token Contract | Modified from STXCITY Token
;; ---------------------------------------------------------

;; Implements a token with a 10% tax on all transfers distributed as follows:
;; - 4% automatically provides liquidity to AMM contract
;; - 4% redistributed to STX, held by AMM contract
;; - 2% burned to make the token deflationary

;; Errors 
(define-constant ERR-UNAUTHORIZED u401)
(define-constant ERR-NOT-OWNER u402)
(define-constant ERR-INVALID-PARAMETERS u403)
(define-constant ERR-NOT-ENOUGH-FUND u101)
(define-constant ERR-NOT-AMM-CONTRACT u501)

(impl-trait .sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant MAXSUPPLY u10000000000000000)  ;; 10 billion with 6 decimals
(define-constant LIQUIDITY-TAX-PERCENT u4)     ;; 4% for liquidity
(define-constant STX-REDISTRIBUTION-PERCENT u4) ;; 4% redistributed to STX
(define-constant BURN-TAX-PERCENT u2)          ;; 2% burned
(define-constant TOTAL-TAX-PERCENT u10)         ;; 10% total tax
;; No burn address needed as we use ft-burn? directly

;; Variables
(define-fungible-token TAXED-TOKEN MAXSUPPLY)
(define-data-var contract-owner principal tx-sender) 

;; Hardcoded AMM contract address - this creates a permanent 1:1 relationship
(define-constant AMM-CONTRACT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.taxed-token-amm)

;; Check if caller is the AMM contract
(define-read-only (is-amm-contract (caller principal))
    (is-eq caller AMM-CONTRACT)
)

;; SIP-10 Functions with tax mechanism
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq from tx-sender) (err ERR-UNAUTHORIZED))
        
        ;; Skip tax for transfers to/from AMM contract to avoid double taxation
        (if (or (is-amm-contract from) (is-amm-contract to))
            (ft-transfer? TAXED-TOKEN amount from to)
            (apply-tax-and-transfer amount from to memo)
        )
    )
)

;; Apply tax and transfer remaining amount
(define-private (apply-tax-and-transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (let (
        (liquidity-amount (/ (* amount LIQUIDITY-TAX-PERCENT) u100))
        (stx-redistribution-amount (/ (* amount STX-REDISTRIBUTION-PERCENT) u100))
        (burn-amount (/ (* amount BURN-TAX-PERCENT) u100))
        (recipient-amount (- amount (+ liquidity-amount (+ stx-redistribution-amount burn-amount))))
        (amm-contract-principal (var-get amm-contract))
    )
        ;; Transfer main amount to recipient
        (try! (ft-transfer? TAXED-TOKEN recipient-amount from to))
        
        ;; Transfer liquidity amount to AMM contract
        (try! (ft-transfer? TAXED-TOKEN liquidity-amount from amm-contract-principal))
        
        ;; Transfer STX redistribution amount to AMM contract
        (try! (ft-transfer? TAXED-TOKEN stx-redistribution-amount from amm-contract-principal))
        
        ;; Burn the burn amount using ft-burn? to reduce circulating supply
        (try! (ft-burn? TAXED-TOKEN burn-amount from))
        
        ;; Notify the AMM contract about the tax collection (it will handle the rest)
        (as-contract (contract-call? amm-contract-principal process-tax-collection liquidity-amount stx-redistribution-amount))
    )
)

;; Public function to allow the AMM contract to transfer tokens without tax
;; This is needed for AMM operations to avoid double taxation
(define-public (transfer-from-amm (amount uint) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-amm-contract tx-sender) (err ERR-NOT-AMM-CONTRACT))
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
)
