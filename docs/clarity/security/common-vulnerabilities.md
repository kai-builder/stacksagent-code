# Common Clarity Smart Contract Vulnerabilities

## Critical Severity

### 1. Unchecked Return Values
**Description**: Failing to check return values from critical operations like `stx-transfer?`, `ft-transfer?`, or `nft-transfer?`.

**Example (Vulnerable)**:
```clarity
(stx-transfer? amount tx-sender recipient)
;; No check if transfer succeeded
```

**Example (Secure)**:
```clarity
(try! (stx-transfer? amount tx-sender recipient))
;; Or
(unwrap! (stx-transfer? amount tx-sender recipient) err-transfer-failed)
```

**CWE**: CWE-252 (Unchecked Return Value)

---

### 2. Missing Access Controls
**Description**: Public functions that modify state without checking `tx-sender` authorization.

**Example (Vulnerable)**:
```clarity
(define-public (update-config (new-value uint))
  (ok (var-set config-value new-value)))
;; Anyone can update config!
```

**Example (Secure)**:
```clarity
(define-public (update-config (new-value uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (var-set config-value new-value))))
```

**CWE**: CWE-284 (Improper Access Control)

---

## High Severity

### 3. Missing Input Validation
**Description**: Public functions that don't validate input parameters.

**Example (Vulnerable)**:
```clarity
(define-public (transfer (amount uint) (recipient principal))
  (stx-transfer? amount tx-sender recipient))
;; No check if amount > 0
```

**Example (Secure)**:
```clarity
(define-public (transfer (amount uint) (recipient principal))
  (begin
    (asserts! (> amount u0) err-invalid-amount)
    (try! (stx-transfer? amount tx-sender recipient))
    (ok true)))
```

**CWE**: CWE-20 (Improper Input Validation)

---

### 4. Unsafe STX Transfers
**Description**: Using `stx-transfer?` without proper validation checks.

**Example (Vulnerable)**:
```clarity
(define-public (withdraw (amount uint))
  (as-contract (stx-transfer? amount tx-sender tx-sender)))
;; No balance check!
```

**Example (Secure)**:
```clarity
(define-public (withdraw (amount uint))
  (let ((balance (get-balance tx-sender)))
    (asserts! (>= balance amount) err-insufficient-balance)
    (asserts! (> amount u0) err-invalid-amount)
    (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))
    (ok true)))
```

---

## Medium Severity

### 5. tx-sender vs contract-caller Confusion
**Description**: Mixing `tx-sender` and `contract-caller` inappropriately can lead to authorization bypass.

**Example (Vulnerable)**:
```clarity
(define-public (admin-action)
  (begin
    (asserts! (is-eq contract-caller admin) err-unauthorized)
    ;; If called via another contract, contract-caller != tx-sender
    ...))
```

**Example (Secure)**:
```clarity
(define-public (admin-action)
  (begin
    (asserts! (is-eq tx-sender admin) err-unauthorized)
    ;; Always validates the original transaction sender
    ...))
```

---

### 6. Front-Running Vulnerabilities
**Description**: Publicly visible transactions that can be front-run for profit.

**Mitigation**:
- Use commit-reveal schemes for sensitive operations
- Add deadlines to prevent stale transactions
- Implement slippage protection for DEX operations

---

## Low Severity

### 7. Improper Error Handling
**Description**: Using `unwrap!` or `unwrap-panic` without proper error handling.

**Example (Risky)**:
```clarity
(unwrap! (some-operation) (err u999))
;; Transaction will abort with generic error
```

**Example (Better)**:
```clarity
(try! (some-operation))
;; Or use match for more control
(match (some-operation)
  success (ok success)
  error (err err-operation-failed))
```

---

## Prevention Checklist

- [ ] All `stx-transfer?`, `ft-transfer?`, `nft-transfer?` are wrapped with `try!` or checked
- [ ] All public state-modifying functions check `tx-sender`
- [ ] All public functions validate input parameters with `asserts!`
- [ ] Error codes are defined as constants
- [ ] No use of `unwrap-panic` in production code
- [ ] Front-running risks are considered for financial operations
- [ ] External contract calls are validated
- [ ] All maps have appropriate access controls
