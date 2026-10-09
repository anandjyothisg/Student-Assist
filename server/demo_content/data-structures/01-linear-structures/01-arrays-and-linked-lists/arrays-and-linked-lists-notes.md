# Arrays and Linked Lists

CS-201 Data Structures and Algorithms · Unit 1 · Lecture Notes

## 1. Why Linear Structures Matter

A linear data structure stores elements in a sequence where each element (except the first and last) has exactly one predecessor and one successor. Arrays and linked lists are the two fundamental ways to realise such a sequence in memory. Almost every other structure in this course (stacks, queues, hash tables, adjacency lists) is built on top of one of them, so the trade-offs studied here reappear throughout the semester.

The central trade-off is between **contiguous storage** (arrays) and **linked storage** (linked lists):

- Contiguous storage gives constant-time random access because the address of element `i` is `base + i * element_size`.
- Linked storage gives constant-time insertion and deletion at a known position because no elements have to be shifted.

## 2. Static Arrays

A static array has a size fixed at creation time. In C, `int a[100];` reserves exactly 100 integers.

Key properties:

- **Access by index:** O(1). The address computation is a single multiplication and addition.
- **Search (unsorted):** O(n) using linear search; O(log n) using binary search if the array is sorted.
- **Insert or delete at position i:** O(n) in the worst case, because the elements after `i` must be shifted by one position.
- **Cache behaviour:** excellent. Consecutive elements share cache lines, so sequential scans are very fast in practice, often several times faster than traversing a linked list of the same length.

The main limitation is that the capacity must be known in advance. Allocating too little causes overflow; allocating too much wastes memory.

## 3. Dynamic Arrays and Amortized Analysis

A dynamic array (Python `list`, Java `ArrayList`, C++ `std::vector`) keeps a static array of some **capacity** and a separate **size** counter. When `size == capacity` and a new element is appended, the structure:

1. Allocates a new array, typically of capacity `2 * capacity` (the growth factor).
2. Copies all existing elements into the new array.
3. Frees the old array and appends the new element.

A single resize costs O(n), yet the **amortized** cost of an append is O(1).

### 3.1 Aggregate argument for doubling

Start with capacity 1 and append n elements. Resizes occur when the size reaches 1, 2, 4, 8, ..., up to the largest power of two below n. The total number of element copies is

`1 + 2 + 4 + ... + 2^k < 2n`

Adding the n writes of the new elements themselves, the total work is less than `3n`, so the average cost per append is bounded by a constant: **amortized O(1)**.

### 3.2 Why the growth must be multiplicative

If capacity grew by a constant `c` each time (e.g. +10), the number of copies would be `c + 2c + 3c + ... ≈ n² / (2c)`, giving amortized **O(n)** per append. Any constant growth factor greater than 1 (CPython uses roughly 1.125, Java `ArrayList` uses 1.5, many `std::vector` implementations use 2) yields amortized O(1); the factor only trades memory overhead against copy frequency.

### 3.3 Shrinking

To avoid thrashing, a dynamic array should halve its capacity only when it becomes one-quarter full, not half full. If it shrank at one-half, an alternating sequence of append and pop at the boundary would trigger a resize on every operation.

```python
class DynamicArray:
    def __init__(self):
        self._cap, self._n = 1, 0
        self._data = [None] * self._cap

    def append(self, x):
        if self._n == self._cap:
            self._resize(2 * self._cap)   # O(n), but rare
        self._data[self._n] = x
        self._n += 1

    def _resize(self, new_cap):
        new = [None] * new_cap
        for i in range(self._n):
            new[i] = self._data[i]
        self._data, self._cap = new, new_cap
```

## 4. Linked Lists

A linked list stores each element in a separately allocated **node** that holds the data and one or more pointers to neighbouring nodes.

### 4.1 Singly linked list

Each node has `data` and `next`. The list is identified by a `head` pointer; many implementations also keep a `tail` pointer so that appending is O(1).

- Insert at head: O(1).
- Insert after a given node: O(1).
- Delete the node after a given node: O(1).
- Delete a given node `p` itself: O(n), because the predecessor of `p` must be found by traversal (a common exam trap).
- Access the k-th element: O(k).

### 4.2 Doubly linked list

Each node has `prev`, `data` and `next`. The extra pointer costs memory (one pointer per node) but allows:

- Deletion of a given node in O(1), since `p.prev` is available.
- Backward traversal.
- O(1) removal at the tail when a tail pointer is kept.

Implementations often use **sentinel (dummy) head and tail nodes** so that insertion and deletion never need special cases for an empty list or for the ends.

### 4.3 Circular linked list

The last node points back to the first instead of to `None`. A circular singly linked list with only a `tail` pointer gives O(1) access to both ends, because `tail.next` is the head. Circular lists are used for round-robin CPU scheduling and for buffers that are cycled through repeatedly. A traversal must stop when it returns to the starting node, otherwise it loops forever.

```python
def delete_after(node):
    """Remove node.next from a singly linked list in O(1)."""
    victim = node.next
    if victim is not None:
        node.next = victim.next
    return victim
```

## 5. Operation Complexity Comparison

| Operation | Static array | Dynamic array | Singly linked (head + tail) | Doubly linked |
|---|---|---|---|---|
| Access k-th element | O(1) | O(1) | O(k) | O(k) |
| Insert at front | O(n) | O(n) | O(1) | O(1) |
| Insert at end | n/a (fixed) | O(1) amortized | O(1) | O(1) |
| Delete at end | O(1) | O(1) amortized | O(n) | O(1) |
| Insert/delete in middle (position known) | O(n) | O(n) | O(1) after node | O(1) |
| Search (unsorted) | O(n) | O(n) | O(n) | O(n) |
| Extra memory per element | 0 | up to ~n slots unused | 1 pointer | 2 pointers |

Note that "insert in middle is O(1) for linked lists" assumes a pointer to the position is already held. If the position must first be found by index, the total cost is O(n).

## 6. Choosing Between Them

- Use an array when the workload is dominated by indexed access, sorting, binary search or sequential scans.
- Use a linked list when there are frequent insertions and deletions at positions already referenced (e.g. an LRU cache combines a hash map with a doubly linked list so that both lookup and move-to-front are O(1)).
- Binary search on a linked list is O(n), not O(log n), because finding the midpoint requires traversal.

## 7. Common Pitfalls

- Forgetting to update `tail` when deleting the last node of a list.
- Losing the rest of the list by overwriting `head.next` before saving it.
- Confusing amortized O(1) with worst-case O(1): a single append to a dynamic array can still cost O(n).
- Reversing a singly linked list requires three pointers (`prev`, `curr`, `next`) and runs in O(n) time and O(1) extra space.
