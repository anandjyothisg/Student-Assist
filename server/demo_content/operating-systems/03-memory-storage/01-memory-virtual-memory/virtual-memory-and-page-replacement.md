# Virtual Memory and Page Replacement — Worked Examples

CS-304 Operating Systems · Unit 3 · Memory and Storage Management

## 1. Demand Paging

Virtual memory lets a process execute even when only part of it is in physical memory. With **demand paging**, a page is loaded only when it is first referenced. A **lazy swapper** (pager) never brings in a page unless it is needed. Pure demand paging starts a process with **no** pages in memory.

The valid/invalid bit in each page-table entry marks whether the page is in memory. Referencing a page marked invalid causes a **page fault** trap.

### Handling a page fault

1. The MMU traps to the OS.
2. The OS checks an internal table: if the reference is illegal, terminate the process; if legal but not in memory, continue.
3. Find a free frame (or choose a victim using a page-replacement algorithm; if the victim is dirty, write it to disk first).
4. Schedule a disk read of the required page into the frame.
5. When the I/O completes, update the page table (frame number, valid bit).
6. **Restart the instruction** that caused the fault.

### Performance

With memory access time ma, page-fault rate p (0 <= p <= 1) and page-fault service time:

```
EAT = (1 - p) x ma + p x page_fault_time
```

Example: ma = 200 ns, fault service time = 8 ms = 8,000,000 ns.

- EAT = 200 + 7,999,800 × p ns.
- If p = 1/1000, EAT ≈ 200 + 8000 = **8.2 µs**, a slowdown by a factor of about **40**.
- To keep the slowdown below 10% (EAT < 220 ns): 7,999,800 × p < 20, so **p < 0.0000025**, that is fewer than one fault per 400,000 accesses.

**Copy-on-write** lets a child created by `fork()` share the parent's pages until one of them writes, at which point only the written page is copied.

## 2. Page Replacement

When no frame is free, the OS chooses a **victim** page. Using the **dirty (modify) bit**, unmodified victims need not be written back, halving the I/O for those faults. Algorithms are evaluated by counting page faults on a **reference string**.

All examples below use the reference string (20 references) with **3 frames**, initially empty:

```
7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1
```

In the traces, `F` marks a fault and the frame contents are listed after each reference.

### 2.1 FIFO

Replace the page that has been in memory **longest**.

| Ref | 7 | 0 | 1 | 2 | 0 | 3 | 0 | 4 | 2 | 3 | 0 | 3 | 2 | 1 | 2 | 0 | 1 | 7 | 0 | 1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Frames | 7 | 7 0 | 7 0 1 | 2 0 1 | 2 0 1 | 2 3 1 | 2 3 0 | 4 3 0 | 4 2 0 | 4 2 3 | 0 2 3 | 0 2 3 | 0 2 3 | 0 1 3 | 0 1 2 | 0 1 2 | 0 1 2 | 7 1 2 | 7 0 2 | 7 0 1 |
| Fault | F | F | F | F | | F | F | F | F | F | F | | | F | F | | | F | F | F |

FIFO: **15 page faults**.

### 2.2 Optimal (OPT / MIN)

Replace the page that will **not be used for the longest time** in the future. It gives the lowest possible fault rate for a fixed number of frames but needs future knowledge, so it serves as a benchmark.

| Ref | 7 | 0 | 1 | 2 | 0 | 3 | 0 | 4 | 2 | 3 | 0 | 3 | 2 | 1 | 2 | 0 | 1 | 7 | 0 | 1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Frames | 7 | 7 0 | 7 0 1 | 2 0 1 | 2 0 1 | 2 0 3 | 2 0 3 | 2 4 3 | 2 4 3 | 2 4 3 | 2 0 3 | 2 0 3 | 2 0 3 | 2 0 1 | 2 0 1 | 2 0 1 | 2 0 1 | 7 0 1 | 7 0 1 | 7 0 1 |
| Fault | F | F | F | F | | F | | F | | | F | | | F | | | | F | | |

Sample decisions: at reference 2 (position 4), the next uses are 0 at position 5, 1 at position 14 and 7 at position 18, so 7 is replaced. At reference 4 (position 8), next uses are 2 at 9, 3 at 10 and 0 at 11, so 0 is replaced.

OPT: **9 page faults**.

### 2.3 Least Recently Used (LRU)

Replace the page that has **not been used for the longest time** in the past, approximating OPT by looking backward.

| Ref | 7 | 0 | 1 | 2 | 0 | 3 | 0 | 4 | 2 | 3 | 0 | 3 | 2 | 1 | 2 | 0 | 1 | 7 | 0 | 1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Frames | 7 | 7 0 | 7 0 1 | 2 0 1 | 2 0 1 | 2 0 3 | 2 0 3 | 4 0 3 | 4 0 2 | 4 3 2 | 0 3 2 | 0 3 2 | 0 3 2 | 1 3 2 | 1 3 2 | 1 0 2 | 1 0 2 | 1 0 7 | 1 0 7 | 1 0 7 |
| Fault | F | F | F | F | | F | | F | F | F | F | | | F | | F | | F | | |

LRU: **12 page faults**.

### Comparison

| Algorithm | Faults (3 frames) | Implementable? | Belady's anomaly? |
|---|---|---|---|
| FIFO | 15 | Yes, simple queue | Yes |
| Optimal | 9 | No (needs future) | No |
| LRU | 12 | Yes, but needs hardware support (counters or a stack) | No |

LRU and OPT are **stack algorithms**: the set of pages in memory with n frames is always a subset of the set with n + 1 frames, so adding frames can never increase faults. In practice LRU is approximated using the reference bit, for example with the **second-chance (clock)** algorithm.

## 3. Belady's Anomaly

For FIFO, adding frames can **increase** the number of faults. Reference string:

```
1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5
```

- FIFO with 3 frames: **9 faults**.
- FIFO with 4 frames: **10 faults**.

Trace with 4 frames: 1, 2, 3, 4 fault (4); 1, 2 hit; 5 faults replacing 1 (5); 1 faults replacing 2 (6); 2 faults replacing 3 (7); 3 faults replacing 4 (8); 4 faults replacing 5 (9); 5 faults replacing 1 (10).

## 4. Thrashing

A process is **thrashing** when it spends more time paging than executing. The cycle: too few frames → frequent faults → processes block on I/O → CPU utilisation drops → the scheduler admits more processes to raise utilisation → even fewer frames per process → more faults. Increasing the degree of multiprogramming beyond a point makes CPU utilisation collapse.

### Locality and the working-set model

Programs move between **localities** (sets of pages actively used together). The **working set** WS(t, Δ) is the set of pages referenced in the most recent Δ references (the working-set window).

- If Δ is too small, it does not cover the whole locality; if too large, it spans several localities.
- Total demand D = Σ WSS_i (sum of working-set sizes). If **D > m** (available frames), thrashing will occur, so the OS **suspends** a process and redistributes its frames.

Example: with Δ = 10 and the recent references `2, 6, 1, 5, 7, 7, 7, 7, 5, 1`, WS = {1, 2, 5, 6, 7}, so WSS = 5.

### Page-fault frequency (PFF)

A more direct control sets upper and lower bounds on each process's fault rate: above the upper bound, give the process another frame; below the lower bound, take a frame away. If no free frames exist when a process exceeds the upper bound, suspend a process.
