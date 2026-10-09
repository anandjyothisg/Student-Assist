# Logging and Crash Recovery: WAL and ARIES

CS-305 Database Management Systems · Unit 3 · Lecture Notes

## 1. What Recovery Must Guarantee

The recovery manager is responsible for **atomicity** and **durability**. After any failure, the database must reflect all updates of committed transactions and none of the updates of transactions that had not committed.

Types of failure:

- **Transaction failure:** a logical error or a deliberate abort (for example, a deadlock victim).
- **System crash:** power loss or an operating-system or DBMS failure; main memory (including the buffer pool) is lost, disk survives.
- **Media failure:** disk contents are lost; recovered from backups plus archived logs.

## 2. Buffer Management Policies

Two policy choices determine what kind of recovery work is needed:

- **Steal:** the buffer manager may write a page modified by an *uncommitted* transaction to disk (to free a buffer frame). Then, after a crash, those changes may have to be **undone**.
- **Force:** all pages modified by a transaction are written to disk *before* it commits. With **no-force**, committed changes may exist only in memory at the time of a crash and must be **redone**.

| Policy | Undo needed? | Redo needed? | Comment |
|---|---|---|---|
| No-steal / Force | No | No | Simple but slow; buffer pool fills; many random writes at commit |
| Steal / Force | Yes | No | |
| No-steal / No-force | No | Yes | |
| **Steal / No-force** | Yes | Yes | Best run-time performance; used by ARIES and most real systems |

## 3. The Log and Write-Ahead Logging

The **log** is an append-only sequence of records stored on stable storage. Each record has a monotonically increasing **log sequence number (LSN)**. An update record typically contains:

`<LSN, prevLSN, txnID, type = UPDATE, pageID, offset, before-image, after-image>`

where `prevLSN` links the records of the same transaction backwards. Other record types: `BEGIN`, `COMMIT`, `ABORT`, `END`, **compensation log records (CLRs)**, and checkpoint records.

The **write-ahead logging (WAL)** protocol has two rules:

1. **Undo rule:** the log record for an update must be forced to stable storage **before** the corresponding data page is written to disk. Otherwise a stolen page could reach disk with no record of how to undo it.
2. **Redo rule:** all log records of a transaction, including its `COMMIT` record, must be forced to stable storage **before** the commit is acknowledged. A transaction is committed precisely when its commit record is on disk.

Forcing the log at commit is cheap compared with forcing data pages: the log is written sequentially, and **group commit** batches the commit records of several transactions into one log write.

To enforce rule 1, each data page stores a **pageLSN** (the LSN of the latest update applied to it), and the system tracks **flushedLSN** (the largest LSN written to the log on disk). A page may be written to disk only if `pageLSN ≤ flushedLSN`.

## 4. Checkpoints

Without checkpoints, recovery would have to scan the entire log. A **checkpoint** records enough state to limit the scan.

- A simple (**consistent**) checkpoint stops new transactions, flushes all dirty pages, and writes a checkpoint record; this stalls the system.
- A **fuzzy checkpoint**, used by ARIES, writes a `BEGIN_CHECKPOINT` record, then an `END_CHECKPOINT` record containing the current **transaction table** and **dirty page table**, without flushing pages or pausing transactions. The LSN of the most recent `BEGIN_CHECKPOINT` is stored in a well-known **master record** on disk.

## 5. ARIES

ARIES (Algorithms for Recovery and Isolation Exploiting Semantics, Mohan et al., IBM, 1992) is the standard recovery algorithm for steal/no-force systems. Its three principles:

- **Write-ahead logging.**
- **Repeating history during redo:** reapply *all* logged updates, including those of transactions that will later be undone, bringing the database to its exact state at the crash.
- **Logging changes during undo:** every undo action writes a CLR so that undo work is never repeated if the system crashes again during recovery.

### 5.1 Data structures

- **Transaction table (TT):** one entry per active transaction with its status and `lastLSN` (most recent log record).
- **Dirty page table (DPT):** one entry per dirty page in the buffer pool with its `recLSN`, the LSN of the first update that made the page dirty.
- **CLR:** describes an undo action and contains `undoNextLSN`, the LSN of the next record of that transaction still to be undone. CLRs are redone but never undone.

### 5.2 The three phases

1. **Analysis:** start from the most recent `BEGIN_CHECKPOINT`, load TT and DPT from the `END_CHECKPOINT` record, and scan forward to the end of the log. Add transactions on `BEGIN`/update records, mark them committed on `COMMIT`, remove them on `END`, and add pages to the DPT on first update. Output: the set of **loser** transactions (still active at the crash) and the **redoLSN = smallest recLSN in the DPT**.
2. **Redo:** scan forward from redoLSN, reapplying each update or CLR, **unless** the page is not in the DPT, or the record's LSN is less than the page's recLSN, or the page's pageLSN (read from disk) is at least the record's LSN. Each skip condition means the change is already on disk.
3. **Undo:** roll back all losers together by processing their log records in **descending LSN order** (using a priority queue of each loser's next LSN to undo). For each update, restore the before-image, write a CLR, and follow `prevLSN`; on reaching a CLR, jump to its `undoNextLSN`. When a loser's first record is undone, write an `END` record for it.

## 6. Worked Example

Log at the time of the crash:

| LSN | Record |
|---|---|
| 10 | T1 UPDATE P5 |
| 20 | T2 UPDATE P3 |
| 30 | BEGIN_CHECKPOINT |
| 40 | END_CHECKPOINT (TT: T1 lastLSN 10, T2 lastLSN 20; DPT: P5 recLSN 10, P3 recLSN 20) |
| 50 | T1 COMMIT |
| 60 | T3 UPDATE P1 |
| 70 | T2 UPDATE P5 |
| 80 | T1 END |
| — | CRASH |

**Analysis** (from LSN 30): LSN 50 marks T1 committed; LSN 60 adds T3 (lastLSN 60) and adds P1 to the DPT with recLSN 60; LSN 70 sets T2's lastLSN to 70 (P5 is already dirty); LSN 80 removes T1. Losers: **T2 and T3**. DPT: P5 (10), P3 (20), P1 (60), so **redoLSN = 10**.

**Redo:** scan from LSN 10 and reapply updates 10, 20, 60 and 70 unless the pageLSN check shows they are already on disk. T1's committed update at LSN 10 is thus guaranteed to be present (durability), and the losers' updates are reapplied too (repeating history).

**Undo:** to-undo set {70 (T2), 60 (T3)}.

1. Undo LSN 70 (T2, P5): write CLR with `undoNextLSN = 20`.
2. Undo LSN 60 (T3, P1): write CLR with `undoNextLSN = null`; write `END` for T3.
3. Undo LSN 20 (T2, P3): write CLR with `undoNextLSN = null`; write `END` for T2.

If the system crashes again during undo, redo reapplies the CLRs, and undo resumes from their `undoNextLSN` values, so no update is undone twice.

```python
def undo_phase(losers, log):
    to_undo = {t.last_lsn for t in losers}        # max-heap in practice
    while to_undo:
        lsn = max(to_undo); to_undo.remove(lsn)
        rec = log[lsn]
        if rec.type == "CLR":
            nxt = rec.undo_next_lsn
        else:                                     # UPDATE
            apply_before_image(rec)
            log.append_clr(rec, undo_next=rec.prev_lsn)
            nxt = rec.prev_lsn
        if nxt is None:
            log.append_end(rec.txn)
        else:
            to_undo.add(nxt)
```

## 7. Pitfalls

- Believing redo applies only committed transactions: ARIES redoes everything, then undoes losers.
- Confusing recLSN (first change that dirtied the page) with pageLSN (latest change applied to the page).
- Forgetting that a fuzzy checkpoint does not flush dirty pages, which is why redo may start before the checkpoint.
