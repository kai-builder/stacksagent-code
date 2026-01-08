;; Simple Counter Contract
;; Demonstrates basic Clarity concepts

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-invalid-increment (err u101))

;; Data variables
(define-data-var counter uint u0)
(define-data-var max-increment uint u10)

;; Public functions

(define-public (increment (amount uint))
  (begin
    ;; Validate input
    (asserts! (> amount u0) err-invalid-increment)
    (asserts! (<= amount (var-get max-increment)) err-invalid-increment)

    ;; Update counter
    (ok (var-set counter (+ (var-get counter) amount)))))

(define-public (decrement (amount uint))
  (let ((current (var-get counter)))
    ;; Validate input
    (asserts! (> amount u0) err-invalid-increment)
    (asserts! (<= amount current) err-invalid-increment)

    ;; Update counter
    (ok (var-set counter (- current amount)))))

(define-public (reset)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (var-set counter u0))))

(define-public (set-max-increment (new-max uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> new-max u0) err-invalid-increment)
    (ok (var-set max-increment new-max))))

;; Read-only functions

(define-read-only (get-counter)
  (ok (var-get counter)))

(define-read-only (get-max-increment)
  (ok (var-get max-increment)))
