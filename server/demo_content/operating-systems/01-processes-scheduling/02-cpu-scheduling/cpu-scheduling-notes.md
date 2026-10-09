# CPU Scheduling Algorithms — Lecture Notes

CS-304 Operating Systems · Unit 1 · Processes and CPU Scheduling

## 1. Background

Process execution alternates between **CPU bursts** and **I/O bursts**. Most CPU bursts are short, which is why favouring short jobs improves responsiveness. The **short-term scheduler** (CPU scheduler) picks a process from the ready queue; the **dispatcher** gives it the CPU by switching context, switching to user mode and jumping to the right instruction. The time the dispatcher takes is **dispatch latency**.

Scheduling decisions happen when a process:

1. switches from running to waiting (I/O request),
2. switches from running to ready (timer interrupt),
3. switches from waiting to ready (I/O completion),
4. terminates.

If scheduling happens only in cases 1 and 4, the scheme is **non-preemptive** (cooperative). Otherwise it is **preemptive**.

## 2. Scheduling Criteria

| Criterion | Definition | Goal |
|---|---|---|
| CPU utilisation | Percentage of time the CPU is busy | Maximise |
| Throughput | Processes completed per unit time | Maximise |
| Turnaround time (TAT) | Completion time − arrival time | Minimise |
| Waiting time (WT) | Time spent in the ready queue = TAT − burst time (when there is no I/O) | Minimise |
| Response time | First time on the CPU − arrival time | Minimise (interactive systems) |

## 3. First-Come, First-Served (FCFS)

- Non-preemptive; processes run in arrival order using a FIFO queue.
- Simple, but average waiting time depends heavily on order.
- Example: bursts P1 = 24, P2 = 3, P3 = 3 arriving at time 0 in that order give waiting times 0, 24, 27 (average **17 ms**). In the order P2, P3, P1 the waits are 0, 3, 6 (average **3 ms**).
- **Convoy effect**: short (often I/O-bound) processes queue behind one long CPU-bound process, leaving devices idle and lowering utilisation.

## 4. Shortest-Job-First (SJF) and SRTF

- **SJF** runs the process with the smallest next CPU burst. It is **provably optimal** for minimum average waiting time for a given set of processes that are all available.
- Its preemptive version is **Shortest-Remaining-Time-First (SRTF)**: when a new process arrives with a burst shorter than the remaining time of the running process, the running process is preempted.
- Practical difficulty: the length of the next burst is unknown. It is predicted with **exponential averaging**:

```
tau(n+1) = alpha * t(n) + (1 - alpha) * tau(n),     0 <= alpha <= 1
```

where t(n) is the actual length of the n-th burst and tau(n) the previous prediction. With alpha = 0.5, tau(0) = 10 and an actual burst of 6, the next prediction is 0.5 × 6 + 0.5 × 10 = **8**.

- Long jobs can **starve** if short jobs keep arriving.

## 5. Priority Scheduling

Each process has an integer priority; the CPU goes to the highest priority (in many textbooks and in UNIX, a **smaller number means higher priority**). It can be preemptive or non-preemptive. SJF is a special case where priority is the predicted burst length.

### Example (non-preemptive, all arrive at time 0)

| Process | Burst | Priority |
|---|---|---|
| P1 | 10 | 3 |
| P2 | 1 | 1 |
| P3 | 2 | 4 |
| P4 | 1 | 5 |
| P5 | 5 | 2 |

Gantt chart: `| P2 0-1 | P5 1-6 | P1 6-16 | P3 16-18 | P4 18-19 |`

Waiting times: P1 = 6, P2 = 0, P3 = 16, P4 = 18, P5 = 1. Average = 41 / 5 = **8.2 ms**.

### Starvation and aging

**Starvation (indefinite blocking)**: a low-priority process may wait forever while higher-priority processes keep arriving. **Aging** solves this by gradually increasing the priority of waiting processes, for example raising priority by 1 every 15 minutes, so every process eventually runs.

## 6. Round Robin (RR)

- Designed for time-sharing. Each process receives a **time quantum** q (typically 10–100 ms), after which it is preempted and placed at the tail of the ready queue.
- With n processes in the ready queue, no process waits more than **(n − 1) × q** time units before its next quantum.
- Choice of q:
  - Very large q: RR degenerates into **FCFS**.
  - Very small q: context-switch overhead dominates. If a switch costs 1 ms and q = 4 ms, about 1 / (4 + 1) = 20% of CPU time is overhead.
  - Rule of thumb: about **80% of CPU bursts** should be shorter than q.
- RR usually has higher average turnaround than SJF but much better **response time**.

## 7. Multilevel Queue and Multilevel Feedback Queue

A **multilevel queue** partitions the ready queue into separate queues (for example, foreground interactive using RR and background batch using FCFS), each with its own algorithm. Processes are permanently assigned to one queue; scheduling between queues uses fixed priority or time slicing (such as 80% foreground, 20% background).

A **multilevel feedback queue (MLFQ)** lets processes **move between queues** based on their behaviour. A typical three-level configuration:

| Queue | Policy | Rule |
|---|---|---|
| Q0 (highest) | RR, q = 8 ms | A new process enters here; if it does not finish within 8 ms it moves to Q1 |
| Q1 | RR, q = 16 ms | Runs only when Q0 is empty; unfinished jobs move to Q2 |
| Q2 (lowest) | FCFS | Runs only when Q0 and Q1 are empty |

Short and I/O-bound processes stay at high priority; CPU-bound processes sink. Aging (promoting processes that wait too long in lower queues) prevents starvation. An MLFQ is defined by the number of queues, each queue's algorithm, and the rules for promotion, demotion and initial placement. It is the most general scheme and also the most complex to tune.

## 8. Comparison Summary

| Algorithm | Preemptive? | Strength | Weakness |
|---|---|---|---|
| FCFS | No | Simple, fair by arrival | Convoy effect, poor average wait |
| SJF | No | Optimal average wait | Needs burst prediction; starvation |
| SRTF | Yes | Optimal among preemptive policies for average wait | More context switches; starvation |
| Priority | Either | Expresses importance | Starvation without aging |
| Round Robin | Yes | Good response time, no starvation | Overhead depends on q; higher TAT |
| MLFQ | Yes | Adapts to process behaviour | Many parameters to tune |

See the companion worked example for complete Gantt charts of FCFS, SJF, SRTF and RR on the same process set.
