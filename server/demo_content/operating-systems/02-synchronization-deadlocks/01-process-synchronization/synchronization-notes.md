# Process Synchronization — Lecture Notes

CS-304 Operating Systems · Unit 2 · Synchronization and Deadlocks

## 1. Race Conditions

A **race condition** occurs when several processes or threads access and manipulate shared data concurrently and the final result depends on the particular order in which the accesses take place.

Classic example: two threads share `counter = 5`. One executes `counter++` and the other `counter--`. Each high-level statement compiles to three machine steps:

```
register1 = counter        register2 = counter
register1 = register1 + 1  register2 = register2 - 1
counter = register1        counter = register2
```

One possible interleaving:

```
T0: producer  register1 = counter        (register1 = 5)
T1: producer  register1 = register1 + 1  (register1 = 6)
T2: consumer  register2 = counter        (register2 = 5)
T3: consumer  register2 = register2 - 1  (register2 = 4)
T4: producer  counter = register1        (counter = 6)
T5: consumer  counter = register2        (counter = 4)
```

The correct result is 5, but the program can end with **4 or 6** depending on scheduling. Race conditions are hard to debug because they appear only under particular timings.

## 2. The Critical-Section Problem

The **critical section** (CS) is the segment of code in which a process accesses shared data. Each process follows the structure:

```
do {
    entry section
        critical section
    exit section
        remainder section
} while (true);
```

A correct solution must satisfy three requirements:

1. **Mutual exclusion**: if a process is executing in its critical section, no other process may execute in its critical section.
2. **Progress**: if no process is in its critical section and some processes wish to enter, only processes not in their remainder sections take part in deciding who enters next, and the decision cannot be postponed indefinitely.
3. **Bounded waiting**: there is a bound on the number of times other processes may enter their critical sections after a process has requested entry and before that request is granted. This prevents starvation.

No assumption may be made about the relative speed of the processes or the number of CPUs.

## 3. Peterson's Solution

Peterson's algorithm (1981) is a software solution for **two processes**, P0 and P1. They share:

```c
int turn;            /* whose turn it is to enter */
bool flag[2];        /* flag[i] = true means Pi wants to enter */
```

Code for process Pi (with j = 1 − i):

```c
do {
    flag[i] = true;
    turn = j;                     /* politely give the other process priority */
    while (flag[j] && turn == j)
        ;                         /* busy wait */
    /* critical section */
    flag[i] = false;
    /* remainder section */
} while (true);
```

- **Mutual exclusion**: both processes could be in the loop only if `turn` were both 0 and 1 at once, which is impossible.
- **Progress** and **bounded waiting** (bound = 1): after Pj exits, it resets `flag[j]`, and if it tries to re-enter it sets `turn = i`, letting Pi in.
- Limitation: on modern processors, compilers and hardware may **reorder** loads and stores, so Peterson's solution is not guaranteed to work without memory barriers.

## 4. Hardware Support

- **Memory barriers (fences)** force all preceding memory operations to complete before later ones.
- **test_and_set(&lock)** atomically returns the old value of `lock` and sets it to true.

```c
while (test_and_set(&lock))
    ;            /* spin */
/* critical section */
lock = false;
```

- **compare_and_swap(&value, expected, new_value)** atomically sets `value` to `new_value` only if it equals `expected`, and returns the original value. It is the basis of lock-free data structures and atomic integers.

These simple spin-lock loops guarantee mutual exclusion but **not bounded waiting**; an extra array of waiting flags is needed for that.

## 5. Mutex Locks

A **mutex** (mutual exclusion lock) is the simplest OS-provided tool. `acquire()` blocks or spins until the lock is free and then takes it; `release()` frees it. Both must be atomic.

- A mutex that busy-waits is a **spinlock**. Spinning wastes CPU cycles but avoids a context switch, so it is preferred on multicore systems when locks are held for a very short time (shorter than two context switches).
- Only the thread that acquired a mutex should release it (an **ownership** concept that semaphores lack).

## 6. Semaphores

Dijkstra's **semaphore** S is an integer accessed only through two atomic operations:

```
wait(S)   (also P, down):  S = S - 1;  if S < 0, block the calling process on S's queue
signal(S) (also V, up):    S = S + 1;  if S <= 0, wake one process from S's queue
```

In this blocking implementation, a negative value −n means n processes are waiting.

| Type | Value range | Typical use |
|---|---|---|
| Binary semaphore | 0 or 1 | Mutual exclusion, similar to a mutex |
| Counting semaphore | Any integer, initialised to the number of resources | Controlling access to a pool of N identical resources |

Semaphores can also impose **ordering**. To ensure that statement S1 in P1 runs before S2 in P2, initialise `synch = 0`:

```
P1: S1; signal(synch);
P2: wait(synch); S2;
```

### Misuse

- `signal(mutex) ... wait(mutex)` (reversed): violates mutual exclusion.
- `wait(mutex) ... wait(mutex)`: the process blocks forever on itself.
- Two processes acquiring semaphores S and Q in opposite order (`wait(S); wait(Q);` versus `wait(Q); wait(S);`) can **deadlock**.
- **Priority inversion**: a high-priority process waits for a lock held by a low-priority process that is preempted by a medium-priority process. The **priority-inheritance protocol** temporarily raises the lock holder to the waiter's priority (this fixed the 1997 Mars Pathfinder resets).

## 7. Monitors

A **monitor** is a high-level language construct (an abstract data type) in which **only one process can be active inside at a time**; mutual exclusion is automatic. Java's `synchronized` methods and C#'s `lock` follow this idea.

For waiting on conditions, monitors provide **condition variables**:

- `x.wait()`: the calling process is suspended and releases the monitor.
- `x.signal()`: resumes exactly one suspended process, if any. Unlike a semaphore's `signal`, it has **no effect if no process is waiting**: condition variables have no memory.

When P signals and Q resumes, both cannot be active in the monitor at once. Two policies resolve this:

| Policy | Behaviour | Used in |
|---|---|---|
| Signal-and-wait (Hoare) | P waits until Q leaves the monitor or waits on another condition | Classical theory |
| Signal-and-continue (Mesa) | Q waits until P leaves; Q must recheck its condition in a `while` loop | Java, pthreads |

Monitors can be implemented with semaphores: one `mutex` semaphore (initial value 1) for entry, plus one semaphore and a counter per condition variable.

## 8. Liveness Problems

- **Deadlock**: two or more processes wait indefinitely for an event that only one of the waiting processes can cause.
- **Starvation**: a process waits indefinitely, for example in a LIFO semaphore queue.
- **Livelock**: processes keep changing state in response to each other without making progress.

The classic synchronization problems (bounded buffer, readers-writers, dining philosophers) are treated in the companion study guide.
