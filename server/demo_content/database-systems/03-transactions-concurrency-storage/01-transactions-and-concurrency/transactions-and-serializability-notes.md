# Transactions, Schedules and Serializability

CS-305 Database Management Systems · Unit 3 · Lecture Notes

## 1. Transactions

A **transaction** is a sequence of reads and writes that the DBMS treats as one logical unit of work, ending in either `COMMIT` (all its changes become permanent) or `ABORT`/`ROLLBACK` (all its changes are undone).

```sql
BEGIN;
UPDATE Account SET balance = balance - 500 WHERE acc_no = 'A';
UPDATE Account SET balance = balance + 500 WHERE acc_no = 'B';
COMMIT;
```

If the system crashes between the two updates, the transfer must not be left half done.

## 2. The ACID Properties

| Property | Meaning | Mechanism responsible |
|---|---|---|
| **Atomicity** | All of a transaction's operations take effect, or none do | Recovery manager: undo using the log |
| **Consistency** | A transaction run alone takes the database from one valid state to another, preserving integrity constraints | Application logic plus DBMS constraint checking |
| **Isolation** | Concurrent transactions do not see each other's intermediate states; the outcome equals some serial execution | Concurrency control (locking, MVCC, timestamps) |
| **Durability** | Once committed, changes survive subsequent crashes | Recovery manager: write-ahead log, redo |

In the transfer example: atomicity prevents debiting A without crediting B; consistency means the total of A and B is unchanged; isolation means a concurrent report never sees the money "in flight"; durability means a crash after `COMMIT` returns does not lose the transfer.

### Transaction states

**Active** → **partially committed** (last statement executed) → **committed**; or **active** → **failed** → **aborted**. After an abort, the transaction may be restarted (if the failure was not a logic error) or killed.

## 3. Why Concurrency Needs Control

Interleaving transactions improves throughput (CPU work overlaps I/O) and reduces average response time, but uncontrolled interleaving causes anomalies:

- **Lost update (write–write):** T1 and T2 both read `A = 100`. T1 writes `A = 100 − 50 = 50`; T2 then writes `A = 100 + 30 = 130`. T1's update is lost; the correct result is 80.
- **Dirty read (write–read):** T2 reads a value written by T1 before T1 commits; T1 then aborts, so T2 has used a value that never officially existed.
- **Unrepeatable read (read–write):** T1 reads A, T2 updates and commits A, T1 reads A again and sees a different value.
- **Phantom:** T1 runs a query with a range condition twice and sees new rows that T2 inserted in between.

## 4. Schedules

A **schedule** is an ordering of the operations of a set of transactions that preserves the order of operations within each transaction. Notation: `R1(A)` means T1 reads A, `W2(B)` means T2 writes B, `C1` means T1 commits.

- **Serial schedule:** transactions run one after another with no interleaving. For n transactions there are `n!` serial schedules. Every serial schedule is considered correct.
- **Serializable schedule:** produces the same effect as some serial schedule.

## 5. Conflict Serializability

Two operations **conflict** if they belong to different transactions, access the same data item, and at least one of them is a write. The conflicting pairs are therefore read–write, write–read and write–write; two reads never conflict.

Two schedules are **conflict equivalent** if one can be turned into the other by swapping adjacent non-conflicting operations. A schedule is **conflict serializable** if it is conflict equivalent to a serial schedule.

### 5.1 Precedence graph test

1. Create a node for each committed transaction.
2. For each pair of conflicting operations where `Ti`'s operation comes before `Tj`'s, add an edge `Ti → Tj`.
3. The schedule is conflict serializable **if and only if the graph is acyclic**. An equivalent serial order is any **topological order** of the graph.

### 5.2 Example 1: serializable

`S1: R1(A) W1(A) R2(A) W2(A) R1(B) W1(B) R2(B) W2(B)`

Every conflict on A and on B has T1's operation first, giving only the edge `T1 → T2`. The graph is acyclic, so S1 is conflict serializable and equivalent to the serial order **T1, T2**.

### 5.3 Example 2: not serializable

`S2: R1(A) W1(A) R2(A) W2(A) R2(B) R1(B) W1(B)`

- On A: `W1(A)` precedes `R2(A)`: edge `T1 → T2`.
- On B: `R2(B)` precedes `W1(B)`: edge `T2 → T1`.

The graph has the cycle `T1 → T2 → T1`, so S2 is **not** conflict serializable.

```python
def conflict_serializable(schedule):
    """schedule: list of (txn, op, item) with op in {'R', 'W'}."""
    edges = set()
    for i, (ti, opi, xi) in enumerate(schedule):
        for tj, opj, xj in schedule[i + 1:]:
            if ti != tj and xi == xj and 'W' in (opi, opj):
                edges.add((ti, tj))
    return edges   # then check the graph for a cycle (e.g. DFS)
```

### 5.4 View serializability

View serializability is a weaker condition: two schedules are view equivalent if each read sees the value written by the same transaction (or the initial value) and the final write of each item is by the same transaction. Every conflict-serializable schedule is view serializable, but not conversely; the extra view-serializable schedules always contain **blind writes** (writes without a preceding read by the same transaction). Testing view serializability is NP-complete, so practical systems enforce conflict serializability.

## 6. Recoverability

Serializability alone does not handle aborts. Schedules are classified further:

- **Recoverable:** if Tj reads a value written by Ti, then Ti commits before Tj commits. Otherwise, if Ti aborts after Tj has committed, Tj cannot be undone.
- **Cascadeless (avoids cascading aborts):** transactions read only values written by **committed** transactions. Without this, one abort can force a chain of dependent transactions to abort.
- **Strict:** no transaction reads or overwrites an item written by an uncommitted transaction. Strict schedules allow undo by simply restoring before-images.

Each class contains the next: recoverable ⊃ cascadeless ⊃ strict. Strict two-phase locking, covered in the next handout, produces schedules that are both conflict serializable and strict.

## 7. Pitfalls

- Counting two reads of the same item as a conflict.
- Adding precedence edges between operations on different items.
- Forgetting that a precedence graph is built only for the conflicting pairs, but must consider all such pairs, not just adjacent ones.
