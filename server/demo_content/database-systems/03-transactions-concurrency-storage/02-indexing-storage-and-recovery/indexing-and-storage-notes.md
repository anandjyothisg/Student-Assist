# Storage, Indexing and B+ Trees

CS-305 Database Management Systems · Unit 3 · Lecture Notes

## 1. How Tables Are Stored

A DBMS stores data on disk in fixed-size **pages** (also called blocks), commonly 4 KB, 8 KB (PostgreSQL) or 16 KB (MySQL InnoDB). The page is the unit of transfer between disk and memory, so the cost of a query is measured in **page I/Os**. A random disk access costs milliseconds on a hard disk and tens of microseconds on an SSD, whereas an in-memory operation costs nanoseconds.

- **Heap file:** records are stored in no particular order. Insertion is cheap (append to a page with free space), but an equality or range search must scan every page.
- **Sorted file:** records ordered on some key; binary search takes `log2(P)` page reads for P pages, but inserts require shifting records.
- **Slotted page layout:** each page has a header with a slot directory pointing to variable-length records. A record is identified by its **record id (RID)** = `(page id, slot number)`, which stays valid when records move within the page.
- **Buffer pool:** a region of main memory caching pages. A requested page that is already in the pool costs no I/O. When the pool is full, a replacement policy (LRU, Clock, or variants) chooses a victim page; a dirty victim must be written back first.

## 2. Indexes

An **index** is an auxiliary structure that speeds up retrieval on a set of columns called the **search key** (which need not be a primary key). An index entry is either the full record, or a pair `(key, RID)`, or `(key, list of RIDs)`.

### 2.1 Clustered versus non-clustered

| Aspect | Clustered (primary) index | Non-clustered (secondary) index |
|---|---|---|
| Physical order | Data records stored in (approximately) index key order | Data order independent of the index |
| Number per table | At most one | Many |
| Range query cost | About one I/O per matching **page** | Up to one I/O per matching **record** |
| Example | InnoDB tables are clustered on the primary key | `CREATE INDEX idx_name ON Student(name)` |

**Worked example.** `Student` has 1,000,000 rows at 100 rows per page, so 10,000 pages. A query selects 10% of rows by a range on `gpa`.

- Full table scan: 10,000 I/Os.
- Clustered index on `gpa`: about 3 I/Os to descend the tree plus about 1,000 data pages, roughly **1,003 I/Os**.
- Non-clustered index on `gpa`: about 100,000 matching rows, each possibly on a different page, giving up to **100,000 I/Os**, ten times worse than scanning the whole table.

This is why optimizers ignore an unclustered index when a predicate is not selective; a common rule of thumb is that an unclustered index pays off only when a few percent of rows or fewer qualify.

### 2.2 Dense versus sparse

A **dense** index has an entry for every search-key value (every record). A **sparse** index has an entry for only some values, typically one per data page; it is possible only when the data file is sorted on the search key, so only a clustered index can be sparse.

### 2.3 Composite indexes

An index on `(dept, year)` supports searches on `dept` alone and on `dept` with `year`, but not efficiently on `year` alone, because the entries are sorted by `dept` first (the **leftmost-prefix rule**).

## 3. B+ Trees

The B+ tree is the default index structure in almost every relational DBMS. It is a balanced, multiway search tree optimized for disk.

### 3.1 Structure

- Each node occupies one page.
- **Internal nodes** hold only keys and child pointers and are used purely for navigation. A node with k keys has k + 1 children.
- **Leaf nodes** hold all the index entries (keys with RIDs or records) and are linked into a **doubly linked list** in key order, which makes range scans efficient.
- All leaves are at the same depth: the tree is perfectly height-balanced.
- With order d, every node except the root holds between d and 2d keys, so nodes are at least half full. The root holds between 1 and 2d keys.

### 3.2 Fan-out and height

The **fan-out** is the number of children per internal node. Because keys and pointers are small, fan-out is large: an 8 KB page with 8-byte keys and 8-byte pointers can hold about 500 entries. Using the textbook figures of order d = 100 and a typical fill factor of 67%, the average fan-out is about **133**:

| Height (levels of internal nodes above leaves) | Records indexed (133 entries per leaf) |
|---|---|
| 1 | 133² = 17,689 |
| 2 | 133³ = 2,352,637 |
| 3 | 133⁴ = 312,900,721 |

So a table of hundreds of millions of rows needs only about four page reads to reach a leaf, and the top one or two levels are almost always cached in the buffer pool. Search cost is `O(log_F N)` I/Os, where F is the fan-out.

### 3.3 Search, insertion and deletion

- **Search:** start at the root, at each internal node follow the child whose key range contains the search key, until a leaf is reached. A range query finds the first qualifying leaf, then follows leaf links.
- **Insert:** find the correct leaf and insert. If the leaf overflows (2d + 1 entries), **split** it into two leaves of d and d + 1 entries and **copy up** the smallest key of the new right leaf into the parent. If an internal node overflows, split it and **push up** its middle key (the key moves, rather than being copied). If the root splits, a new root is created, and the tree grows in height by one: **B+ trees grow at the root, not at the leaves**.
- **Delete:** remove the entry; if the leaf falls below d entries, **redistribute** with a sibling (borrow an entry and update the parent's separator) or, if the sibling is also at minimum, **merge** the two and delete a separator from the parent, which may propagate upwards.

```python
def bplus_search(node, key):
    while not node.is_leaf:
        i = bisect_right(node.keys, key)   # child i covers keys in [keys[i-1], keys[i])
        node = node.children[i]
    return node   # leaf that would contain key
```

### 3.4 B+ tree versus B tree

In a **B tree**, internal nodes also store data entries, so some searches end early, but internal nodes hold fewer keys (lower fan-out) and range scans require tree traversal. B+ trees keep all data in linked leaves, giving higher fan-out and simple sequential range scans; this is why databases use them.

## 4. Hash Indexes

A hash index applies a hash function to the search key to find a **bucket** (one primary page plus overflow pages).

- Equality search costs about **1 to 1.2 I/Os** on average, slightly better than a B+ tree.
- Hash indexes **cannot** support range queries, `ORDER BY` or prefix searches, because hashing destroys order.
- **Static hashing** develops long overflow chains as the file grows. **Extendible hashing** uses a directory of `2^g` pointers (g is the global depth) and splits only the overflowing bucket, doubling the directory when needed. **Linear hashing** splits buckets in a fixed round-robin order and needs no directory.

## 5. Choosing Indexes

- Index columns used in selective `WHERE` conditions and join conditions.
- Use the clustered index for the most important range queries.
- Every index slows `INSERT`, `UPDATE` and `DELETE`, since each index must be maintained, and consumes space.
- An index containing all columns a query needs (a **covering index**) allows an **index-only scan** with no access to the table.
