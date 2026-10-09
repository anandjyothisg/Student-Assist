# Lab 5: Cross-Validation and Data Leakage

**Duration**: 2 hours. **Tools**: Python 3, scikit-learn, pandas. **Submission**: notebook with outputs and short written answers to the questions marked Q.

## 1. Learning Objectives

By the end of this lab you should be able to:

- Explain the distinct roles of the training, validation and test sets.
- Implement k-fold and stratified k-fold cross-validation and report mean and standard deviation of a score.
- Use nested cross-validation to tune hyperparameters without biasing the performance estimate.
- Recognise and prevent common forms of data leakage using pipelines.

## 2. Background

### 2.1 Train / validation / test split

- **Training set**: used to fit model parameters.
- **Validation set**: used to choose hyperparameters and compare models (model selection).
- **Test set**: used **once**, at the very end, to estimate performance on unseen data.

Typical proportions are 60/20/20 or 70/15/15; with millions of examples, 98/1/1 can be sufficient because 1% is still a large sample. If the test set influences any decision (feature choice, hyperparameters, early stopping), its score is optimistically biased and no longer an honest estimate.

A single hold-out split has two weaknesses: the estimate has **high variance** (it depends on which examples happened to land in the validation set), and data held out is wasted for training. Cross-validation addresses both.

### 2.2 k-fold cross-validation

1. Shuffle the data and partition it into `k` folds of roughly equal size.
2. For each `i = 1..k`, train on the other `k - 1` folds and evaluate on fold `i`.
3. Report the mean and standard deviation of the `k` scores.

Every example is used for validation **exactly once** and for training `k - 1` times. The cost is `k` model fits. Common choices are `k = 5` or `k = 10`. With 1,000 examples and 5 folds, each fit trains on 800 examples and validates on 200.

| Scheme | Fits | Bias of estimate | Variance of estimate | Use when |
|---|---|---|---|---|
| Hold-out | 1 | Higher (less training data) | High | Very large datasets |
| 5-fold / 10-fold | 5 / 10 | Low | Moderate | Default choice |
| Leave-one-out (k = n) | n | Lowest (nearly unbiased) | High (training sets nearly identical) | Very small datasets |
| Stratified k-fold | k | Low | Lower for imbalanced data | Classification, especially imbalanced |
| Group k-fold | k | Low | Moderate | Multiple rows per patient/user |
| Time-series split | k | Low | Moderate | Temporal data |

### 2.3 Stratification

**Stratified k-fold** ensures each fold has approximately the same class proportions as the whole dataset. With 5% positives and plain k-fold, some folds might contain very few positives, making recall estimates erratic. scikit-learn's `cross_val_score` uses stratified folds by default for classifiers when `cv` is an integer.

### 2.4 Grouped and temporal data

- If one patient contributes several records, all of that patient's records must be in the same fold (**GroupKFold**); otherwise the model is tested on people it has already seen.
- For time series, always train on the past and validate on the future (**TimeSeriesSplit**, also called forward chaining or rolling-origin evaluation). Random shuffling lets the model "see the future".

### 2.5 Nested cross-validation

If you tune hyperparameters with CV and report the best CV score, that score is optimistically biased: you selected the maximum of several noisy estimates. **Nested CV** uses an **inner loop** for tuning (e.g. `GridSearchCV` with 3 folds) and an **outer loop** (e.g. 5 folds) for estimation. The outer score estimates the performance of the whole procedure "tune, then fit". A 5 × 3 nested CV over a grid of 20 settings requires 5 × 3 × 20 = 300 fits plus 5 refits.

## 3. Data Leakage

**Data leakage** occurs when information that would not be available at prediction time influences training, producing over-optimistic evaluation that collapses in deployment.

Common sources:

- **Preprocessing on the full dataset**: fitting a scaler, imputer, PCA or feature selector on all data before splitting. Statistics of the validation fold leak into training.
- **Target leakage**: a feature that is a consequence of the label, e.g. `received_antibiotics` when predicting infection, or `account_closed_date` when predicting churn.
- **Duplicates or near-duplicates** across train and test (augmented copies of the same image).
- **Temporal leakage**: using future information, e.g. a 7-day moving average centred on the prediction date.
- **Tuning on the test set**.

The fix for preprocessing leakage is to wrap every data-dependent step in a **Pipeline**, so it is re-fitted on the training portion of every fold.

## 4. Lab Tasks

### Task 1: Hold-out variance

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

X, y = load_breast_cancer(return_X_y=True)     # 569 samples, 30 features
scores = []
for seed in range(20):
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2,
                                              stratify=y, random_state=seed)
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
    scores.append(model.fit(X_tr, y_tr).score(X_te, y_te))
```

Q1. Report the minimum, maximum and standard deviation of the 20 hold-out accuracies. What does the spread tell you about trusting a single split?

### Task 2: Stratified k-fold

```python
from sklearn.model_selection import StratifiedKFold, cross_val_score

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
scores = cross_val_score(model, X, y, cv=cv, scoring="f1")
print(f"F1 = {scores.mean():.3f} +/- {scores.std():.3f}")
```

Q2. Repeat with `n_splits` of 3, 5, 10 and 20. How do the mean and standard deviation change, and how does running time scale?

### Task 3: Demonstrating leakage

Generate pure noise: `X = rng.normal(size=(100, 10000))`, `y = rng.integers(0, 2, 100)`. The true achievable accuracy is 50%.

- **Leaky version**: select the 20 features most correlated with `y` using `SelectKBest` on the **full** data, then run 5-fold CV on a classifier.
- **Correct version**: put `SelectKBest(k=20)` **inside** a pipeline and run the same CV.

Q3. Report both accuracies. The leaky version typically reports far above 50% despite there being no signal. Explain why.

### Task 4: Nested CV

Tune `C` in `{0.01, 0.1, 1, 10, 100}` for logistic regression using `GridSearchCV(cv=3)` inside `cross_val_score(cv=5)`.

Q4. Compare the nested score with the `best_score_` from a single non-nested grid search on all data. Which is larger, and why?

## 5. Checklist Before Reporting a Result

- The test set was used exactly once.
- All preprocessing is inside a pipeline.
- Folds are stratified (classification) and grouped or time-ordered where needed.
- Scores are reported as mean +/- standard deviation over folds.
- The metric matches the problem (F1 or AUC for imbalanced classes, not accuracy alone).
