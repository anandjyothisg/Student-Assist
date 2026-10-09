# Join Algorithms and I/O Cost Reference

CS-305 Database Management Systems · Unit 2 · Reference Sheet

This sheet summarises the physical join algorithms used by a query processor and how to compute their cost in page I/Os. Formulas follow the convention used in lectures: cost counts pages read and written, and **ignores the cost of writing the final join result**, which is the same for every algorithm.

## 1. Notation

| Symbol | Meaning |
|---|---|
| R, S | The two input relations; R is the outer relation unless stated |
| M | Number of pages of R |
| N | Number of pages of S |
| p_R, p_S | Tuples per page of R and S |
| m = M · p_R | Number of tuples of R |
| B | Number of available buffer pages in memory |

## 2. Running Example

- R = Enrollment: M = 1,000 pages, p_R = 100, so m = 100,000 tuples.
- S = Student: N = 500 pages, p_S = 80, so 40,000 tuples.
- Buffer: B = 102 pages.
- Join condition: `R.sid = S.sid` (an equi-join).
- Assume 10 ms per page I/O for time estimates.

## 3. Nested-Loop Joins

### 3.1 Simple (tuple-at-a-time) nested loop

For each tuple of R, scan all of S.

`Cost = M + m · N`

Example: `1,000 + 100,000 × 500 = 50,001,000` I/Os, about 139 hours. With S as outer: `500 + 40,000 × 1,000 = 40,000,500`.

### 3.2 Page-oriented nested loop

For each page of R, scan S once and join all tuple pairs of the two pages.

`Cost = M + M · N`

Example: `1,000 + 1,000 × 500 = 501,000`. With S as outer: `500 + 500 × 1,000 = 500,500`. The smaller relation should be the outer.

### 3.3 Block nested loop

Use `B − 2` buffer pages for a block of R, one page for scanning S, one for output. For each block of R, scan S once.

`Cost = M + ceil(M / (B − 2)) · N`

Example (R outer): blocks of 100 pages, `ceil(1,000 / 100) = 10` scans of S: `1,000 + 10 × 500 = 6,000` I/Os (60 s).
Example (S outer): `500 + ceil(500 / 100) × 1,000 = 500 + 5,000 = 5,500` I/Os (55 s).
If the smaller relation fits entirely in `B − 2` pages, the cost drops to `M + N`, a single pass over each.

```python
def block_nested_loop(R_pages, S_pages, B):
    block = B - 2
    for i in range(0, len(R_pages), block):
        chunk = [t for page in R_pages[i:i + block] for t in page]
        table = {}
        for r in chunk:                      # in-memory hash on the block
            table.setdefault(r.sid, []).append(r)
        for page in S_pages:                 # one full scan of S per block
            for s in page:
                for r in table.get(s.sid, []):
                    yield (r, s)
```

### 3.4 Index nested loop

If S has an index on the join attribute, for each tuple of R probe the index instead of scanning S.

`Cost = M + m · (cost of index lookup + cost of fetching matches)`

Typical lookup costs: about 1.2 I/Os for a hash index, 2 to 4 for a B+ tree. Fetching matches costs about 1 I/O per matching page with a clustered index, and up to 1 I/O per matching tuple with an unclustered index.
Example with a hash index on `Student.sid` (1.2 + 1 I/O per probe): `1,000 + 100,000 × 2.2 = 221,000` I/Os. Index nested loop is most attractive when the outer relation is small, for example after a selective `WHERE` condition.

## 4. Sort-Merge Join

1. Sort R and S on the join attribute (external merge sort if they do not fit in memory).
2. Merge the sorted relations, advancing whichever side has the smaller current key and outputting all pairs with equal keys.

External sort of a relation of P pages with B buffers makes `ceil(P / B)` initial sorted runs, then merges up to `B − 1` runs per pass. Each pass reads and writes every page: `2 · P` I/Os per pass.

`Cost = sort(R) + sort(S) + (M + N)`

Example: R gives `ceil(1,000 / 102) = 10` runs, merged in one pass, so 2 passes: `4 × 1,000 = 4,000`. S gives 5 runs, 2 passes: `4 × 500 = 2,000`. Merge: `1,500`. **Total 7,500 I/Os.**

**Refinement:** if the total number of runs of R and S is at most `B − 1` (here 10 + 5 = 15), the final merge pass of both sorts can be combined with the join, giving `3 · (M + N) = 4,500` I/Os.

Advantages: the output is sorted on the join key, which helps a later `ORDER BY`, `GROUP BY` or merge join. If the inputs are already sorted (for example, read through a clustered B+ tree), the sort cost disappears. Many duplicate join keys on both sides can degrade the merge phase towards nested-loop behaviour.

## 5. Hash Join (Grace Hash Join)

1. **Partition phase:** hash both R and S on the join attribute with hash function h1 into `B − 1` partitions each, writing partitions to disk. Matching tuples are guaranteed to land in partitions with the same number.
2. **Probe phase:** for each partition i, load `S_i` (the smaller) into memory and build an in-memory hash table with a different hash function h2; scan `R_i` and probe.

`Cost = 2 · (M + N)` for partitioning (read and write) `+ (M + N)` for probing `= 3 · (M + N)`

Example: `3 × 1,500 = 4,500` I/Os (45 s).
Memory requirement: each partition of the smaller relation must fit in memory, which holds roughly when `B > sqrt(N)` for the smaller relation of N pages (here `sqrt(500) ≈ 22.4`, comfortably below 102). Skewed join values can produce oversized partitions that need recursive partitioning. Hash join works only for **equality** conditions.

## 6. Summary for the Running Example

| Algorithm | Formula | I/Os |
|---|---|---|
| Simple nested loop (R outer) | M + m · N | 50,001,000 |
| Page nested loop (S outer) | N + N · M | 500,500 |
| Index nested loop (hash index on S) | M + m · 2.2 | 221,000 |
| Block nested loop (S outer) | N + ceil(N/(B−2)) · M | 5,500 |
| Sort-merge (basic) | sort + M + N | 7,500 |
| Sort-merge (refined) | 3(M + N) | 4,500 |
| Grace hash join | 3(M + N) | 4,500 |

## 7. Rules of Thumb

- Put the smaller relation on the outside of a nested-loop join.
- If one relation fits in memory, any reasonable algorithm costs about `M + N`.
- Hash join is usually best for large unsorted equi-joins; sort-merge wins when inputs are already sorted or sorted output is needed; index nested loop wins when the outer input is small and the inner side is indexed.
- Only nested-loop variants handle arbitrary theta conditions such as `R.a < S.b`.
