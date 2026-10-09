# Gradient Descent Worked Example

This handout traces batch gradient descent by hand on a tiny linear-regression problem, checks the answer against the normal equation, and explains why some learning rates diverge. Reproduce every number with a calculator before the tutorial.

## 1. Problem Set-up

Three training examples with one feature:

| i | x | y |
|---|---|---|
| 1 | 1 | 2 |
| 2 | 2 | 3 |
| 3 | 3 | 5 |

Model: `h(x) = θ0 + θ1 x`. Cost (m = 3):

```
J(θ0, θ1) = (1 / 2m) Σ_i (h(x_i) - y_i)^2 = (1/6) Σ_i e_i^2
```

where `e_i = h(x_i) - y_i` is the residual (prediction minus target). Gradients:

```
∂J/∂θ0 = (1/m) Σ_i e_i
∂J/∂θ1 = (1/m) Σ_i e_i x_i
```

Hyperparameters: initial `θ0 = θ1 = 0`, learning rate `α = 0.1`.

## 2. The Exact Answer (Normal Equation)

Before iterating, compute the target so we know where descent should converge.

```
X = [[1, 1],      y = [2, 3, 5]
     [1, 2],
     [1, 3]]

XᵀX = [[3, 6],     Xᵀy = [10, 23]
       [6, 14]]

det(XᵀX) = 3·14 - 6·6 = 6
(XᵀX)^(-1) = (1/6) [[14, -6], [-6, 3]]

θ = (1/6) [14·10 - 6·23, -6·10 + 3·23] = (1/6) [2, 9] = [0.3333, 1.5]
```

So the least-squares line is `y = 0.3333 + 1.5x`. Its residuals are `-0.1667, +0.3333, -0.1667`, and the minimum cost is `J* = (0.02778 + 0.11111 + 0.02778) / 6 = 0.02778`.

Cross-check with the slope formula: `x̄ = 2`, `ȳ = 3.3333`, `Sxy = Σ(x - x̄)(y - ȳ) = 3`, `Sxx = 2`, slope `= 3/2 = 1.5`, intercept `= 3.3333 - 1.5·2 = 0.3333`.

## 3. Iteration by Iteration

### Iteration 1 (start at θ = (0, 0))

- Predictions: 0, 0, 0. Residuals `e = (-2, -3, -5)`.
- `J = (4 + 9 + 25) / 6 = 6.3333`.
- `∂J/∂θ0 = (-2 - 3 - 5) / 3 = -3.3333`.
- `∂J/∂θ1 = (-2·1 - 3·2 - 5·3) / 3 = -23/3 = -7.6667`.
- Update: `θ0 = 0 - 0.1·(-3.3333) = 0.3333`; `θ1 = 0 - 0.1·(-7.6667) = 0.7667`.

### Iteration 2 (θ = (0.3333, 0.7667))

- Predictions: 1.1000, 1.8667, 2.6333. Residuals `(-0.9000, -1.1333, -2.3667)`.
- `J = (0.8100 + 1.2844 + 5.6011) / 6 = 1.2826`.
- `∂J/∂θ0 = -4.4000 / 3 = -1.4667`.
- `∂J/∂θ1 = (-0.9000 - 2.2667 - 7.1000) / 3 = -3.4222`.
- Update: `θ0 = 0.3333 + 0.1467 = 0.4800`; `θ1 = 0.7667 + 0.3422 = 1.1089`.

### Iteration 3 (θ = (0.4800, 1.1089))

- Predictions: 1.5889, 2.6978, 3.8067. Residuals `(-0.4111, -0.3022, -1.1933)`.
- `J = (0.1690 + 0.0913 + 1.4240) / 6 = 0.2807`.
- `∂J/∂θ0 = -1.9067 / 3 = -0.6356`.
- `∂J/∂θ1 = (-0.4111 - 0.6044 - 3.5800) / 3 = -1.5319`.
- Update: `θ0 = 0.4800 + 0.0636 = 0.5436`; `θ1 = 1.1089 + 0.1532 = 1.2621`.

### Summary table

| Iteration | θ0 (before) | θ1 (before) | J(θ) | ∂J/∂θ0 | ∂J/∂θ1 |
|---|---|---|---|---|---|
| 1 | 0.0000 | 0.0000 | 6.3333 | -3.3333 | -7.6667 |
| 2 | 0.3333 | 0.7667 | 1.2826 | -1.4667 | -3.4222 |
| 3 | 0.4800 | 1.1089 | 0.2807 | -0.6356 | -1.5319 |
| 4 | 0.5436 | 1.2621 | 0.0819 | -0.2656 | -0.6899 |
| 5 | 0.5701 | 1.3311 | 0.0424 | -0.1011 | -0.3148 |

Observations:

- `J` decreases monotonically: 6.33 → 1.28 → 0.28 → 0.082 → 0.042, approaching `J* = 0.0278`.
- Gradient magnitudes shrink as θ approaches the minimum, so steps automatically get smaller even though α is fixed.
- `θ0` **overshoots** its final value (0.57 versus 0.33) while `θ1` is still catching up. Because `x` is not centred, the two parameters are strongly coupled, and the descent path curves along a long narrow valley.
- After 100 iterations, θ ≈ (0.415, 1.464); after 500, θ ≈ (0.334, 1.4997); after 1,000 it matches the normal equation to 6 decimal places.

## 4. Why Convergence Is Slow, and When α Diverges

For a quadratic cost, the behaviour of gradient descent is governed by the **Hessian** `H = (1/m) XᵀX`:

```
H = [[1, 2], [2, 4.6667]]
eigenvalues: λ_max ≈ 5.5465, λ_min ≈ 0.1202
```

- Gradient descent on a quadratic converges if and only if `0 < α < 2 / λ_max ≈ 0.3606`.
- The **condition number** `λ_max / λ_min ≈ 46` measures how elongated the contours are; large values mean slow convergence along the flat direction.

| α | Behaviour after 50 iterations |
|---|---|
| 0.10 | Converging smoothly; J ≈ 0.0294 |
| 0.30 | Faster; J ≈ 0.0279 |
| 0.36 | Just below the limit; oscillates with very slowly decaying amplitude, J ≈ 4.6 |
| 0.40 | Diverges; J exceeds 10^9 |

**Fix**: centre or standardise the feature. With `x' = x - 2`, the columns of `X` become orthogonal, `H` becomes diagonal `diag(1, 0.6667)`, the condition number drops to 1.5, and α can be much larger with fast convergence.

## 5. Reference Implementation

```python
xs, ys = [1, 2, 3], [2, 3, 5]
theta0, theta1, alpha, m = 0.0, 0.0, 0.1, 3

for it in range(1, 6):
    e = [theta0 + theta1 * x - y for x, y in zip(xs, ys)]
    J = sum(r * r for r in e) / (2 * m)
    g0 = sum(e) / m
    g1 = sum(r * x for r, x in zip(e, xs)) / m
    print(it, round(theta0, 4), round(theta1, 4), round(J, 4))
    theta0, theta1 = theta0 - alpha * g0, theta1 - alpha * g1   # simultaneous
```

## 6. Common Mistakes

- **Sequential update**: updating `θ0` and then using the new `θ0` to compute `θ1`'s gradient is not batch gradient descent. Compute both gradients first.
- **Sign error**: with residuals defined as `h - y`, subtract `α × gradient`. If residuals are defined as `y - h`, the sign flips.
- **Forgetting 1/m**: the step size then grows with the dataset size, and a learning rate that worked on 100 examples diverges on 100,000.
- **Judging convergence by θ alone**: monitor `J` (or the gradient norm); stop when the decrease per iteration falls below a tolerance such as 10^-6.
