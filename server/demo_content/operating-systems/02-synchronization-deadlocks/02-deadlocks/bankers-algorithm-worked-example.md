# Banker's Algorithm — Fully Worked Example

CS-304 Operating Systems · Unit 2 · Tutorial Solutions

Dijkstra's Banker's algorithm avoids deadlock in systems with **multiple instances** of each resource type. Its name comes from a banker who never lends cash in a way that could leave the bank unable to satisfy all customers' maximum credit lines.

## 1. Data Structures

For n processes and m resource types:

| Structure | Size | Meaning |
|---|---|---|
| Available | vector of length m | Available[j] = number of free instances of Rj |
| Max | n × m matrix | Max[i][j] = maximum demand of Pi for Rj |
| Allocation | n × m matrix | Allocation[i][j] = instances of Rj currently held by Pi |
| Need | n × m matrix | Need[i][j] = Max[i][j] − Allocation[i][j] |

Vector comparison: X <= Y means X[j] <= Y[j] for **every** j.

## 2. Safety Algorithm

```
Work = Available
Finish[i] = false for all i
repeat:
    find i with Finish[i] == false and Need[i] <= Work
    if found:
        Work = Work + Allocation[i]     # Pi runs to completion and releases everything
        Finish[i] = true
        append Pi to the safe sequence
until no such i exists
state is safe  iff  Finish[i] == true for all i
```

## 3. Resource-Request Algorithm (for a request vector Request_i from Pi)

1. If Request_i > Need_i, raise an error: the process has exceeded its declared maximum.
2. If Request_i > Available, Pi must **wait**: the resources are not free.
3. **Pretend** to allocate:

```
Available    = Available - Request_i
Allocation_i = Allocation_i + Request_i
Need_i       = Need_i - Request_i
```

4. Run the safety algorithm. If the new state is safe, grant the request. If unsafe, restore the old state and make Pi wait.

## 4. Problem Data

Five processes P0–P4 and three resource types: A has 10 instances, B has 5 and C has 7. At time T0:

| Process | Allocation (A B C) | Max (A B C) |
|---|---|---|
| P0 | 0 1 0 | 7 5 3 |
| P1 | 2 0 0 | 3 2 2 |
| P2 | 3 0 2 | 9 0 2 |
| P3 | 2 1 1 | 2 2 2 |
| P4 | 0 0 2 | 4 3 3 |

### Step 1: Available

Total allocated = (0+2+3+2+0, 1+0+0+1+0, 0+0+2+1+2) = (7, 2, 5).

Available = (10, 5, 7) − (7, 2, 5) = **(3, 3, 2)**.

### Step 2: Need = Max − Allocation

| Process | Need (A B C) |
|---|---|
| P0 | 7 4 3 |
| P1 | 1 2 2 |
| P2 | 6 0 0 |
| P3 | 0 1 1 |
| P4 | 4 3 1 |

## 5. Is the State at T0 Safe?

Scan the processes in order P0 to P4 repeatedly, choosing the first one whose Need fits in Work.

| Step | Work before | Candidate checks | Chosen | Work after (Work + Allocation) |
|---|---|---|---|---|
| 1 | (3, 3, 2) | P0: (7,4,3) no; P1: (1,2,2) yes | P1 | (3,3,2) + (2,0,0) = (5, 3, 2) |
| 2 | (5, 3, 2) | P0 no (A: 7 > 5); P2 no (A: 6 > 5); P3: (0,1,1) yes | P3 | (5,3,2) + (2,1,1) = (7, 4, 3) |
| 3 | (7, 4, 3) | P0: (7,4,3) yes | P0 | (7,4,3) + (0,1,0) = (7, 5, 3) |
| 4 | (7, 5, 3) | P2: (6,0,0) yes | P2 | (7,5,3) + (3,0,2) = (10, 5, 5) |
| 5 | (10, 5, 5) | P4: (4,3,1) yes | P4 | (10,5,5) + (0,0,2) = (10, 5, 7) |

All processes finish, so the state is **safe**, with safe sequence **<P1, P3, P0, P2, P4>**.

A safe sequence is not unique. If after step 2 we continue the scan from P4 instead of restarting at P0, we obtain <P1, P3, P4, P0, P2>; the textbook sequence <P1, P3, P4, P2, P0> is also valid. Any of them proves safety. Note that the final Work always equals the total resource vector (10, 5, 7), a useful arithmetic check.

## 6. Request 1: P1 requests (1, 0, 2)

1. Request <= Need_1? (1,0,2) <= (1,2,2): **yes**.
2. Request <= Available? (1,0,2) <= (3,3,2): **yes**.
3. Pretend to allocate:
   - Available = (3,3,2) − (1,0,2) = **(2, 3, 0)**
   - Allocation_1 = (2,0,0) + (1,0,2) = **(3, 0, 2)**
   - Need_1 = (1,2,2) − (1,0,2) = **(0, 2, 0)**
4. Safety check from Work = (2, 3, 0):

| Step | Work before | Chosen (Need) | Work after |
|---|---|---|---|
| 1 | (2, 3, 0) | P1 (0,2,0) | (2,3,0) + (3,0,2) = (5, 3, 2) |
| 2 | (5, 3, 2) | P3 (0,1,1) | (7, 4, 3) |
| 3 | (7, 4, 3) | P0 (7,4,3) | (7, 5, 3) |
| 4 | (7, 5, 3) | P2 (6,0,0) | (10, 5, 5) |
| 5 | (10, 5, 5) | P4 (4,3,1) | (10, 5, 7) |

The new state is safe (<P1, P3, P0, P2, P4>), so the request is **granted immediately**.

## 7. Request 2 (after granting Request 1): P4 requests (3, 3, 0)

Request <= Need_4: (3,3,0) <= (4,3,1), yes. Request <= Available: (3,3,0) <= (2,3,0)? **No**, since only 2 instances of A are free. P4 must **wait**. The safety algorithm is not even run.

## 8. Request 3 (after granting Request 1): P0 requests (0, 2, 0)

1. Request <= Need_0: (0,2,0) <= (7,4,3), yes.
2. Request <= Available: (0,2,0) <= (2,3,0), yes.
3. Pretend: Available = **(2, 1, 0)**, Allocation_0 = (0, 3, 0), Need_0 = (7, 2, 3).
4. Safety check from Work = (2, 1, 0):

| Process | Need | Fits in (2, 1, 0)? |
|---|---|---|
| P0 | (7, 2, 3) | No |
| P1 | (0, 2, 0) | No (B: 2 > 1) |
| P2 | (6, 0, 0) | No |
| P3 | (0, 1, 1) | No (C: 1 > 0) |
| P4 | (4, 3, 1) | No |

No process can finish, so the resulting state is **unsafe**. The request is **denied**: the old state is restored and P0 waits, even though the resources are physically available. This is the price of avoidance: it can refuse requests that might never have led to deadlock.

## 9. Exam Checklist

- Compute **Available** first if it is not given: total minus column sums of Allocation.
- Always check Request <= Need before Request <= Available; the first failure is an error, the second means waiting.
- When a process finishes in the safety algorithm, add its **Allocation**, not its Need or Max.
- State one safe sequence and show the Work vector at each step; examiners award marks for the trace.
- Complexity of the safety algorithm: O(m × n^2).
