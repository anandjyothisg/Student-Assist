# Heaps and Priority Queues

CS-201 Data Structures and Algorithms · Unit 2 · Lecture Notes

## 1. The Heap Property

A **binary heap** is a complete binary tree that satisfies the heap-order property:

- **Max-heap:** every node's key is greater than or equal to the keys of its children, so the maximum is at the root.
- **Min-heap:** every node's key is less than or equal to the keys of its children, so the minimum is at the root.

The heap property orders each parent relative to its children only. Siblings are unordered, and a heap is **not** sorted; an inorder traversal of a heap does not produce sorted output. Because the tree is complete, a heap with n elements has height exactly `floor(log2 n)`.

## 2. Array Representation

A complete binary tree can be stored in an array with no pointers, level by level from left to right. With **0-based** indexing:

| Relationship | Formula (0-based) | Formula (1-based) |
|---|---|---|
| Parent of i | `(i - 1) // 2` | `i // 2` |
| Left child of i | `2i + 1` | `2i` |
| Right child of i | `2i + 2` | `2i + 1` |
| Last internal (non-leaf) node | `n // 2 - 1` | `n // 2` |

Elements at indices `n // 2` to `n - 1` (0-based) are leaves, so roughly half of a heap's nodes are leaves.

Example: the max-heap stored as `[9, 4, 5, 1, 3, 2]` has root 9; the children of index 1 (key 4) are at indices 3 and 4 (keys 1 and 3); the parent of index 5 (key 2) is index 2 (key 5).

## 3. Core Operations

### 3.1 Sift-up (insert)

To insert, place the new key at index `n` (the next free leaf position, which keeps the tree complete), then repeatedly swap it with its parent while it violates the heap property. The key moves up at most `floor(log2 n)` levels: **O(log n)**.

### 3.2 Sift-down (extract-max / extract-min)

To remove the root, move the last element to index 0, shrink the heap by one, and then repeatedly swap the element with its **larger child** (max-heap) or **smaller child** (min-heap) until the property holds. Swapping with the wrong child would place a smaller key above a larger sibling and break the heap. Cost: **O(log n)**.

```python
def sift_down(a, i, n):
    """Restore max-heap order for the subtree rooted at i in a[0:n]."""
    while True:
        largest = i
        l, r = 2 * i + 1, 2 * i + 2
        if l < n and a[l] > a[largest]:
            largest = l
        if r < n and a[r] > a[largest]:
            largest = r
        if largest == i:
            return
        a[i], a[largest] = a[largest], a[i]
        i = largest
```

### 3.3 Other operations

- **Peek (find-max/min):** O(1), read `a[0]`.
- **Increase-key / decrease-key** at a known index: O(log n), by sifting up or down. Dijkstra's and Prim's algorithms rely on this.
- **Search for an arbitrary key:** O(n); heaps provide no ordering that helps arbitrary search.

## 4. Build-Heap in O(n)

Inserting n keys one by one costs O(n log n). Floyd's **bottom-up build-heap** is faster: call `sift_down` on every internal node from index `n // 2 - 1` down to 0.

### Why it is linear

A node at height h sifts down at most h levels, and a heap has at most `ceil(n / 2^(h+1))` nodes at height h. The total work is

`sum over h of (n / 2^(h+1)) * h = (n / 2) * sum h / 2^h ≤ (n / 2) * 2 = n`

because `sum_{h≥0} h / 2^h = 2`. Hence build-heap is **O(n)**. Intuitively, most nodes are near the bottom and move only a short distance.

### Worked example (max-heap)

Input `[3, 9, 2, 1, 4, 5]`, n = 6, last internal node index 2.

1. i = 2 (key 2): child at index 5 is 5; swap → `[3, 9, 5, 1, 4, 2]`.
2. i = 1 (key 9): children 1 and 4 are smaller; no change.
3. i = 0 (key 3): larger child is 9; swap → `[9, 3, 5, 1, 4, 2]`. Continue at index 1: children 1 and 4, larger is 4; swap → `[9, 4, 5, 1, 3, 2]`.

Result: `[9, 4, 5, 1, 3, 2]`.

## 5. Heapsort

Heapsort sorts in place in two phases:

1. Build a max-heap: O(n).
2. Repeat n - 1 times: swap `a[0]` (the current maximum) with the last element of the heap region, shrink the heap by one, and sift down the new root: O(log n) each.

```python
def heapsort(a):
    n = len(a)
    for i in range(n // 2 - 1, -1, -1):
        sift_down(a, i, n)
    for end in range(n - 1, 0, -1):
        a[0], a[end] = a[end], a[0]
        sift_down(a, 0, end)
```

Continuing the example: swap 9 with 2 to give `[2, 4, 5, 1, 3 | 9]`, sift down to `[5, 4, 2, 1, 3 | 9]`; swap 5 with 3 to give `[3, 4, 2, 1 | 5, 9]`, sift down to `[4, 3, 2, 1 | 5, 9]`; and so on until `[1, 2, 3, 4, 5, 9]`.

Properties of heapsort:

- Time **O(n log n)** in the best, average and worst case.
- Extra space **O(1)** (in place).
- **Not stable:** the long-distance swap of the root with the last element can reorder equal keys.
- In practice usually slower than a well-implemented quicksort because of poor cache locality, but it has no O(n²) worst case, which is why introsort falls back to heapsort.

## 6. Priority Queues in Practice

A priority queue ADT supports `insert`, `peek` and `extract-min/max`. The binary heap gives O(log n) for insert and extract and O(1) for peek.

- Python's `heapq` module implements a **min-heap** on a plain list: `heapq.heappush(h, x)`, `heapq.heappop(h)`, `heapq.heapify(lst)` (O(n)). A max-heap is commonly simulated by pushing negated keys.
- Java's `PriorityQueue` is also a min-heap by default.
- To find the k largest of n elements, maintain a min-heap of size k: O(n log k).
- Merging k sorted lists of total length N with a heap of the k current heads costs O(N log k).

## 7. Pitfalls

- Using `2i` and `2i + 1` with 0-based arrays: these are the 1-based formulas.
- Starting build-heap at index 0 and moving forward; it must process nodes from the last internal node backwards.
- Claiming build-heap is O(n log n): that is a valid upper bound but not tight.
