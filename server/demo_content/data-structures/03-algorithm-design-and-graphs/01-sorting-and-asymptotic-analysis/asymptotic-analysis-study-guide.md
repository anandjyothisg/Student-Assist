# Asymptotic Analysis and Recurrences

CS-201 Data Structures and Algorithms · Unit 3 · Study Guide

This guide summarises the notation and techniques used to analyse running time throughout the course. Exam questions on this material usually ask for a formal definition, a proof that one function is O of another, or the solution of a recurrence.

## 1. Asymptotic Notation

Let f and g be functions from non-negative integers to non-negative reals.

- **Big-O (upper bound):** `f(n) = O(g(n))` if there exist constants `c > 0` and `n0` such that `f(n) ≤ c · g(n)` for all `n ≥ n0`.
- **Big-Omega (lower bound):** `f(n) = Ω(g(n))` if there exist `c > 0` and `n0` such that `f(n) ≥ c · g(n)` for all `n ≥ n0`.
- **Big-Theta (tight bound):** `f(n) = Θ(g(n))` if f is both `O(g(n))` and `Ω(g(n))`, that is `c1 · g(n) ≤ f(n) ≤ c2 · g(n)` for all `n ≥ n0`.
- **Little-o:** `f(n) = o(g(n))` if `f(n) / g(n) → 0` as `n → ∞` (strictly smaller growth).
- **Little-omega:** `f(n) = ω(g(n))` if `f(n) / g(n) → ∞`.

### Worked proof

Claim: `3n² + 10n + 5 = O(n²)`.
For `n ≥ 1`, `10n ≤ 10n²` and `5 ≤ 5n²`, so `3n² + 10n + 5 ≤ 18n²`. Choose `c = 18`, `n0 = 1`.

Claim: `3n² + 10n + 5 = Ω(n²)`. For all `n ≥ 1` the expression is at least `3n²`; choose `c = 3`. Therefore it is `Θ(n²)`.

### Important distinctions

- Big-O is a bound, not a case. "Worst case is O(n²)" and "best case is O(n)" are both meaningful statements. It is correct, though uninformative, to say merge sort is O(n³).
- Θ describes a tight bound for a specific function, for example the worst-case running time.
- Constants and lower-order terms are dropped: `O(2n + 7) = O(n)`. Logarithm bases are irrelevant inside O, because `log_a n = log_b n / log_b a`.

## 2. Growth-Rate Hierarchy

From slowest to fastest growing:

`1 < log log n < log n < √n < n < n log n < n² < n³ < 2^n < n! < n^n`

Useful facts:

- Any polynomial of log n grows slower than any positive power of n: `(log n)^k = o(n^ε)` for every `k` and every `ε > 0`.
- Any polynomial grows slower than any exponential with base greater than 1: `n^k = o(c^n)` for `c > 1`.
- `log(n!) = Θ(n log n)`.
- `1 + 2 + ... + n = n(n + 1)/2 = Θ(n²)`.
- `1 + 1/2 + 1/3 + ... + 1/n = Θ(log n)` (harmonic series).
- `1 + 2 + 4 + ... + 2^k = 2^(k+1) − 1` (geometric series is dominated by its largest term).

## 3. Analysing Loops

| Code pattern | Running time |
|---|---|
| `for i in range(n)` with O(1) body | Θ(n) |
| Two nested loops each to n | Θ(n²) |
| `j` loops from `i` to n inside `i` loop to n | Θ(n²) (about n²/2 iterations) |
| `i = n; while i > 1: i //= 2` | Θ(log n) |
| Outer loop to n, inner loop doubling to n | Θ(n log n) |
| `for i in 1..n: for j in range(0, n, i)` | Θ(n log n) (harmonic sum) |

```python
def count_pairs(a):
    count = 0
    for i in range(len(a)):          # n iterations
        for j in range(i + 1, len(a)):  # n-1, n-2, ..., 0
            if a[i] + a[j] == 0:
                count += 1
    return count                      # Θ(n²)
```

## 4. Recurrences

A recursive algorithm's running time is described by a recurrence. Three methods are taught:

1. **Substitution:** guess the form, prove it by induction.
2. **Recursion tree:** sum the cost per level. For `T(n) = 2T(n/2) + n`, each of the `log2 n` levels costs n, giving `n log n`.
3. **Master theorem:** a formula for divide-and-conquer recurrences.

### 4.1 The master theorem

For `T(n) = a · T(n/b) + f(n)` with constants `a ≥ 1`, `b > 1`, compare `f(n)` with `n^(log_b a)` (the cost contributed by the leaves):

- **Case 1:** if `f(n) = O(n^(log_b a − ε))` for some `ε > 0` (leaves dominate), then `T(n) = Θ(n^(log_b a))`.
- **Case 2:** if `f(n) = Θ(n^(log_b a))` (all levels contribute equally), then `T(n) = Θ(n^(log_b a) · log n)`.
- **Case 3:** if `f(n) = Ω(n^(log_b a + ε))` for some `ε > 0` (root dominates) **and** the regularity condition `a · f(n/b) ≤ k · f(n)` holds for some `k < 1` and large n, then `T(n) = Θ(f(n))`.

### 4.2 Standard examples

| Recurrence | Algorithm | a, b, n^(log_b a) | Case | Solution |
|---|---|---|---|---|
| `T(n) = T(n/2) + 1` | Binary search | 1, 2, n⁰ = 1 | 2 | Θ(log n) |
| `T(n) = 2T(n/2) + n` | Merge sort | 2, 2, n | 2 | Θ(n log n) |
| `T(n) = 2T(n/2) + 1` | Tree traversal (balanced) | 2, 2, n | 1 | Θ(n) |
| `T(n) = 3T(n/2) + n` | Karatsuba multiplication | 3, 2, n^1.585 | 1 | Θ(n^1.585) |
| `T(n) = 7T(n/2) + n²` | Strassen matrix multiply | 7, 2, n^2.807 | 1 | Θ(n^2.807) |
| `T(n) = 2T(n/2) + n²` | — | 2, 2, n | 3 | Θ(n²) |

### 4.3 When the master theorem does not apply

- Subproblems of unequal size, e.g. `T(n) = T(n/3) + T(2n/3) + n` (use a recursion tree: Θ(n log n)).
- Subtract-style recurrences, e.g. `T(n) = T(n − 1) + n`, which solves to Θ(n²) by summation (this is quicksort's worst case).
- The gap between cases: `T(n) = 2T(n/2) + n / log n` falls between Case 1 and Case 2, because `n / log n` is smaller than n but not polynomially smaller. Its solution is Θ(n log log n).

## 5. Amortized Analysis (Summary)

Amortized cost is the average cost per operation over a worst-case sequence of operations, without any probability. Three methods: aggregate (total cost / number of operations), accounting (overcharge cheap operations and store credit), and potential (a function of the data structure state). Standard examples: dynamic array append (amortized O(1)) and union-find with path compression and union by rank (amortized O(α(n)) per operation).

## 6. Self-Check Questions

1. Prove that `n log n = O(n²)` but `n² ≠ O(n log n)`.
2. Solve `T(n) = 4T(n/2) + n`. (Answer: Case 1, Θ(n²).)
3. Solve `T(n) = 4T(n/2) + n²`. (Answer: Case 2, Θ(n² log n).)
4. Why is `2^(n+1) = O(2^n)` but `2^(2n) ≠ O(2^n)`?
