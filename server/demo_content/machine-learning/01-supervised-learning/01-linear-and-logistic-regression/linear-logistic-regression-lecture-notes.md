# Linear and Logistic Regression

## 1. Notation

- Training set of `m` examples `(x^(i), y^(i))`, `i = 1..m`, each with `n` features.
- `x0 = 1` is prepended to every example so the intercept can be written as a weight.
- Parameters `θ = (θ0, θ1, ..., θn)`.
- Design matrix `X` is `m × (n+1)`; target vector `y` is `m × 1`.

## 2. Linear Regression

The hypothesis is linear in the parameters:

```
h_θ(x) = θ0 + θ1 x1 + ... + θn xn = θᵀx
```

"Linear" refers to the parameters: a model such as `θ0 + θ1 x + θ2 x^2` is still linear regression on the engineered features `x` and `x^2`.

### 2.1 Cost function: mean squared error

**Ordinary least squares (OLS)** chooses θ to minimise the sum of squared residuals. We use the cost

```
J(θ) = (1 / 2m) Σ_i (h_θ(x^(i)) - y^(i))^2
```

The factor `1/2` cancels when differentiating; it does not change the minimiser. `J` is a **convex quadratic** in θ, so any local minimum is the global minimum. Under the assumption that `y = θᵀx + ε` with Gaussian noise `ε ~ N(0, σ²)`, minimising MSE is equivalent to **maximum likelihood estimation**.

### 2.2 The normal equation

Setting the gradient `∇J = (1/m) Xᵀ(Xθ - y)` to zero gives the closed-form solution:

```
θ = (XᵀX)^(-1) Xᵀ y
```

- No learning rate and no iterations; no need for feature scaling.
- Computing `(XᵀX)^(-1)` costs roughly `O(n^3)`, and forming `XᵀX` costs `O(m n^2)`. This becomes slow when `n` exceeds about 10^4.
- `XᵀX` is **singular** (non-invertible) when features are linearly dependent (e.g. size in m² and in ft²) or when `m <= n`. Remedies: remove redundant features, use the **Moore–Penrose pseudo-inverse**, or add L2 regularisation.

### 2.3 Gradient descent

Gradient descent iteratively moves θ in the direction of steepest decrease of `J`. The partial derivative is

```
∂J/∂θj = (1/m) Σ_i (h_θ(x^(i)) - y^(i)) x_j^(i)
```

giving the **update rule**, applied simultaneously for all `j`:

```
θj := θj - α (1/m) Σ_i (h_θ(x^(i)) - y^(i)) x_j^(i)
```

In vector form: `θ := θ - (α/m) Xᵀ(Xθ - y)`.

```python
import numpy as np

def gradient_descent(X, y, alpha=0.01, iters=1000):
    m, n = X.shape
    theta = np.zeros(n)
    for _ in range(iters):
        grad = X.T @ (X @ theta - y) / m
        theta -= alpha * grad
    return theta
```

**Learning rate α**:

- Too small: convergence is very slow.
- Too large: `J` may oscillate or **diverge** (increase every iteration).
- Practical check: plot `J` against iteration number; it should decrease on every iteration for batch gradient descent. Try α on a roughly 3× grid: 0.001, 0.003, 0.01, 0.03, 0.1, ...

**Feature scaling** (standardisation `(x - μ)/σ` or min–max scaling) makes the contours of `J` closer to circular and speeds up convergence markedly.

**Variants**:

- **Batch GD** uses all `m` examples per update.
- **Stochastic GD (SGD)** uses one example per update: cheap, noisy, can escape shallow local minima in non-convex problems.
- **Mini-batch GD** uses `b` examples (typically 32–512), allowing vectorised computation.

| | Gradient descent | Normal equation |
|---|---|---|
| Learning rate | Must be chosen | Not needed |
| Iterations | Many | None (one solve) |
| Cost | O(k m n) for k iterations | O(n^3) plus O(m n^2) |
| Large n (e.g. 10^6 features) | Works well | Impractical |
| Feature scaling | Important | Unnecessary |
| Applies to other models | Yes (logistic regression, neural networks) | Only linear least squares |

## 3. Logistic Regression

Logistic regression is a **classification** algorithm for `y ∈ {0, 1}`, despite its name. Applying linear regression to classification is poor: outputs fall outside [0, 1] and outliers shift the threshold.

### 3.1 The sigmoid hypothesis

```
h_θ(x) = σ(θᵀx),   σ(z) = 1 / (1 + e^(-z))
```

Properties of the sigmoid (logistic) function:

- Range (0, 1); `σ(0) = 0.5`; `σ(z) → 1` as `z → ∞` and `→ 0` as `z → -∞`.
- `σ(-z) = 1 - σ(z)`.
- Derivative: `σ'(z) = σ(z)(1 - σ(z))`, with maximum value 0.25 at `z = 0`.

`h_θ(x)` is interpreted as the estimated probability `P(y = 1 | x; θ)`. The **log-odds** `ln(p / (1 - p))` equal `θᵀx`, which is linear in `x`.

### 3.2 Decision boundary

Predict `y = 1` when `h_θ(x) >= 0.5`, which happens exactly when `θᵀx >= 0`. The **decision boundary** is the set `θᵀx = 0`, a hyperplane in feature space.

Example: `θ = (-3, 1, 1)` gives boundary `x1 + x2 = 3`. For `x = (1, 1)`, `z = -1` and `σ(-1) ≈ 0.269`, so predict 0. For `x = (2, 2)`, `z = 1` and `σ(1) ≈ 0.731`, so predict 1. Non-linear boundaries (for example a circle `x1^2 + x2^2 = 1`) are obtained from polynomial features.

### 3.3 Cost function: log-loss (binary cross-entropy)

Using MSE with the sigmoid produces a **non-convex** cost with many local minima. Instead, maximum likelihood under a Bernoulli model gives:

```
J(θ) = -(1/m) Σ_i [ y^(i) ln h_θ(x^(i)) + (1 - y^(i)) ln(1 - h_θ(x^(i))) ]
```

This cost is **convex**. Per-example cost: if `y = 1`, the cost is `-ln(h)`; if `y = 0`, it is `-ln(1 - h)`.

| True label | Predicted p(y=1) | Log-loss |
|---|---|---|
| 1 | 0.9 | -ln 0.9 ≈ 0.105 |
| 1 | 0.5 | -ln 0.5 ≈ 0.693 |
| 1 | 0.1 | -ln 0.1 ≈ 2.303 |
| 0 | 0.1 | -ln 0.9 ≈ 0.105 |

Confident wrong predictions are penalised very heavily; the cost tends to infinity as `h → 0` when `y = 1`.

### 3.4 Gradient

Remarkably, the gradient has the same form as for linear regression:

```
∂J/∂θj = (1/m) Σ_i (h_θ(x^(i)) - y^(i)) x_j^(i)
```

The only difference is that `h_θ` is now the sigmoid of `θᵀx`. There is no closed-form solution; use gradient descent or second-order methods such as Newton's method or L-BFGS.

### 3.5 Multiclass classification

- **One-vs-rest**: train `K` binary classifiers, one per class, and predict the class with the highest `h`.
- **Softmax (multinomial) regression** generalises the sigmoid directly to `K` classes (covered in the neural networks unit).

## 4. Exam Pitfalls

- Update all `θj` **simultaneously** using the old values.
- Do not regularise or scale `θ0`'s dummy feature `x0 = 1`.
- Logistic regression's decision boundary is linear in the features used, even though `h` is non-linear.
- A threshold other than 0.5 changes the precision/recall trade-off but not the trained θ.
