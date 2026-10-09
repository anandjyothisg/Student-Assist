# Neural Network Fundamentals

## 1. The Perceptron

The perceptron (Rosenblatt, 1958) computes a weighted sum of its inputs and applies a step function:

```
ŷ = step(wᵀx + b),   step(z) = 1 if z >= 0 else 0
```

**Perceptron learning rule**: for each training example, update

```
w := w + η (y - ŷ) x
b := b + η (y - ŷ)
```

Weights change only when the prediction is wrong. The **perceptron convergence theorem** guarantees that if the data are **linearly separable**, the rule finds a separating hyperplane in a finite number of updates. If the data are not separable, it never converges.

A single perceptron cannot represent **XOR**, since no single line separates {(0,1), (1,0)} from {(0,0), (1,1)}. Minsky and Papert's 1969 analysis of this limitation contributed to reduced interest in neural networks during the 1970s.

## 2. Multilayer Perceptrons (MLPs)

An MLP stacks layers of units. For layer `l`:

```
z^(l) = W^(l) a^(l-1) + b^(l)
a^(l) = g(z^(l))
```

with `a^(0) = x`. `W^(l)` has shape `(units in layer l) × (units in layer l-1)`.

- Without non-linear activations, any stack of layers collapses to a single linear map, so **non-linearity is essential**.
- XOR with one hidden layer of two step units: `h1 = step(x1 + x2 - 0.5)` (OR), `h2 = step(x1 + x2 - 1.5)` (AND), output `step(h1 - h2 - 0.5)`.
- **Universal approximation theorem** (Cybenko, 1989; Hornik, 1991): a feed-forward network with one hidden layer and enough units, using a suitable non-linear activation, can approximate any continuous function on a compact domain to arbitrary accuracy. It does not say how many units are needed or that gradient descent will find the weights; in practice deeper networks are far more parameter-efficient.

## 3. Activation Functions

| Function | Formula | Range | Derivative | Notes |
|---|---|---|---|---|
| Sigmoid | 1 / (1 + e^(-z)) | (0, 1) | σ(z)(1 - σ(z)), max 0.25 | Saturates; not zero-centred; used for binary outputs |
| Tanh | (e^z - e^(-z)) / (e^z + e^(-z)) | (-1, 1) | 1 - tanh²(z), max 1 | Zero-centred; still saturates; tanh(z) = 2σ(2z) - 1 |
| ReLU | max(0, z) | [0, ∞) | 1 if z > 0, else 0 | Cheap; no saturation for z > 0; default for hidden layers |
| Leaky ReLU | max(0.01z, z) | (-∞, ∞) | 1 or 0.01 | Avoids dead units |
| Softmax | e^(z_k) / Σ_j e^(z_j) | (0, 1), sums to 1 | p_k(δ_kj - p_j) | Multi-class output layer |

**Dying ReLU**: a unit whose input is negative for every training example outputs 0 and receives zero gradient, so it never recovers. Causes include a large learning rate or a large negative bias. Leaky ReLU, ELU and careful initialisation mitigate it.

## 4. Backpropagation

Training minimises a loss `L` by gradient descent; **backpropagation** computes all gradients efficiently by applying the **chain rule** backwards from the output, reusing intermediate results. Its cost is a small constant multiple of the forward pass.

Define the error signal `δ^(l) = ∂L/∂z^(l)`. Then:

```
δ^(L) = ∂L/∂a^(L) ⊙ g'(z^(L))                    (output layer)
δ^(l) = (W^(l+1))ᵀ δ^(l+1) ⊙ g'(z^(l))           (hidden layers)
∂L/∂W^(l) = δ^(l) (a^(l-1))ᵀ
∂L/∂b^(l) = δ^(l)
```

where `⊙` is element-wise multiplication. The forward pass must store every `z^(l)` and `a^(l)`, so memory grows with depth and batch size.

### 4.1 Numeric example: one sigmoid neuron

Input `x = 1.0`, weight `w = 0.5`, bias `b = 0`, target `y = 1`, loss `L = ½ (a - y)^2`, learning rate `η = 1`.

1. Forward: `z = 0.5`, `a = σ(0.5) = 0.6225`, `L = ½ (0.3775)^2 = 0.0713`.
2. `∂L/∂a = a - y = -0.3775`.
3. `∂a/∂z = a(1 - a) = 0.6225 × 0.3775 = 0.2350`.
4. `∂z/∂w = x = 1.0`.
5. Chain rule: `∂L/∂w = -0.3775 × 0.2350 × 1.0 = -0.0887`.
6. Update: `w := 0.5 - 1 × (-0.0887) = 0.5887`. The output rises to `σ(0.5887) ≈ 0.643`, closer to the target.

```python
def train_step(x, y, w, b, lr):
    z = w * x + b
    a = 1 / (1 + math.exp(-z))
    dz = (a - y) * a * (1 - a)       # dL/dz
    return w - lr * dz * x, b - lr * dz
```

## 5. Vanishing and Exploding Gradients

Backpropagated gradients are products of one factor per layer. With sigmoid activations, each factor includes `σ'(z) <= 0.25`, so across 10 layers the gradient can shrink by `0.25^10 ≈ 9.5 × 10^-7`. Early layers then learn extremely slowly: the **vanishing gradient problem**. Conversely, factors larger than 1 cause **exploding gradients** and numerical overflow, especially in recurrent networks.

Remedies:

- **ReLU-family activations** (derivative 1 for positive inputs).
- **Careful initialisation**: Xavier/Glorot, `Var(w) = 2 / (n_in + n_out)`, for tanh/sigmoid; He, `Var(w) = 2 / n_in`, for ReLU. Weights must not all be initialised to the same value, or every unit in a layer learns the same function (**symmetry**).
- **Batch normalisation**: normalise each layer's pre-activations over the mini-batch.
- **Residual (skip) connections**: `a^(l+1) = a^(l) + F(a^(l))` give gradients a direct path (ResNet, 2015).
- **Gradient clipping** (rescale gradients whose norm exceeds a threshold) for exploding gradients.
- Gated architectures (LSTM, GRU) for recurrent networks.

## 6. Softmax and Cross-Entropy

For `K` classes, the output layer produces logits `z` and the **softmax**:

```
p_k = e^(z_k) / Σ_j e^(z_j)
```

For numerical stability compute `e^(z_k - max_j z_j)`; this leaves the result unchanged and prevents overflow.

The **cross-entropy loss** with a one-hot target `y`:

```
L = -Σ_k y_k ln p_k = -ln p_true
```

Combined, the gradient with respect to the logits is simply

```
∂L/∂z = p - y
```

**Example**: logits `z = (2.0, 1.0, 0.1)`. Exponentials 7.389, 2.718, 1.105 (sum 11.212). Probabilities `p = (0.659, 0.242, 0.099)`. If the true class is the first, `L = -ln 0.659 = 0.417` and `∂L/∂z = (-0.341, 0.242, 0.099)`.

Binary classification is the `K = 2` special case: a single sigmoid output with binary cross-entropy (log-loss).

## 7. Optimisers

| Optimiser | Update rule | Typical hyperparameters |
|---|---|---|
| SGD | θ := θ - η g | η ≈ 0.01–0.1, often with a decay schedule |
| SGD with momentum | v := β v + g;  θ := θ - η v | β = 0.9 |
| Adam | m := β1 m + (1 - β1) g;  v := β2 v + (1 - β2) g²;  m̂ = m / (1 - β1^t);  v̂ = v / (1 - β2^t);  θ := θ - η m̂ / (√v̂ + ε) | η = 0.001, β1 = 0.9, β2 = 0.999, ε = 10^-8 |

- `g` is the mini-batch gradient. **Momentum** accumulates an exponentially decaying average of past gradients, damping oscillation across steep valleys and accelerating along consistent directions; with `β = 0.9` the effective step is up to about 10 times larger.
- **Adam** (Kingma and Ba, 2014) combines momentum (first moment `m`) with per-parameter adaptive step sizes from the second moment `v` (as in RMSProp). **Bias correction** compensates for initialising `m` and `v` at zero. Example: at `t = 1` with `g = 0.5`, `m = 0.05` and `v = 0.00025`, but `m̂ = 0.5` and `v̂ = 0.25`, so the first step has magnitude about `η`, independent of the gradient's scale.
- Adam converges quickly with little tuning; well-tuned SGD with momentum sometimes generalises slightly better. **AdamW** decouples weight decay from the adaptive update.

## 8. Exam Pitfalls

- An MLP with linear activations is only a linear model.
- Backpropagation computes gradients; gradient descent (or Adam) uses them to update weights.
- Do not apply softmax and then a loss that applies softmax again (e.g. frameworks' "cross-entropy with logits").
- Initialising all weights to zero breaks learning because of symmetry.
