# Locking, Deadlocks and Isolation Levels

CS-305 Database Management Systems · Unit 3 · Lecture Notes

## 1. Lock-Based Concurrency Control

The most common way to guarantee serializable schedules is to require transactions to **lock** data items before accessing them. Two lock modes are used:

- **Shared (S) lock:** required to read an item. Many transactions may hold S locks on the same item.
- **Exclusive (X) lock:** required to write an item. Only one transaction may hold it, and no S locks may coexist with it.

### Lock compatibility matrix

| Requested \ Held | S | X |
|---|---|---|
| S | Compatible | Conflict (wait) |
| X | Conflict (wait) | Conflict (wait) |

A transaction holding an S lock may **upgrade** it to X when no other transaction holds an S lock on the item. Locking alone does not guarantee serializability: if a transaction releases a lock and later acquires another, other transactions may slip in between and create a non-serializable interleaving.

## 2. Two-Phase Locking (2PL)

Under **two-phase locking**, each transaction has:

1. A **growing phase**, in which it may acquire locks but not release any.
2. A **shrinking phase**, in which it may release locks but not acquire any.

The moment a transaction acquires its final lock is its **lock point**.

**Theorem:** every schedule produced by 2PL is conflict serializable, and an equivalent serial order is the order of the transactions' lock points.

Basic 2PL has two weaknesses:

- It does not prevent **cascading aborts**: T1 may release its X lock on A during its shrinking phase, T2 reads A, and then T1 aborts, forcing T2 to abort too.
- It does not prevent **deadlocks**.

### Variants

| Protocol | Rule | Guarantees |
|---|---|---|
| Basic 2PL | No lock acquired after any lock released | Conflict serializability |
| Strict 2PL | Hold all **X locks** until commit or abort | + Strict schedules, no cascading aborts |
| Rigorous (strong strict) 2PL | Hold **all locks** (S and X) until commit or abort | + Serial order equals commit order |
| Conservative (static) 2PL | Acquire all locks before the transaction starts | + No deadlocks, but needs the read/write set in advance |

Strict 2PL is the protocol used by most lock-based commercial systems. Conservative 2PL is deadlock-free but rarely practical.

## 3. Deadlocks

A **deadlock** occurs when a set of transactions each wait for a lock held by another member of the set. Example: T1 holds X(A) and requests X(B); T2 holds X(B) and requests X(A). Neither can proceed.

### 3.1 Detection

The system maintains a **wait-for graph**: an edge `Ti → Tj` means Ti waits for a lock held by Tj. A deadlock exists **if and only if the graph has a cycle**. The detector runs periodically, and when a cycle is found it chooses a **victim** to abort, typically the transaction that has done the least work, holds the fewest locks, or has been restarted the fewest times (to avoid starvation).

### 3.2 Prevention with timestamps

Each transaction gets a timestamp when it starts; a smaller timestamp means older. When Ti requests a lock held by Tj:

| Scheme | If Ti is older than Tj | If Ti is younger than Tj |
|---|---|---|
| **Wait-die** (non-preemptive) | Ti waits | Ti dies (aborts) |
| **Wound-wait** (preemptive) | Ti wounds Tj (Tj aborts) | Ti waits |

In both schemes, an aborted transaction restarts with its **original** timestamp, so it eventually becomes the oldest and cannot starve. In both, waits only ever go in one direction of age, so a cycle cannot form.

### 3.3 Timeouts

A transaction that waits longer than a fixed interval is assumed to be deadlocked and is aborted. Simple and cheap, but it may abort transactions that were merely slow, and choosing the interval is difficult.

## 4. The Phantom Problem

Locking individual rows does not prevent **phantoms**. If T1 runs `SELECT COUNT(*) FROM Enrollment WHERE cid = 'CS305'` and T2 then inserts a new CS305 enrolment and commits, a second count in T1 returns a different number, even though every row T1 read stayed locked. The new row did not exist to be locked. Solutions include **predicate locks**, **index-range (next-key) locks** on the index entries covering the range, or table-level locks.

## 5. SQL Isolation Levels

SQL lets applications trade correctness for concurrency by choosing an isolation level:

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

| Isolation level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| READ UNCOMMITTED | Possible | Possible | Possible |
| READ COMMITTED | Prevented | Possible | Possible |
| REPEATABLE READ | Prevented | Prevented | Possible |
| SERIALIZABLE | Prevented | Prevented | Prevented |

A typical lock-based implementation:

- **Read uncommitted:** reads take no S locks.
- **Read committed:** S locks are released immediately after each read; X locks held to commit.
- **Repeatable read:** S and X locks on rows held to commit, but no range locks, so phantoms remain possible.
- **Serializable:** strict 2PL plus range or predicate locking.

### Defaults in practice

- PostgreSQL and Oracle default to **READ COMMITTED**; MySQL InnoDB defaults to **REPEATABLE READ**.
- PostgreSQL never allows dirty reads, even at READ UNCOMMITTED.
- MySQL InnoDB prevents most phantoms at REPEATABLE READ using next-key locks.

## 6. Multiversion Concurrency Control (MVCC)

Many systems (PostgreSQL, Oracle, MySQL InnoDB) keep multiple versions of each row. A reader sees a **snapshot** of the committed data as of its start time, so **readers never block writers and writers never block readers**. Writers still conflict with each other: under the "first committer wins" rule, if two concurrent transactions update the same row, the second to commit is aborted.

**Snapshot isolation** prevents dirty reads, non-repeatable reads and lost updates, but it is **not** serializable. It permits **write skew**: two doctors on call each check that at least one other doctor is on call, then each takes themselves off call; each update touches a different row, so no conflict is detected, and the constraint "at least one doctor on call" is violated. PostgreSQL's SERIALIZABLE level adds **Serializable Snapshot Isolation (SSI)**, which detects such dangerous dependency patterns and aborts one transaction.

## 7. Pitfalls

- Assuming 2PL prevents deadlocks; only conservative 2PL does.
- Assuming REPEATABLE READ prevents phantoms in the ANSI definition.
- Treating snapshot isolation as equivalent to serializable.
- Forgetting to retry transactions that are aborted as deadlock victims or serialization failures: applications must catch these errors and rerun the transaction.
