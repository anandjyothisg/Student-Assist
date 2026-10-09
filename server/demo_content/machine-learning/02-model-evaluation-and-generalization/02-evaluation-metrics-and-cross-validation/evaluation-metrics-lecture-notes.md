# Classification Evaluation Metrics

## 1. The Confusion Matrix

For a binary classifier with a designated **positive** class, every prediction falls into one of four cells:

| | Predicted positive | Predicted negative |
|---|---|---|
| **Actually positive** | True positive (TP) | False negative (FN) |
| **Actually negative** | False positive (FP) | True negative (TN) |

- A **false positive** is a **Type I error** (a false alarm).
- A **false negative** is a **Type II error** (a miss).
- Row sums give the actual class counts `P = TP + FN` and `N = FP + TN`.

## 2. Metrics Derived from the Confusion Matrix

| Metric | Formula | Question answered |
|---|---|---|
| Accuracy | (TP + TN) / (TP + TN + FP + FN) | What fraction of all predictions are correct? |
| Precision (positive predictive value) | TP / (TP + FP) | Of the predicted positives, how many are truly positive? |
| Recall (sensitivity, true positive rate, TPR) | TP / (TP + FN) | Of the actual positives, how many did we find? |
| Specificity (true negative rate) | TN / (TN + FP) | Of the actual negatives, how many did we correctly reject? |
| False positive rate (FPR) | FP / (FP + TN) = 1 - specificity | Of the actual negatives, how many were flagged? |
| F1 score | 2 · P · R / (P + R) = 2TP / (2TP + FP + FN) | Harmonic mean of precision and recall |

### 2.1 F-beta

```
F_β = (1 + β²) · P · R / (β² · P + R)
```

`β > 1` weights recall more heavily (`F2` for screening tasks where misses are costly); `β < 1` weights precision more (`F0.5` for tasks where false alarms are costly, such as spam filtering). F1 uses the **harmonic** mean because it is dominated by the smaller value: a classifier with P = 1.0 and R = 0.01 has arithmetic mean 0.505 but F1 ≈ 0.0198.

## 3. Worked Example: Disease Screening

A screening model is evaluated on 1,000 patients, of whom 50 have the disease (5% prevalence). Results:

| | Predicted disease | Predicted healthy | Total |
|---|---|---|---|
| **Has disease** | TP = 40 | FN = 10 | 50 |
| **Healthy** | FP = 60 | TN = 890 | 950 |
| **Total** | 100 | 900 | 1,000 |

Calculations:

- Accuracy = (40 + 890) / 1000 = **0.930**
- Precision = 40 / (40 + 60) = **0.400**
- Recall = 40 / (40 + 10) = **0.800**
- Specificity = 890 / (890 + 60) = **0.937**
- FPR = 60 / 950 = **0.063**
- F1 = 2 × 0.4 × 0.8 / (0.4 + 0.8) = 0.64 / 1.2 = **0.533** (check: 2·40 / (80 + 60 + 10) = 80/150 = 0.533)
- F2 = 5 × 0.4 × 0.8 / (4 × 0.4 + 0.8) = 1.6 / 2.4 = **0.667**

**The accuracy paradox.** A trivial classifier that predicts "healthy" for everyone achieves accuracy 950/1000 = **0.950**, higher than our model, yet its recall is 0 and it detects no disease at all. With **imbalanced classes**, accuracy is misleading; report precision, recall, F1, or class-balanced metrics instead.

**Interpretation.** The model finds 80% of sick patients, but only 40% of the patients it flags are actually sick. Whether that is acceptable depends on costs: for an initial screen followed by a confirmatory test, high recall matters more than precision.

## 4. The Precision–Recall Trade-off and Thresholds

Most classifiers output a score or probability; a **threshold** `t` converts it into a label. Raising `t` makes the classifier more conservative: precision generally rises and recall falls. Lowering `t` does the opposite. Recall is monotonically non-increasing in `t`; precision usually, but not necessarily, increases. The threshold should be chosen on a **validation** set according to the application's costs, not by default at 0.5.

## 5. ROC Curves and AUC

The **receiver operating characteristic (ROC) curve** plots TPR (y-axis) against FPR (x-axis) as the threshold sweeps from `+∞` (point (0, 0)) to `-∞` (point (1, 1)).

- The diagonal from (0, 0) to (1, 1) corresponds to random guessing.
- The top-left corner (0, 1) is a perfect classifier.
- **AUC** (area under the ROC curve) summarises the curve in one number: 0.5 for random, 1.0 for perfect, below 0.5 for worse than random (inverting predictions would help).
- AUC has a probabilistic meaning: it equals the probability that a randomly chosen positive is scored higher than a randomly chosen negative (equivalent to the normalised Mann–Whitney U statistic).
- AUC is **threshold-independent** and insensitive to class proportions.

### 5.1 Worked AUC example

Scores for 4 positives: 0.9, 0.8, 0.6, 0.4. Scores for 4 negatives: 0.7, 0.5, 0.3, 0.2.

Pairwise method: there are 4 × 4 = 16 positive–negative pairs. Count pairs where the positive scores higher:

- 0.9 beats all 4 negatives; 0.8 beats all 4.
- 0.6 beats 0.5, 0.3, 0.2 → 3.
- 0.4 beats 0.3, 0.2 → 2.

AUC = (4 + 4 + 3 + 2) / 16 = 13/16 = **0.8125**. Sweeping the threshold gives ROC points (FPR, TPR): (0, 0.25), (0, 0.5), (0.25, 0.5), (0.25, 0.75), (0.5, 0.75), (0.5, 1), (0.75, 1), (1, 1); the trapezoidal area under them is also 0.8125. Ties count as one half.

### 5.2 Precision–recall curves

With heavy class imbalance (e.g. 1 positive per 1,000), ROC curves can look optimistic because FPR has a huge denominator. The **precision–recall curve** and its area (**average precision**) are more informative in such settings. The baseline for a PR curve is the positive-class prevalence, not 0.5.

## 6. Multi-class Averaging

For `K` classes, compute per-class precision/recall in a one-vs-rest fashion, then average:

- **Macro average**: unweighted mean over classes; every class counts equally, so rare classes matter.
- **Weighted average**: mean weighted by class support.
- **Micro average**: pool TP, FP, FN over all classes before computing. For single-label multi-class problems, micro-averaged precision, recall and F1 all equal accuracy.

## 7. Regression Metrics (for comparison)

| Metric | Formula | Notes |
|---|---|---|
| MAE | (1/m) Σ \|y - ŷ\| | Robust to outliers; same units as y |
| MSE | (1/m) Σ (y - ŷ)² | Penalises large errors heavily |
| RMSE | √MSE | Same units as y |
| R² | 1 - SS_res / SS_tot | 1 is perfect; 0 equals predicting the mean; can be negative on test data |

## 8. Exam Pitfalls

- Precision's denominator is **predicted** positives; recall's denominator is **actual** positives.
- Sensitivity = recall = TPR; specificity = TNR = 1 - FPR.
- High accuracy on imbalanced data proves nothing; compare against the majority-class baseline.
- AUC measures ranking quality, not calibration: multiplying all scores by 0.5 leaves AUC unchanged.
