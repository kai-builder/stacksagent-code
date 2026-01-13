# Clarity Smart Contract Best Practices

## Naming Conventions

### Use kebab-case for All Identifiers
```clarity
;; Good
(define-public (transfer-tokens (amount uint))

;; Bad
(define-public (transferTokens (amount uint))
(define-public (transfer_tokens (amount uint))
```

### Descriptive Error Codes
```clarity
;; Good
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-invalid-amount (err u102))

;; Bad
(define-constant error1 (err u1))
(define-constant e (err u100))
```

---

## Code Organization

### Structure Your Contract
1. Comments/documentation header
2. Trait implementations
3. Constants (including error codes)
4. Data variables
5. Data maps
6. Private functions
7. Public functions
8. Read-only functions

**Example**:
```clarity
;; My Token Contract
;; Implements SIP-010 fungible token standard

(impl-trait 'SP...sip-010-trait)

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))

;; Data variables
(define-data-var token-name (string-ascii 32) "MyToken")

;; Data maps
(define-map balances principal uint)

;; Private functions
(define-private (is-owner)
  (is-eq tx-sender contract-owner))

;; Public functions
(define-public (transfer ...)
  ...)

;; Read-only functions
(define-read-only (get-balance (who principal))
  ...)
```

---

## Error Handling

### Always Handle Errors Explicitly
```clarity
;; Good
(try! (stx-transfer? amount tx-sender recipient))

;; Better (with context)
(unwrap! (stx-transfer? amount tx-sender recipient) err-transfer-failed)

;; Best (with detailed handling)
(match (stx-transfer? amount tx-sender recipient)
  success (ok true)
  error (err err-transfer-failed))
```

### Use Descriptive Error Codes
```clarity
;; Define errors with clear naming and sequential numbers
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-insufficient-balance (err u102))
(define-constant err-invalid-amount (err u103))
(define-constant err-transfer-failed (err u104))
```

---

## Access Control

### Always Validate tx-sender
```clarity
(define-public (admin-function)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    ;; Admin logic here
    (ok true)))
```

### Use Helper Functions for Access Control
```clarity
(define-private (is-owner)
  (is-eq tx-sender contract-owner))

(define-private (is-authorized (account principal))
  (or (is-owner)
      (default-to false (map-get? authorized-users account))))

(define-public (protected-action)
  (begin
    (asserts! (is-authorized tx-sender) err-unauthorized)
    ;; Logic here
    (ok true)))
```

---

## Input Validation

### Validate All Public Function Inputs
```clarity
(define-public (transfer (amount uint) (recipient principal))
  (begin
    ;; Validate amount
    (asserts! (> amount u0) err-invalid-amount)

    ;; Validate recipient is not sender
    (asserts! (not (is-eq tx-sender recipient)) err-invalid-recipient)

    ;; Validate sufficient balance
    (asserts! (>= (get-balance tx-sender) amount) err-insufficient-balance)

    ;; Perform transfer
    (try! (ft-transfer? token amount tx-sender recipient))
    (ok true)))
```

---

## Gas Optimization

### Cache Repeated Map Reads
```clarity
;; Bad - reads map 3 times
(define-read-only (get-total)
  (+ (default-to u0 (map-get? balances user-a))
     (default-to u0 (map-get? balances user-a))
     (default-to u0 (map-get? balances user-a))))

;; Good - reads once
(define-read-only (get-total)
  (let ((balance (default-to u0 (map-get? balances user-a))))
    (+ balance balance balance)))
```

### Use Let Bindings for Complex Computations
```clarity
;; Good
(define-public (complex-operation)
  (let (
    (user-balance (get-balance tx-sender))
    (fee (/ (* user-balance u250) u10000))
    (net-amount (- user-balance fee))
  )
    ;; Use computed values
    (try! (transfer-internal net-amount))
    (ok fee)))
```

---

## Documentation

### Add Comments for Complex Logic
```clarity
;; Calculate platform fee (2.5% = 250 basis points)
;; Formula: (amount * 250) / 10000
(define-private (calculate-fee (amount uint))
  (/ (* amount u250) u10000))
```

### Document Public Interfaces
```clarity
;; @desc Transfers tokens from sender to recipient
;; @param amount: The amount of tokens to transfer (must be > 0)
;; @param recipient: The principal receiving the tokens
;; @returns (ok true) on success, error code on failure
(define-public (transfer (amount uint) (recipient principal))
  ...)
```

---

## Testing Checklist

Before deploying:
- [ ] All public functions have input validation
- [ ] All state-changing functions have access controls
- [ ] Error codes are well-defined and documented
- [ ] Code follows naming conventions (kebab-case)
- [ ] Complex logic has explanatory comments
- [ ] No `unwrap-panic` in production code
- [ ] All external calls are error-handled
- [ ] Gas optimizations applied where appropriate
- [ ] Contract tested on testnet
- [ ] Security audit performed (for high-value contracts)

---

## Common Patterns

### Safe Math (Clarity prevents overflow/underflow by default)
```clarity
;; Clarity automatically errors on overflow
(+ u18446744073709551615 u1) ;; Will error, not wrap
```

### Pausable Pattern
```clarity
(define-data-var paused bool false)

(define-public (pause)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (var-set paused true))))

(define-public (unpause)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (var-set paused false))))

(define-private (require-not-paused)
  (asserts! (not (var-get paused)) err-contract-paused))
```

### Reentrancy Protection (Built into Clarity)
Clarity's design prevents reentrancy by not allowing external contract calls during state changes. No additional protection needed.
