;; STXCITY Token Lock and Vest Contract

(use-trait ft-trait .sip-010-trait-ft-standard.sip-010-trait)

;; ERRORS

(define-constant ERR-INVALID-TOKEN (err u7003))
(define-constant ERR-NOTHING-TO-CLAIM (err u7006))
(define-constant ERR-CLIFF-PERIOD-NOT-ENDED (err u7007))
(define-constant ERR-ZERO-AMOUNT (err u5002))
(define-constant ERR-NO-LOCKED-TOKENS (err u7008))
(define-constant ERR-MILESTONE-CONFIGURATION (err u7009))

;; CONSTANTS
(define-constant ONE_6 u1000000)

;; Vesting milestone constants
;; These define the block heights and percentages for token vesting
;; IMPORTANT: When customizing milestones, follow these rules:
;; 1. Milestone percentages MUST be in ascending order (each one higher than the previous)
;; 2. The final active milestone MUST be set to 100% (u100)
;; 3. If using fewer milestones, adjust ACTIVE_MILESTONE_COUNT accordingly (1-5)

;; Block heights (relative to lock start)
(define-constant MILESTONE_1_BLOCKS u0)      ;; Immediate - 20% unlocked right after cliff period
(define-constant MILESTONE_2_BLOCKS u500)    ;; ~3.5 days - 40% unlocked
(define-constant MILESTONE_3_BLOCKS u1000)   ;; 7 days - 60% unlocked
(define-constant MILESTONE_4_BLOCKS u1500)   ;; 10.4 days - 80% unlocked
(define-constant MILESTONE_5_BLOCKS u2100)   ;; 14.6 days - 100% unlocked

;; Vesting percentages at each milestone
(define-constant MILESTONE_1_PERCENT u20)    ;; 20%
(define-constant MILESTONE_2_PERCENT u40)    ;; 40%
(define-constant MILESTONE_3_PERCENT u60)    ;; 60%
(define-constant MILESTONE_4_PERCENT u80)    ;; 80%
(define-constant MILESTONE_5_PERCENT u100)   ;; 100% - final milestone

;; Set how many milestones are actually used (1-5)
(define-constant ACTIVE_MILESTONE_COUNT u5)

;; Cliff period in blocks before vesting begins
(define-constant CLIFF_PERIOD_BLOCKS u0)

;; STATE VARIABLES

;; Track total tokens locked across all wallets
(define-data-var total-locked-tokens uint u0)

;; Token contract that this lock contract serves
(define-constant TOKEN_CONTRACT .stxcity-token)

;; MAPS
(define-map locked-tokens
    { user-addr: principal }
    uint
)

(define-map claimed-amounts
    { user-addr: principal }
    uint
)

(define-map lock-start-heights
    { user-addr: principal }
    uint
)

;; READ-ONLY FUNCTIONS

(define-read-only (get-total-locked-tokens)
  (var-get total-locked-tokens)
)

(define-read-only (get-vesting-schedule)
  (ok {
    milestone1: {blocks: MILESTONE_1_BLOCKS, percent: MILESTONE_1_PERCENT},
    milestone2: {blocks: MILESTONE_2_BLOCKS, percent: MILESTONE_2_PERCENT},
    milestone3: {blocks: MILESTONE_3_BLOCKS, percent: MILESTONE_3_PERCENT},
    milestone4: {blocks: MILESTONE_4_BLOCKS, percent: MILESTONE_4_PERCENT},
    milestone5: {blocks: MILESTONE_5_BLOCKS, percent: MILESTONE_5_PERCENT},
    cliff-period: CLIFF_PERIOD_BLOCKS
  })
)

(define-read-only (get-locked-amount (user-addr principal))
  (default-to u0 (map-get? locked-tokens {user-addr: user-addr}))
)

(define-read-only (get-claimed-amount (user-addr principal))
  (default-to u0 (map-get? claimed-amounts {user-addr: user-addr}))
)

(define-read-only (get-lock-start-height (user-addr principal))
  (default-to u0 (map-get? lock-start-heights {user-addr: user-addr}))
)

(define-read-only (get-claimable-amount (user principal))
  (let
    (
      (locked (get-locked-amount user))
      (claimed (get-claimed-amount user))
      (lock-start (get-lock-start-height user))
      (current-block burn-block-height)
    )
    ;; Check if user has locked tokens and cliff period has passed
    (if (and (> lock-start u0) (>= current-block (+ lock-start CLIFF_PERIOD_BLOCKS)))
      (let
        (
          (vested-percent (get-vested-percentage user))
          (vested-amount (/ (* locked vested-percent) u100))
        )
        ;; Ensure result is never negative
        (if (>= vested-amount claimed)
          (- vested-amount claimed)
          u0)
      )
      u0
    )
  )
)

(define-read-only (get-lock-info)
  (ok {
    token-contract: TOKEN_CONTRACT,
    total-locked-tokens: (var-get total-locked-tokens),
    cliff-period: CLIFF_PERIOD_BLOCKS,
    active-milestone-count: ACTIVE_MILESTONE_COUNT,
    milestones: (get-vesting-schedule)
  })
)

(define-read-only (get-user-info (user principal))
  (let
    (
      (locked (get-locked-amount user))
      (claimed (get-claimed-amount user))
      (vested-percent (get-vested-percentage user))
      (vested-amount (/ (* locked vested-percent) u100))
      (lock-start (get-lock-start-height user))
    )
    (ok
      {
        locked: locked,
        claimed: claimed,
        claimable: (get-claimable-amount user),
        lock-start-height: lock-start,
        current-block: burn-block-height,
        vested-percent: vested-percent,
        vested-amount: vested-amount,
        cliff-ended: (>= burn-block-height (+ lock-start CLIFF_PERIOD_BLOCKS)),
        milestones: (get-vesting-schedule),
        active-milestone-count: ACTIVE_MILESTONE_COUNT,
        total-locked-tokens: (var-get total-locked-tokens)
      }
    )
  )
)


;; PUBLIC FUNCTIONS

(define-public (lock-tokens (token-trait <ft-trait>) (amount uint))
  (let
    (
      (user tx-sender)
      (current-locked (get-locked-amount user))
      (current-start (get-lock-start-height user))
    )
    (asserts! (is-eq (contract-of token-trait) TOKEN_CONTRACT) ERR-INVALID-TOKEN)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    
    ;; Transfer tokens to this contract
    (try! (contract-call? token-trait transfer amount user (as-contract tx-sender) none))
    
    ;; Update locked amount
    (map-set locked-tokens {user-addr: user} (+ current-locked amount))
    
    ;; Update total locked tokens
    (var-set total-locked-tokens (+ (var-get total-locked-tokens) amount))
    
    ;; Set lock start height if not already set
    (if (is-eq current-start u0)
      (map-set lock-start-heights {user-addr: user} burn-block-height)
      true
    )
    
    (print {
      type: "lock-tokens",
      user: user,
      amount: amount,
      total-locked: (+ current-locked amount),
      lock-start: (if (is-eq current-start u0) burn-block-height current-start)
    })
    
    (ok true)
  )
)

(define-public (claim (token-trait <ft-trait>))
  (let
    (
      (user tx-sender)
      (claimable (get-claimable-amount user))
      (lock-start (get-lock-start-height user))
    )
    (asserts! (is-eq (contract-of token-trait) TOKEN_CONTRACT) ERR-INVALID-TOKEN)
    (asserts! (>= burn-block-height (+ lock-start CLIFF_PERIOD_BLOCKS)) ERR-CLIFF-PERIOD-NOT-ENDED)
    (asserts! (> (get-locked-amount user) u0) ERR-NO-LOCKED-TOKENS)
    (asserts! (> claimable u0) ERR-NOTHING-TO-CLAIM)
    
    ;; Process claim - transfer tokens from contract to user
    (try! (as-contract (contract-call? token-trait transfer claimable tx-sender user none)))
    
    ;; Update claimed amount in the ledger
    (map-set claimed-amounts {user-addr: user} 
      (+ (get-claimed-amount user) claimable))
    
    ;; Update total locked tokens (reduce by claimed amount)
    (var-set total-locked-tokens (- (var-get total-locked-tokens) claimable))
    
    (print {
      type: "claim",
      user: user,
      amount: claimable,
      total-claimed: (+ (get-claimed-amount user) claimable)
    })
    
    (ok claimable)
  )
)

;; PRIVATE FUNCTIONS

(define-private (validate-milestone-percentages)
  (let
    (
      ;; Check that we have a valid number of milestones (1-5)
      (valid-milestone-count (and (>= ACTIVE_MILESTONE_COUNT u1) (<= ACTIVE_MILESTONE_COUNT u5)))
      
      ;; Check that the last active milestone is 100%
      (last-milestone (unwrap! (element-at? 
                                (list MILESTONE_1_PERCENT MILESTONE_2_PERCENT MILESTONE_3_PERCENT MILESTONE_4_PERCENT MILESTONE_5_PERCENT) 
                                (- ACTIVE_MILESTONE_COUNT u1)) 
                               ERR-MILESTONE-CONFIGURATION))
      (last-milestone-is-100 (is-eq last-milestone u100))
      
      ;; Check that milestones are in ascending order
      (milestones-ascending (and 
                             (< MILESTONE_1_PERCENT MILESTONE_2_PERCENT)
                             (< MILESTONE_2_PERCENT MILESTONE_3_PERCENT)
                             (< MILESTONE_3_PERCENT MILESTONE_4_PERCENT)
                             (< MILESTONE_4_PERCENT MILESTONE_5_PERCENT)))
    )
    ;; Combine all validation checks
    (asserts! valid-milestone-count ERR-MILESTONE-CONFIGURATION)
    (asserts! last-milestone-is-100 ERR-MILESTONE-CONFIGURATION)
    (asserts! milestones-ascending ERR-MILESTONE-CONFIGURATION)
    
    (ok true)
  )
)

(define-private (get-vested-percentage (user principal))
  (let  
    (
      (current-block burn-block-height)
      (lock-start (get-lock-start-height user))
    )
    ;; Check if user has locked tokens and cliff period has passed
    (if (and (> lock-start u0) (>= current-block (+ lock-start CLIFF_PERIOD_BLOCKS)))
      (let
        (
          (blocks-since-start (- current-block (+ lock-start CLIFF_PERIOD_BLOCKS)))
        )
        ;; Call the appropriate function based on ACTIVE_MILESTONE_COUNT
        (if (is-eq ACTIVE_MILESTONE_COUNT u1)
          (get-vested-percent-1-milestone blocks-since-start)
          (if (is-eq ACTIVE_MILESTONE_COUNT u2)
            (get-vested-percent-2-milestones blocks-since-start)
            (if (is-eq ACTIVE_MILESTONE_COUNT u3)
              (get-vested-percent-3-milestones blocks-since-start)
              (if (is-eq ACTIVE_MILESTONE_COUNT u4)
                (get-vested-percent-4-milestones blocks-since-start)
                (get-vested-percent-5-milestones blocks-since-start) ;; Default to 5 milestones
              )
            )
          )
        )
      )
      u0 ;; No tokens locked or cliff period not ended
    )
  )
)

(define-private (get-vested-percent-1-milestone (blocks-since-start uint))
  ;; With 1 milestone, 100% is unlocked immediately after cliff
  MILESTONE_1_PERCENT
)

(define-private (get-vested-percent-2-milestones (blocks-since-start uint))
  (if (< blocks-since-start MILESTONE_2_BLOCKS)
    MILESTONE_1_PERCENT
    MILESTONE_2_PERCENT
  )
)

(define-private (get-vested-percent-3-milestones (blocks-since-start uint))
  (if (< blocks-since-start MILESTONE_2_BLOCKS)
    MILESTONE_1_PERCENT
    (if (< blocks-since-start MILESTONE_3_BLOCKS)
      MILESTONE_2_PERCENT
      MILESTONE_3_PERCENT
    )
  )
)

(define-private (get-vested-percent-4-milestones (blocks-since-start uint))
  (if (< blocks-since-start MILESTONE_2_BLOCKS)
    MILESTONE_1_PERCENT
    (if (< blocks-since-start MILESTONE_3_BLOCKS)
      MILESTONE_2_PERCENT
      (if (< blocks-since-start MILESTONE_4_BLOCKS)
        MILESTONE_3_PERCENT
        MILESTONE_4_PERCENT
      )
    )
  )
)

(define-private (get-vested-percent-5-milestones (blocks-since-start uint))
  (if (< blocks-since-start MILESTONE_2_BLOCKS)
    MILESTONE_1_PERCENT
    (if (< blocks-since-start MILESTONE_3_BLOCKS)
      MILESTONE_2_PERCENT
      (if (< blocks-since-start MILESTONE_4_BLOCKS)
        MILESTONE_3_PERCENT
        (if (< blocks-since-start MILESTONE_5_BLOCKS)
          MILESTONE_4_PERCENT
          MILESTONE_5_PERCENT
        )
      )
    )
  )
)



;; Contract initialization - automatically runs when contract is deployed
(begin
  ;; Validate milestone configuration
  (try! (validate-milestone-percentages))
  
  (print {
    type: "initialize-lock-contract",
    token-contract: TOKEN_CONTRACT
  })
)