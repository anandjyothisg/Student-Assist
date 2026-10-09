# Sorting Algorithms

CS-201 Data Structures and Algorithms · Unit 3 · Lecture Notes

## 1. Vocabulary

- **In-place:** uses O(1) extra memory beyond the input (some texts allow O(log n) for recursion).
- **Stable:** equal keys keep their original relative order. Stability matters when sorting records by a secondary key after a primary key, for example sorting students by name and then stably by grade so that each grade group stays alphabetical.
- **Comparison sort:** gains information about the input only by comparing pairs of elements.
- **Adaptive:** runs faster on inputs that are already partially sorted.

## 2. Elementary O(n²) Sorts

### 2.1 Bubble sort

Repeatedly sweep the array, swapping adjacent out-of-order pairs. After pass k, the k largest elements are in their final positions. With an early-exit flag (stop when a pass makes no swaps), the best case on sorted input is O(n). Stable, in place.

### 2.2 Selection sort

For each position i, find the minimum of `a[i..n-1]` and swap it into position i. Always performs Θ(n²) comparisons but only **at most n − 1 swaps**, which is useful when writes are expensive. The standard array version is **not stable**: swapping can move an element past an equal key (sorting `[4a, 4b, 1]` produces `[1, 4b, 4a]`).

### 2.3 Insertion sort

Grow a sorted prefix; insert each new element by shifting larger elements one place right. Best case O(n) on sorted input; the running time is O(n + I), where I is the number of inversions. Stable, in place, adaptive, and the fastest choice for small arrays (roughly n < 16 to 32), which is why hybrid sorts such as Timsort and introsort use it for small sub-arrays.

```python
def insertion_sort(a):
    for i in range(1, len(a)):
        key, j = a[i], i - 1
        while j >= 0 and a[j] > key:   # strict '>' keeps it stable
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = key
```

## 3. Divide-and-Conquer Sorts

### 3.1 Merge sort

Split the array in half, sort each half recursively, and merge the two sorted halves in linear time. Recurrence `T(n) = 2T(n/2) + Θ(n)`, so **Θ(n log n) in every case**. The merge needs an auxiliary array of size n, so space is O(n). Merge sort is stable (when ties are taken from the left half first) and is the basis of external sorting for data that does not fit in memory. It is also the natural choice for linked lists, where it needs no auxiliary array.

### 3.2 Quicksort

Choose a **pivot**, partition the array so that elements smaller than the pivot come before it and larger ones after it, then recursively sort the two parts.

```python
def quicksort(a, lo, hi):
    if lo < hi:
        p = partition(a, lo, hi)
        quicksort(a, lo, p - 1)
        quicksort(a, p + 1, hi)

def partition(a, lo, hi):          # Lomuto scheme, pivot = last element
    pivot, i = a[hi], lo - 1
    for j in range(lo, hi):
        if a[j] <= pivot:
            i += 1
            a[i], a[j] = a[j], a[i]
    a[i + 1], a[hi] = a[hi], a[i + 1]
    return i + 1
```

**Best and average case:** when partitions are reasonably balanced, `T(n) = 2T(n/2) + Θ(n) = Θ(n log n)`. Even a consistent 9-to-1 split gives Θ(n log n), because the recursion depth is still logarithmic (`log_{10/9} n`).

**Worst case Θ(n²):** if the pivot is always the smallest or largest element, one side of each partition is empty and the other has n − 1 elements, giving

`T(n) = T(n − 1) + Θ(n) = Θ(n²)`

With the "last element" pivot rule above, this happens on input that is **already sorted or reverse sorted**, a very common real-world case. It also happens when all keys are equal under a two-way partition.

**Pivot strategies:**

- **First/last element:** simple, but O(n²) on sorted input.
- **Random pivot:** expected O(n log n) for every input; the worst case still exists but has negligible probability.
- **Median-of-three:** the median of the first, middle and last elements; fixes the sorted-input case cheaply.
- **Three-way partitioning (Dutch national flag):** splits into `< pivot`, `= pivot`, `> pivot`; makes many duplicate keys fast.
- **Introsort** (used by C++ `std::sort`): quicksort that switches to heapsort when recursion depth exceeds about `2 log2 n`, guaranteeing O(n log n).

Quicksort is in place, but its recursion stack is O(log n) on average and O(n) in the worst case; recursing on the smaller part first and looping on the larger bounds the stack at O(log n). It is **not stable**. Despite its worst case, quicksort is often the fastest comparison sort in practice due to its tight inner loop and good cache behaviour.

### 3.3 Heapsort

Build a max-heap in O(n), then repeatedly move the maximum to the end and sift down: Θ(n log n) in all cases, O(1) extra space, not stable (see the Unit 2 notes on heaps).

## 4. Comparison Table

| Algorithm | Best | Average | Worst | Extra space | Stable |
|---|---|---|---|---|---|
| Bubble sort (early exit) | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Insertion sort | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Selection sort | O(n²) | O(n²) | O(n²) | O(1) | No |
| Merge sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes |
| Quicksort | O(n log n) | O(n log n) | O(n²) | O(log n) avg | No |
| Heapsort | O(n log n) | O(n log n) | O(n log n) | O(1) | No |

Python's built-in `sorted` and `list.sort` use **Timsort**, a stable hybrid of merge sort and insertion sort with O(n) best case and O(n log n) worst case.

## 5. The Ω(n log n) Lower Bound for Comparison Sorts

Any comparison sort can be modelled as a **decision tree**: each internal node is a comparison `a[i] ≤ a[j]`, each leaf is one output permutation. To sort correctly for all inputs of n distinct keys, the tree needs at least **n!** reachable leaves. A binary tree of height h has at most `2^h` leaves, so

`2^h ≥ n!  ⇒  h ≥ log2(n!) = Θ(n log n)`

using Stirling's approximation (`log2(n!) ≈ n log2 n − 1.44 n`). The height is the worst-case number of comparisons, so every comparison sort needs **Ω(n log n)** comparisons in the worst case. Merge sort and heapsort are therefore asymptotically optimal.

The bound does not apply to non-comparison sorts that exploit the structure of keys:

- **Counting sort:** O(n + k) for integer keys in range `0..k`; stable.
- **Radix sort:** O(d · (n + b)) for d-digit keys in base b, using a stable sort per digit.
- **Bucket sort:** O(n) expected for keys uniformly distributed over an interval.

## 6. Pitfalls

- Stating that quicksort is O(n log n) without qualification; its worst case is O(n²).
- Assuming the lower bound applies to counting or radix sort.
- Claiming merge sort is in place; the standard array version needs O(n) extra space.
