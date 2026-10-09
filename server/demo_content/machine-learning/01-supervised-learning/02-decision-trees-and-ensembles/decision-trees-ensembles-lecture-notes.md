# Decision Trees and Ensemble Methods

## 1. Decision Trees

A **decision tree** classifies an example by testing one attribute at each internal node, following the branch matching the attribute's value, and returning the label stored at the leaf. Trees are learned top-down by **greedy recursive partitioning**: choose the "best" attribute to split on, partition the data, and recurse on each subset until a stopping condition holds (all examples share a label, no attributes remain, or a size/depth limit is reached).

Strengths: interpretable, little preprocessing (no feature scaling), handle mixed categorical and numeric features, capture interactions. Weaknesses: high variance (small data changes can produce a very different tree), axis-aligned boundaries, and a strong tendency to overfit.

## 2. Impurity Measures

### 2.1 Entropy

For a set `S` with class proportions `p_1, ..., p_K`:

```
H(S) = - Σ_k p_k log2(p_k)
```

Entropy is 0 for a pure set and maximal (`log2 K`, i.e. 1 bit for two classes) when classes are equally frequent.

### 2.2 Information gain

The **information gain** of splitting `S` on attribute `A` is the expected reduction in entropy:

```
IG(S, A) = H(S) - Σ_v (|S_v| / |S|) H(S_v)
```

### 2.3 Gini impurity

```
Gini(S) = 1 - Σ_k p_k^2
```

Gini is 0 for a pure node and at most `1 - 1/K` (0.5 for two classes). It is the probability that a randomly chosen element is misclassified if labelled at random according to the node's class distribution. It avoids logarithms and in practice selects very similar splits to entropy.

## 3. Worked Example: PlayTennis

The classic PlayTennis dataset has 14 days: 9 "Yes", 5 "No".

```
H(S) = -(9/14) log2(9/14) - (5/14) log2(5/14) = 0.940 bits
Gini(S) = 1 - (9/14)^2 - (5/14)^2 = 1 - 106/196 = 0.459
```

**Split on Outlook** (Sunny: 2 Yes / 3 No; Overcast: 4 Yes / 0 No; Rain: 3 Yes / 2 No):

```
H(Sunny) = 0.971, H(Overcast) = 0, H(Rain) = 0.971
weighted = (5/14)(0.971) + (4/14)(0) + (5/14)(0.971) = 0.694
IG(S, Outlook) = 0.940 - 0.694 = 0.247
```

**Split on Wind** (Weak: 6 Yes / 2 No; Strong: 3 Yes / 3 No):

```
H(Weak) = 0.811, H(Strong) = 1.000
weighted = (8/14)(0.811) + (6/14)(1.000) = 0.892
IG(S, Wind) = 0.940 - 0.892 = 0.048
```

| Attribute | Information gain |
|---|---|
| Outlook | 0.247 |
| Humidity | 0.152 |
| Wind | 0.048 |
| Temperature | 0.029 |

ID3 selects **Outlook** for the root. The Overcast branch is pure and becomes a "Yes" leaf; the algorithm recurses on Sunny and Rain.

## 4. Tree Algorithms

| Algorithm | Split criterion | Splits | Features | Pruning |
|---|---|---|---|---|
| ID3 (Quinlan, 1986) | Information gain | Multiway | Categorical only | None in original |
| C4.5 (Quinlan, 1993) | Gain ratio | Multiway | Categorical and continuous (thresholds), missing values | Error-based post-pruning |
| CART (Breiman et al., 1984) | Gini (classification), MSE/variance reduction (regression) | Binary only | Categorical and continuous | Cost-complexity pruning |

**Bias of information gain**: it favours attributes with many values. An attribute such as `Date` or `CustomerID` splits the data into singleton, perfectly pure subsets, giving maximal gain but no generalisation. C4.5's **gain ratio** divides IG by the **split information** `-Σ_v (|S_v|/|S|) log2(|S_v|/|S|)` to penalise many-valued attributes.

For a **continuous** feature, candidate thresholds are midpoints between consecutive sorted values where the class changes; CART evaluates each one with a binary split `x <= t`.

## 5. Overfitting and Pruning

A fully grown tree can reach zero training error by memorising noise.

- **Pre-pruning (early stopping)**: limit `max_depth`, require `min_samples_split` or `min_samples_leaf`, or require a minimum impurity decrease. Cheap, but may stop too early (a split that looks useless can enable useful splits below it, as in XOR).
- **Post-pruning**: grow the full tree, then remove subtrees.
  - **Reduced-error pruning**: replace a subtree with a leaf if accuracy on a validation set does not decrease.
  - **Cost-complexity pruning** (CART): minimise `R_α(T) = R(T) + α |T|`, where `R(T)` is the training error and `|T|` the number of leaves. Increasing `α` yields a nested sequence of smaller trees; choose `α` by cross-validation.

## 6. Ensemble Methods

An **ensemble** combines many base models. Ensembles reduce variance (bagging), bias (boosting), or both.

### 6.1 Bagging (bootstrap aggregating)

Breiman (1996): draw `B` **bootstrap samples** (size `n`, sampled with replacement), train a model on each, and aggregate by majority vote (classification) or averaging (regression).

- The probability a given example is absent from a bootstrap sample is `(1 - 1/n)^n → 1/e ≈ 0.368`, so each sample contains about **63.2%** of the distinct examples.
- The omitted ~36.8% are **out-of-bag (OOB)** examples, giving a free validation estimate without a separate hold-out set.
- Averaging `B` models each with variance `σ²` and pairwise correlation `ρ` gives variance `ρσ² + (1 - ρ)σ²/B`. As `B` grows the second term vanishes, but the first remains, so **decorrelating** the models is key.
- Bagging helps most with high-variance, low-bias learners such as deep unpruned trees.

### 6.2 Random forests

Breiman (2001): bagged trees with an extra source of randomness. At **each split**, only a random subset of `m_try` features is considered. Defaults: `m_try ≈ √p` for classification and `p/3` for regression, where `p` is the number of features. This reduces the correlation `ρ` between trees. Trees are typically grown deep without pruning. Random forests also provide **feature importance** (mean decrease in impurity, or permutation importance) and rarely overfit as more trees are added.

### 6.3 Boosting and AdaBoost

Boosting trains weak learners **sequentially**, each focusing on examples its predecessors got wrong. **AdaBoost** (Freund and Schapire, 1997) with labels `y ∈ {-1, +1}`:

```python
w = [1/n] * n
for t in range(T):
    h_t = fit_weak_learner(X, y, weights=w)        # e.g. a decision stump
    eps = sum(w_i for i where h_t(x_i) != y_i)     # weighted error
    alpha_t = 0.5 * ln((1 - eps) / eps)
    w_i = w_i * exp(-alpha_t * y_i * h_t(x_i))     # up-weight mistakes
    normalise w to sum to 1
H(x) = sign(sum_t alpha_t * h_t(x))
```

**Example**: 10 examples with weight 0.1; a stump misclassifies 2, so `ε = 0.2` and `α = 0.5 ln(4) ≈ 0.693`. Correct examples are multiplied by `e^(-0.693) = 0.5`, wrong ones by `e^(0.693) = 2`. Before normalising: 8 × 0.05 + 2 × 0.2 = 0.8. After normalising: correct examples have weight 0.0625 each, misclassified ones 0.25 each; the misclassified examples now carry exactly half the total weight.

### 6.4 Gradient boosting

Friedman (2001) generalises boosting to any differentiable loss: each new tree is fitted to the **negative gradient** of the loss with respect to the current predictions (for squared error, simply the residuals `y - F(x)`). The model is updated as `F_m(x) = F_(m-1)(x) + ν h_m(x)`, where the **shrinkage** (learning rate) `ν`, typically 0.01–0.1, trades more trees for better generalisation. Popular implementations: XGBoost, LightGBM, CatBoost.

| | Bagging / Random forest | Boosting |
|---|---|---|
| Training | Parallel, independent models | Sequential, each depends on the last |
| Primarily reduces | Variance | Bias (and variance) |
| Base learner | Deep, low-bias trees | Shallow trees or stumps |
| Sensitivity to noise | Robust | Can overfit noisy labels / outliers |
| Effect of more models | Does not overfit | Can overfit; tune number of rounds |
