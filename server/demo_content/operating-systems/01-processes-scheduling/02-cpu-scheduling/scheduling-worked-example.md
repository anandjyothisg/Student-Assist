# CPU Scheduling — Worked Gantt-Chart Example

CS-304 Operating Systems · Unit 1 · Tutorial Solutions

This worked example applies four algorithms to the same set of processes so that their results can be compared directly. Learn the procedure, not just the numbers: exam questions change the data.

## Problem Data

| Process | Arrival time (ms) | CPU burst (ms) |
|---|---|---|
| P1 | 0 | 8 |
| P2 | 1 | 4 |
| P3 | 2 | 9 |
| P4 | 3 | 5 |

Total CPU work = 8 + 4 + 9 + 5 = **26 ms**, so every schedule (with no idle time) finishes at t = 26.

Formulas used throughout:

```
Turnaround time (TAT) = Completion time (CT) - Arrival time (AT)
Waiting time (WT)     = TAT - Burst time (BT)
Response time (RT)    = First start time - Arrival time
```

Context-switch overhead is ignored.

## 1. First-Come, First-Served (FCFS)

Processes run in arrival order without preemption.

```
| P1        | P2    | P3          | P4     |
0           8       12            21       26
```

| Process | CT | TAT = CT − AT | WT = TAT − BT |
|---|---|---|---|
| P1 | 8 | 8 | 0 |
| P2 | 12 | 11 | 7 |
| P3 | 21 | 19 | 10 |
| P4 | 26 | 23 | 18 |
| **Average** | | **15.25** | **8.75** |

## 2. Non-preemptive Shortest-Job-First (SJF)

At t = 0 only P1 has arrived, so P1 runs to completion (non-preemptive) even though shorter jobs arrive soon after. At t = 8 the ready queue holds P2 (4), P3 (9) and P4 (5): pick P2, then P4, then P3.

```
| P1        | P2    | P4     | P3          |
0           8       12       17            26
```

| Process | CT | TAT | WT |
|---|---|---|---|
| P1 | 8 | 8 | 0 |
| P2 | 12 | 11 | 7 |
| P3 | 26 | 24 | 15 |
| P4 | 17 | 14 | 9 |
| **Average** | | **14.25** | **7.75** |

## 3. Shortest-Remaining-Time-First (SRTF, preemptive SJF)

Re-evaluate whenever a process arrives or finishes.

- t = 0: only P1 (remaining 8). Run P1.
- t = 1: P2 arrives with 4 < P1's remaining 7. **Preempt** P1; run P2.
- t = 2: P3 arrives (9). P2 has 3 remaining, the smallest. Continue P2.
- t = 3: P4 arrives (5). P2 has 2 remaining. Continue P2.
- t = 5: P2 finishes. Remaining: P1 = 7, P3 = 9, P4 = 5. Run P4.
- t = 10: P4 finishes. Run P1 (7) before P3 (9).
- t = 17: P1 finishes. Run P3 until t = 26.

```
| P1 | P2      | P4       | P1            | P3              |
0    1         5          10              17                26
```

| Process | CT | TAT | WT |
|---|---|---|---|
| P1 | 17 | 17 | 9 |
| P2 | 5 | 4 | 0 |
| P3 | 26 | 24 | 15 |
| P4 | 10 | 7 | 2 |
| **Average** | | **13.00** | **6.50** |

Check P1's waiting time directly: it waits from t = 1 to t = 10, which is 9 ms. This agrees with TAT − BT = 17 − 8.

## 4. Round Robin with Time Quantum q = 4 ms

Convention: when a process arrives at the same moment another is preempted, the **newly arrived process enters the ready queue first**. Here all arrivals happen before t = 4, so the convention does not change the result.

Step-by-step trace of the ready queue:

| Time | Event | Runs | Ready queue after event |
|---|---|---|---|
| 0 | P1 starts | P1 (0–4), 4 left | P2, P3, P4 arrive at 1, 2, 3 |
| 4 | P1 quantum expires | P2 (4–8), finishes | P3, P4, P1 |
| 8 | P2 done | P3 (8–12), 5 left | P4, P1, P3 |
| 12 | P3 preempted | P4 (12–16), 1 left | P1, P3, P4 |
| 16 | P4 preempted | P1 (16–20), finishes | P3, P4 |
| 20 | P1 done | P3 (20–24), 1 left | P4, P3 |
| 24 | P3 preempted | P4 (24–25), finishes | P3 |
| 25 | P4 done | P3 (25–26), finishes | — |

```
| P1   | P2   | P3   | P4   | P1   | P3   |P4|P3|
0      4      8      12     16     20     24 25 26
```

| Process | CT | TAT | WT | Response time |
|---|---|---|---|---|
| P1 | 20 | 20 | 12 | 0 |
| P2 | 8 | 7 | 3 | 3 |
| P3 | 26 | 24 | 15 | 6 |
| P4 | 25 | 22 | 17 | 9 |
| **Average** | | **18.25** | **11.75** | **4.50** |

Number of context switches between different processes: 7 (at t = 4, 8, 12, 16, 20, 24, 25).

## 5. Comparison

| Algorithm | Avg TAT (ms) | Avg WT (ms) | Avg response (ms) |
|---|---|---|---|
| FCFS | 15.25 | 8.75 | 8.75 |
| SJF (non-preemptive) | 14.25 | 7.75 | 7.75 |
| SRTF | 13.00 | 6.50 | 4.25 |
| RR (q = 4) | 18.25 | 11.75 | 4.50 |

SRTF response times: P1 = 0, P2 = 1 − 1 = 0, P3 = 17 − 2 = 15 (it first runs at t = 17), P4 = 5 − 3 = 2; average (0 + 0 + 15 + 2) / 4 = **4.25 ms**. For the non-preemptive algorithms, response time equals waiting time because each process runs once without interruption.

### Observations

- **SRTF gives the lowest average waiting time** (6.5 ms), as theory predicts for the preemptive shortest-job policy.
- **Round Robin has the worst average waiting and turnaround time** here, but it starts every process within 9 ms of arrival and no process can be starved, which is why it suits interactive systems.
- **FCFS** suffers because the long P1 and P3 block shorter jobs (a small-scale convoy effect).
- For every schedule, average TAT and average WT differ by exactly the average burst length, 26 / 4 = 6.5 ms (for example, 15.25 − 8.75 = 6.5 and 18.25 − 11.75 = 6.5), because TAT − WT = BT for each process. Use this identity to check arithmetic.

## 6. Common Errors in Exams

- Computing turnaround as CT instead of CT − AT when arrival times are non-zero.
- In non-preemptive SJF, choosing P2 at t = 0 even though it has not yet arrived.
- In RR, forgetting to place newly arrived processes in the queue before the preempted one, or charging a full quantum to a process that needs less (P4 runs only 1 ms at t = 24).
- Treating the waiting time of a preempted process as only its initial wait: count every interval it spends in the ready queue.
