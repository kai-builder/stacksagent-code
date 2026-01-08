;; Example Fungible Token - SIP-010 Compliant
;; Full implementation with all features

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-insufficient-balance (err u102))
(define-constant err-invalid-amount (err u103))

;; Token definitions
(define-fungible-token example-token u1000000000000)

;; Data variables
(define-data-var token-uri (optional (string-utf8 256)) none)

;; Initialize - mint total supply to contract owner
(begin
  (try! (ft-mint? example-token u1000000000000 contract-owner))
)

;; SIP-010 Functions

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-token-owner)
    (asserts! (> amount u0) err-invalid-amount)
    (try! (ft-transfer? example-token amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)))

(define-read-only (get-name)
  (ok "Example Token"))

(define-read-only (get-symbol)
  (ok "EXMPL"))

(define-read-only (get-decimals)
  (ok u6))

(define-read-only (get-balance (who principal))
  (ok (ft-get-balance example-token who)))

(define-read-only (get-total-supply)
  (ok (ft-get-supply example-token)))

(define-read-only (get-token-uri)
  (ok (var-get token-uri)))

;; Additional Functions

(define-public (set-token-uri (new-uri (string-utf8 256)))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (var-set token-uri (some new-uri)))))

;; Burn function
(define-public (burn (amount uint))
  (begin
    (asserts! (> amount u0) err-invalid-amount)
    (ft-burn? example-token amount tx-sender)))

;; Mint function (owner only)
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> amount u0) err-invalid-amount)
    (ft-mint? example-token amount recipient)))
