# Hashing and Hash Tables

CS-201 Data Structures and Algorithms · Unit 2 · Lecture Notes

## 1. Motivation

A hash table implements the **dictionary** (map) ADT: `insert(key, value)`, `search(key)` and `delete(key)`. Balanced search trees give O(log n) for these operations; a well-designed hash table gives **O(1) expected** time by computing the storage location directly from the key.

A hash table consists of:

- An array of `m` slots (buckets).
- A **hash function** `h` that maps each key to an index in `0 .. m-1`.
- A **collision resolution** strategy for when two keys hash to the same index.

The **load factor** is `α = n / m`, where n is the number of stored keys. Almost every performance bound for hashing is expressed in terms of α.

## 2. Hash Functions

A good hash function is deterministic, fast to compute, and spreads keys uniformly across the table (the **simple uniform hashing** assumption).

### 2.1 Division method

`h(k) = k mod m`

Choose m to be a **prime not close to a power of 2**. If `m = 2^p`, then `h(k)` is just the lowest p bits of k, and any pattern in those bits (for example, all keys even) causes clustering.

### 2.2 Multiplication method

`h(k) = floor(m * (k * A mod 1))`, with constant `0 < A < 1`. Knuth suggests `A ≈ (√5 − 1) / 2 ≈ 0.6180339887`. The choice of m is not critical here, so a power of 2 is acceptable.

### 2.3 Strings and other keys

Strings are typically hashed with a polynomial rolling hash, `h(s) = (s[0]·p^(L-1) + s[1]·p^(L-2) + ... + s[L-1]) mod m`, evaluated with Horner's rule. Summing character codes is a poor hash because anagrams ("listen", "silent") collide.

## 3. Collision Resolution by Separate Chaining

Each slot holds a linked list (or dynamic array) of all entries whose keys hash to it.

- Insert: O(1) (prepend to the chain, after a duplicate check if keys must be unique).
- Expected search cost under simple uniform hashing: **Θ(1 + α)**, for both successful and unsuccessful search.
- Worst case: O(n), when all keys land in one chain.
- α may exceed 1; the table never becomes "full".
- Deletion is simple: remove the node from its chain.

Java's `HashMap` uses chaining, resizes when α exceeds **0.75** by default, and since Java 8 converts a chain longer than 8 entries into a red-black tree, bounding the worst case at O(log n) per bucket.

## 4. Collision Resolution by Open Addressing

All entries are stored in the array itself, so α ≤ 1 always. On a collision the table is probed according to a **probe sequence** `h(k, i)` for `i = 0, 1, 2, ...` until an empty slot is found.

| Method | Probe sequence | Main weakness |
|---|---|---|
| Linear probing | `(h(k) + i) mod m` | Primary clustering |
| Quadratic probing | `(h(k) + c1·i + c2·i²) mod m` | Secondary clustering; may fail to find a free slot |
| Double hashing | `(h1(k) + i·h2(k)) mod m` | Extra hash computation |

### 4.1 Linear probing

Simple and very cache-friendly, but long runs of occupied slots form (**primary clustering**): any key hashing into a run extends it. Expected probes, for α < 1:

- Unsuccessful search / insert: about `½ (1 + 1/(1 − α)²)`
- Successful search: about `½ (1 + 1/(1 − α))`

At α = 0.5 an unsuccessful search takes about 2.5 probes; at α = 0.9 it takes about 50.5. Linear-probing tables should therefore be kept well below full.

**Example** (m = 10, `h(k) = k mod 10`): insert 23, 43, 13, 27. Key 23 goes to slot 3; 43 collides and goes to 4; 13 collides at 3 and 4 and goes to 5; 27 goes to 7.

### 4.2 Quadratic probing

With `h(k, i) = (h(k) + i²) mod m`, the same keys give: 23 → 3; 43 → 3, then 4; 13 → 3, 4, then `3 + 4 = 7`; 27 → 7 is taken, so 8. Primary clustering is avoided, but keys with the same initial hash follow the same sequence (**secondary clustering**). If m is prime and α ≤ 0.5, quadratic probing is guaranteed to find an empty slot.

### 4.3 Double hashing

`h(k, i) = (h1(k) + i·h2(k)) mod m`. The step size depends on the key, so keys that collide initially usually diverge afterwards. Requirements: `h2(k)` must never be 0 and must be relatively prime to m (choose m prime, or m a power of 2 with `h2` always odd).

**Example** (m = 11, `h1(k) = k mod 11`, `h2(k) = 7 − (k mod 7)`): insert 14, 25, 36. Key 14 → slot 3. Key 25 → 3 is taken; `h2(25) = 7 − 4 = 3`, so slot 6. Key 36 → 3 is taken; `h2(36) = 7 − 1 = 6`, so slot 9.

### 4.4 Deletion in open addressing

Simply emptying a slot breaks searches for keys that were placed after probing past it. Instead the slot is marked with a **tombstone** (a "deleted" marker): searches continue past tombstones, and inserts may reuse them. Many tombstones degrade performance and are cleared during rehashing.

## 5. Load Factor and Rehashing

When α crosses a threshold, the table is **rehashed**: a new array (typically about twice the size, often rounded to a prime) is allocated and every key is reinserted using the new hash function, because `k mod m` changes when m changes. Rehashing costs O(n), but with geometric growth the amortized cost per insertion remains O(1), by the same argument as for dynamic arrays.

Typical thresholds:

- Chaining: α around 0.75 to 1.
- Open addressing: α around 0.5 to 0.7. CPython's `dict` resizes when it becomes two-thirds full.

```python
class ChainedHashTable:
    def __init__(self, m=11):
        self.m, self.n = m, 0
        self.buckets = [[] for _ in range(m)]

    def put(self, key, value):
        b = self.buckets[hash(key) % self.m]
        for i, (k, _) in enumerate(b):
            if k == key:
                b[i] = (key, value)
                return
        b.append((key, value))
        self.n += 1
        if self.n / self.m > 0.75:
            self._rehash(2 * self.m + 1)

    def _rehash(self, new_m):
        old = [pair for b in self.buckets for pair in b]
        self.m, self.n = new_m, 0
        self.buckets = [[] for _ in range(new_m)]
        for k, v in old:
            self.put(k, v)
```

## 6. Hash Tables versus Balanced BSTs

- Hash tables: O(1) expected lookup but no ordering; range queries, minimum and "next larger key" require O(n).
- Balanced BSTs: O(log n) worst case and support ordered operations and range queries.
- Hash tables have bad worst cases and can be attacked by inputs crafted to collide; randomised (universal or seeded) hashing mitigates this.

## 7. Pitfalls

- Using mutable objects as keys and then modifying them, which changes their hash.
- Forgetting that `equals`/`__eq__` and `hashCode`/`__hash__` must be consistent: equal keys must have equal hashes.
- Choosing a table size that shares factors with a regular key pattern.
