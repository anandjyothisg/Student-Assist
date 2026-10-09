# Clustering and Dimensionality Reduction

Unsupervised learning finds structure in data `x^(1), ..., x^(n)` without labels. This lecture covers **clustering** (grouping similar points) and **dimensionality reduction** (finding a compact representation).

## 1. k-Means Clustering

### 1.1 Objective

Given `k`, k-means seeks centroids `μ_1, ..., μ_k` and assignments `c(i)` minimising the **within-cluster sum of squares** (WCSS, also called inertia or distortion):

```
J = Σ_i || x^(i) - μ_c(i) ||^2
```

Finding the global minimum is NP-hard in general, even for `k = 2`.

### 1.2 Lloyd's algorithm

```python
def k_means(X, k, iters=100):
    mu = initialise_centroids(X, k)          # e.g. k-means++
    for _ in range(iters):
        # Assignment step: nearest centroid
        c = [argmin_j dist2(x, mu[j]) for x in X]
        # Update step: centroid = mean of assigned points
        new_mu = [mean(X[c == j]) for j in range(k)]
        if new_mu == mu:
            break
        mu = new_mu
    return c, mu
```

- Each step can only decrease `J` (the assignment step is optimal for fixed centroids; the mean is optimal for fixed assignments), so the algorithm **converges** in a finite number of iterations, but only to a **local minimum**.
- Cost per iteration: `O(n k d)` for `n` points in `d` dimensions.
- Remedy for poor local minima: run with several random initialisations (e.g. 10) and keep the solution with the lowest `J`.

**k-means++ initialisation** (Arthur and Vassilvitskii, 2007): choose the first centroid uniformly at random; choose each subsequent centroid with probability proportional to `D(x)^2`, the squared distance to the nearest centroid already chosen. This spreads centroids out and gives an expected objective within a factor `O(log k)` of optimal.

### 1.3 Worked example (1-D)

Points: 1, 2, 3, 10, 11, 12; `k = 2`; initial centroids `μ1 = 1`, `μ2 = 2`.

| Iteration | Assignment | New centroids |
|---|---|---|
| 1 | {1} and {2, 3, 10, 11, 12} | μ1 = 1, μ2 = 38/5 = 7.6 |
| 2 | {1, 2, 3} and {10, 11, 12} | μ1 = 2, μ2 = 11 |
| 3 | unchanged | converged |

Final `J = (1 + 0 + 1) + (1 + 0 + 1) = 4`. Note the poor initial centroids still reached the obvious solution here, but in general they need not.

### 1.4 Limitations

- `k` must be specified in advance.
- Assumes roughly **spherical**, similarly sized clusters, because it uses Euclidean distance to a centre; fails on elongated or concentric shapes.
- Sensitive to **outliers** (means are pulled by extreme values); **k-medoids** uses actual data points as centres and is more robust.
- Sensitive to feature **scale**: standardise features first.

## 2. Choosing k

- **Elbow method**: plot `J` against `k`. `J` always decreases as `k` grows (reaching 0 at `k = n`), so look for the "elbow" where further increases give diminishing returns. The elbow is often ambiguous.
- **Silhouette score**: for point `i`, let `a(i)` be the mean distance to other points in its own cluster and `b(i)` the mean distance to points in the nearest other cluster:

```
s(i) = (b(i) - a(i)) / max(a(i), b(i)),   -1 <= s(i) <= 1
```

Values near 1 indicate a well-clustered point, near 0 a point on a boundary, and negative values a likely misassignment. Choose the `k` with the highest mean silhouette. In the example above, for point 3: `a = (2 + 1)/2 = 1.5`, `b = (7 + 8 + 9)/3 = 8`, so `s = (8 - 1.5)/8 = 0.81`.
- **Gap statistic**: compares `log J` with its expectation under a uniform reference distribution.
- **Domain knowledge**: e.g. the number of T-shirt sizes a company is willing to manufacture.

## 3. Hierarchical Clustering

**Agglomerative** (bottom-up) clustering starts with each point as its own cluster and repeatedly merges the two closest clusters, producing a **dendrogram**. Cutting the dendrogram at a chosen height yields any number of clusters, so `k` need not be fixed in advance. **Divisive** clustering works top-down.

The distance between clusters A and B is defined by the **linkage**:

| Linkage | Definition | Behaviour |
|---|---|---|
| Single | min distance between a point in A and a point in B | Finds non-elliptical shapes; prone to **chaining** |
| Complete | max distance between points in A and B | Compact, similar-diameter clusters; sensitive to outliers |
| Average (UPGMA) | mean of all pairwise distances | Compromise between single and complete |
| Ward | increase in total within-cluster variance after merging | Similar to k-means; favours equal-sized spherical clusters |

Standard agglomerative clustering needs `O(n^2)` memory for the distance matrix and `O(n^3)` time naively (`O(n^2 log n)` with a priority queue), limiting it to tens of thousands of points.

## 4. DBSCAN

DBSCAN (Ester et al., 1996), density-based spatial clustering of applications with noise, has two parameters: radius `eps` and `minPts`.

- **Core point**: has at least `minPts` points (including itself) within distance `eps`.
- **Border point**: not core, but within `eps` of a core point.
- **Noise point**: neither core nor border.

Clusters are formed by connecting core points within `eps` of each other and attaching their border points.

- Finds clusters of **arbitrary shape** and labels outliers as noise; does not require `k`.
- Struggles when clusters have very **different densities**, and in high dimensions where distances become less informative.
- Heuristics: `minPts >= d + 1` (often `2d`); choose `eps` at the "knee" of the sorted **k-distance plot** (distance from each point to its `minPts`-th nearest neighbour).
- Complexity: about `O(n log n)` with a spatial index, `O(n^2)` worst case.

## 5. Principal Component Analysis (PCA)

PCA finds orthogonal directions (**principal components**) of maximal variance and projects the data onto the first `k` of them. It is a linear method.

### 5.1 Steps

1. **Centre** the data by subtracting the mean of each feature; **standardise** as well if features have different units.
2. Compute the covariance matrix `C = (1/(n-1)) XᵀX` (`d × d`).
3. Compute the eigenvectors and eigenvalues of `C`. Eigenvalue `λ_j` equals the variance of the data along eigenvector `w_j`.
4. Sort eigenvalues in decreasing order and take the top `k` eigenvectors as the columns of `W_k` (`d × k`).
5. Project: `Z = X W_k` (`n × k`). Approximate reconstruction: `X̂ = Z W_kᵀ`.

In practice PCA is computed via the **SVD** `X = U Σ Vᵀ`: the columns of `V` are the principal directions and `λ_j = σ_j^2 / (n - 1)`. This is numerically more stable than forming `C`.

### 5.2 Explained variance

The **explained variance ratio** of component `j` is `λ_j / Σ_i λ_i`.

Example: a 4-feature dataset with eigenvalues 4.2, 2.1, 0.5, 0.2 (total 7.0).

| Component | Eigenvalue | Explained variance | Cumulative |
|---|---|---|---|
| PC1 | 4.2 | 60.0% | 60.0% |
| PC2 | 2.1 | 30.0% | 90.0% |
| PC3 | 0.5 | 7.1% | 97.1% |
| PC4 | 0.2 | 2.9% | 100.0% |

Keeping two components retains 90% of the variance. A common rule is to keep the smallest `k` reaching 90–99% cumulative variance, or to look for an elbow in the **scree plot**.

### 5.3 Notes

- PCA is **unsupervised**: the directions of greatest variance need not be the most useful for classification (LDA uses labels instead).
- Without standardisation, features with large numeric ranges dominate the components.
- Uses: visualisation in 2-D/3-D, noise reduction, compression, decorrelating features, speeding up downstream learners. Non-linear alternatives for visualisation include t-SNE and UMAP.
