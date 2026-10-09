# Probabilistic Reasoning and Bayesian Networks

## 1. Why Probability?

Logical agents fail in domains with **uncertainty** arising from partial observability, nondeterminism, laziness (too many rules to list) and ignorance. Probability theory summarises this uncertainty as **degrees of belief**. Combined with utilities, it gives **decision theory**: a rational agent chooses the action with maximum expected utility.

## 2. Basic Probability

- A **random variable** has a domain, e.g. `Cavity ∈ {true, false}`, `Weather ∈ {sun, rain, cloud, snow}`.
- **Axioms (Kolmogorov)**: `0 <= P(ω) <= 1`; the probabilities of all possible worlds sum to 1; `P(a ∨ b) = P(a) + P(b) - P(a ∧ b)`.
- **Conditional probability**: `P(a | b) = P(a ∧ b) / P(b)`, defined when `P(b) > 0`.
- **Product rule**: `P(a ∧ b) = P(a | b) P(b) = P(b | a) P(a)`.
- **Marginalisation**: `P(Y) = Σ_z P(Y, z)`.
- **Normalisation**: `P(X | e) = α P(X, e)`, where `α` makes the distribution sum to 1.

A full **joint distribution** over `n` Boolean variables needs `2^n - 1` independent numbers, which is infeasible beyond a few dozen variables.

## 3. Bayes' Rule

From the product rule:

```
P(h | e) = P(e | h) P(h) / P(e)
P(e) = P(e | h) P(h) + P(e | ¬h) P(¬h)
```

- `P(h)`: the **prior**.
- `P(e | h)`: the **likelihood**.
- `P(h | e)`: the **posterior**.

Bayes' rule is useful because **causal** knowledge `P(effect | cause)` is often more stable and easier to obtain than **diagnostic** knowledge `P(cause | effect)`.

### 3.1 Worked example: a medical test

A disease has prevalence 1% in the population. A test has **sensitivity** 90% (`P(+ | D) = 0.90`) and a **false-positive rate** of 9% (`P(+ | ¬D) = 0.09`, i.e. specificity 91%). A randomly chosen person tests positive. What is the probability they have the disease?

1. `P(D) = 0.01`, `P(¬D) = 0.99`.
2. `P(+) = 0.90 × 0.01 + 0.09 × 0.99 = 0.0090 + 0.0891 = 0.0981`.
3. `P(D | +) = 0.0090 / 0.0981 ≈ 0.0917`.

Despite a "90% accurate" test, the probability of disease given a positive result is only about **9.2%**. Most positives come from the large healthy population. Ignoring the prior is the **base-rate fallacy**. A second, independent positive test would raise the posterior: using 0.0917 as the new prior gives `0.9 × 0.0917 / (0.9 × 0.0917 + 0.09 × 0.9083) ≈ 0.502`.

| | Disease (1%) | No disease (99%) | Total |
|---|---|---|---|
| Test positive | 0.0090 | 0.0891 | 0.0981 |
| Test negative | 0.0010 | 0.9009 | 0.9019 |

## 4. Independence and Conditional Independence

- `X` and `Y` are **independent** if `P(X, Y) = P(X) P(Y)`, equivalently `P(X | Y) = P(X)`.
- `X` and `Y` are **conditionally independent given Z** if `P(X, Y | Z) = P(X | Z) P(Y | Z)`.

Example: `Toothache` and `Catch` (the dentist's probe catches) are dependent, but conditionally independent given `Cavity`: both are caused by the cavity, and neither affects the other directly. Conditional independence reduces the representation of `n` effects of a single cause from `O(2^n)` to `O(n)` numbers.

## 5. Bayesian Networks

A **Bayesian network** is a **directed acyclic graph** (DAG) in which:

- each node is a random variable;
- a directed edge `X → Y` means X is a **parent** of Y (informally, a direct cause);
- each node `Xi` has a **conditional probability table (CPT)** giving `P(Xi | Parents(Xi))`.

The network represents the full joint distribution as:

```
P(x1, ..., xn) = Π_i P(xi | parents(Xi))
```

A Boolean node with `k` Boolean parents needs `2^k` numbers. With at most `k` parents per node, the network needs `O(n · 2^k)` numbers instead of `O(2^n)`.

### 5.1 The burglary alarm network (Pearl)

Variables: `Burglary (B)`, `Earthquake (E)`, `Alarm (A)`, `JohnCalls (J)`, `MaryCalls (M)`. Structure: `B → A ← E`, `A → J`, `A → M`.

- `P(b) = 0.001`, `P(e) = 0.002`
- `P(a | b, e) = 0.95`, `P(a | b, ¬e) = 0.94`, `P(a | ¬b, e) = 0.29`, `P(a | ¬b, ¬e) = 0.001`
- `P(j | a) = 0.90`, `P(j | ¬a) = 0.05`
- `P(m | a) = 0.70`, `P(m | ¬a) = 0.01`

The network has 1 + 1 + 4 + 2 + 2 = **10** parameters, versus 2^5 - 1 = **31** for the full joint.

**Joint entry example**: the alarm sounds and both call, with no burglary and no earthquake:

```
P(j, m, a, ¬b, ¬e) = P(j|a) P(m|a) P(a|¬b,¬e) P(¬b) P(¬e)
                   = 0.90 × 0.70 × 0.001 × 0.999 × 0.998 ≈ 0.000628
```

### 5.2 Conditional independence in networks

- Each node is conditionally independent of its **non-descendants** given its parents.
- Each node is conditionally independent of all others given its **Markov blanket**: its parents, children and children's other parents.
- Three-node patterns (**d-separation**): in a chain `X → Z → Y` and a fork `X ← Z → Y`, observing Z blocks the path, making X and Y independent. In a **collider** (v-structure) `X → Z ← Y`, X and Y are independent until Z (or a descendant) is observed. Observing an alarm and then learning of an earthquake lowers belief in burglary: **explaining away**.

## 6. Exact Inference by Enumeration

To compute `P(X | e)`, sum the joint over the hidden variables `y`:

```
P(X | e) = α Σ_y P(X, e, y)
```

**Example**: `P(Burglary | j, m)`.

```
P(b | j, m) = α P(b) Σ_e P(e) Σ_a P(a | b, e) P(j | a) P(m | a)
```

Evaluating gives unnormalised values 0.00059224 for `b` and 0.0014919 for `¬b`, so

```
P(B | j, m) = α ⟨0.00059224, 0.0014919⟩ ≈ ⟨0.284, 0.716⟩
```

Even with both neighbours calling, the probability of a burglary is only about 28%, because the prior is so low and false alarms are relatively frequent.

Enumeration evaluates the expression tree depth-first: `O(n)` space but `O(2^n)` time for `n` Boolean variables. **Variable elimination** avoids repeated subexpressions by caching factors; it is linear in network size for **polytrees** (singly connected networks). Exact inference in general networks is **#P-hard**, motivating approximate methods such as rejection sampling, likelihood weighting and Gibbs sampling (MCMC).

## 7. Naive Bayes

The **Naive Bayes** model assumes all features `F1, ..., Fn` are conditionally independent given the class `C`:

```
P(C | f1, ..., fn) = α P(C) Π_i P(fi | C)
```

It is a Bayesian network with a single parent `C` and children `Fi`. It needs only `O(n)` parameters per class, trains by counting, and often classifies well even when the independence assumption is false (although its probability estimates are then poorly calibrated).

**Spam example.** Priors: `P(spam) = 0.4`, `P(ham) = 0.6`. Likelihoods: `P(free | spam) = 0.30`, `P(offer | spam) = 0.20`, `P(free | ham) = 0.02`, `P(offer | ham) = 0.05`. For an email containing "free" and "offer":

- spam score: `0.4 × 0.30 × 0.20 = 0.024`
- ham score: `0.6 × 0.02 × 0.05 = 0.0006`
- `P(spam | free, offer) = 0.024 / 0.0246 ≈ 0.976`

**Pitfalls**: a word never seen in a class gives a zero likelihood that wipes out the product; use **Laplace (add-one) smoothing**: `P(w | c) = (count(w, c) + 1) / (count(c) + |V|)`, where `|V|` is the vocabulary size. Compute with sums of **log probabilities** to avoid floating-point underflow.
