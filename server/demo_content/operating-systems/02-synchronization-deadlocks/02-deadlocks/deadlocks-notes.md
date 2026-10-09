# Deadlocks — Lecture Notes

CS-304 Operating Systems · Unit 2 · Synchronization and Deadlocks

## 1. System Model

A system has resource types R1, R2, ..., Rm (CPU cycles, memory, files, locks, printers), and each type Ri has Wi identical **instances**. A process uses a resource in three steps: **request** (wait if unavailable), **use**, and **release**.

A set of processes is **deadlocked** when every process in the set is waiting for an event that can be caused only by another process in the set. Deadlock differs from starvation: a starving process could proceed if the scheduler favoured it, whereas deadlocked processes can never proceed without outside intervention.

## 2. The Four Necessary Conditions (Coffman, 1971)

Deadlock can arise only if **all four** conditions hold simultaneously:

1. **Mutual exclusion**: at least one resource is non-sharable; only one process can use it at a time.
2. **Hold and wait**: a process holds at least one resource while waiting to acquire others.
3. **No preemption**: a resource can be released only voluntarily by the process holding it.
4. **Circular wait**: there is a set {P0, P1, ..., Pn} where P0 waits for a resource held by P1, P1 waits for P2, ..., and Pn waits for P0.

Circular wait implies hold and wait, so the conditions are not fully independent, but each is a separate target for prevention.

## 3. Resource-Allocation Graph (RAG)

A RAG has two kinds of vertices: processes (circles) and resource types (rectangles, with one dot per instance).

- **Request edge** Pi → Rj: Pi has requested an instance of Rj.
- **Assignment edge** Rj → Pi: an instance of Rj is allocated to Pi.

Rules for interpreting the graph:

- **No cycle** → no deadlock.
- **Cycle, and every resource in it has a single instance** → deadlock (the cycle is necessary and sufficient).
- **Cycle, with multiple-instance resources** → deadlock is possible but not certain.

Example of a cycle without deadlock: R1 and R2 each have 2 instances. P1 holds R2 and requests R1; P3 holds R1 and requests R2; the second instance of R1 is held by P2 and the second instance of R2 by P4. The cycle P1 → R1 → P3 → R2 → P1 exists, but P4 needs nothing more, so it finishes and releases its R2 instance, which P3 can take. No deadlock.

## 4. Strategies for Handling Deadlock

| Strategy | Idea | Cost / drawback |
|---|---|---|
| Prevention | Design the system so that at least one Coffman condition can never hold | Low utilisation, possible starvation |
| Avoidance | Use advance knowledge of maximum needs; grant a request only if the resulting state is safe | Needs maximum claims in advance; run-time overhead |
| Detection and recovery | Allow deadlocks, detect them periodically, then recover | Detection overhead; recovery loses work |
| Ignore (ostrich algorithm) | Assume deadlocks are rare; reboot or kill when needed | Used by most general-purpose OSes, including Linux and Windows, for application resources |

## 5. Deadlock Prevention

Each approach attacks one condition:

- **Mutual exclusion**: make resources sharable where possible (read-only files). Not possible for inherently non-sharable resources such as mutex locks.
- **Hold and wait**: require a process to request all its resources at once before starting, or to release everything it holds before requesting more. Leads to low utilisation and possible starvation.
- **No preemption**: if a process holding resources requests one that cannot be granted immediately, it releases all held resources and restarts later. Workable for resources whose state is easy to save (CPU registers, memory), not for printers or locks.
- **Circular wait**: impose a **total ordering** on resource types and require each process to request resources in increasing order. If F(tape) = 1, F(disk) = 5, F(printer) = 12, a process holding the disk may request the printer but not the tape. This is the most practical prevention technique; Linux's `lockdep` tool checks lock-ordering violations.

## 6. Deadlock Avoidance

Each process declares its **maximum** need for each resource type. A state is **safe** if there exists a **safe sequence** <P1, P2, ..., Pn> such that each Pi's remaining needs can be satisfied by the currently available resources plus those held by all Pj with j < i.

- Safe state → no deadlock.
- Unsafe state → deadlock is **possible** but not certain.
- Deadlocked states are a subset of unsafe states.

Example with 12 tape drives:

| Process | Maximum need | Currently holds | Remaining need |
|---|---|---|---|
| P0 | 10 | 5 | 5 |
| P1 | 4 | 2 | 2 |
| P2 | 9 | 2 | 7 |

Available = 12 − 9 = 3. The sequence <P1, P0, P2> is safe: P1 needs 2 (available becomes 3 + 2 = 5 after it finishes), then P0 needs 5 (available becomes 10), then P2 needs 7. If P2 were granted one more drive now, available would fall to 2; only P1 could finish (available 4), after which neither P0 (needs 5) nor P2 (needs 6) could finish, so the state would be unsafe. The request must wait.

### Algorithms

- **Single instance per resource type**: use a RAG with **claim edges** (dashed Pi → Rj). A request is granted only if converting the claim edge to an assignment edge creates no cycle. Cycle detection costs O(n^2) in the number of processes.
- **Multiple instances**: use the **Banker's algorithm** (see the worked example document). Its safety algorithm costs O(m × n^2) for m resource types and n processes.

## 7. Deadlock Detection

- **Single instance per resource type**: collapse the RAG into a **wait-for graph** (Pi → Pj if Pi waits for a resource Pj holds). Deadlock exists if and only if the wait-for graph has a cycle.
- **Multiple instances**: run an algorithm similar to Banker's safety check, but using each process's **current Request** instead of Need. Any process that cannot be marked finished is deadlocked.

How often to run detection depends on how often deadlocks occur and how many processes they affect. Running it on every blocked request identifies the culprit but is expensive; running it periodically (for example, once per hour or when CPU utilisation falls below 40%) is cheaper.

## 8. Recovery from Deadlock

- **Process termination**: abort all deadlocked processes (expensive, loses all work), or abort one at a time until the cycle disappears (needs re-running detection after each abort). Victim selection considers priority, computation done, resources held and resources still needed.
- **Resource preemption**: take resources from a victim, **roll back** the victim to a safe checkpoint (or restart it totally), and guard against **starvation** by including the number of rollbacks in the cost factor.

## 9. Common Pitfalls

- An unsafe state is not necessarily a deadlock.
- A cycle in a RAG proves deadlock only when every resource in the cycle has one instance.
- Banker's algorithm avoids deadlock; it does not detect an existing one.
- Prevention restricts how requests can be made; avoidance examines each request dynamically.
