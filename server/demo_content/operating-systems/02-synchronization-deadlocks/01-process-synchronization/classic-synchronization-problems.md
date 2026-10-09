# Classic Synchronization Problems — Study Guide

CS-304 Operating Systems · Unit 2 · Synchronization and Deadlocks

These three problems are used to test every new synchronization mechanism. For each, know the shared variables, their initial values, the code for each role, and the known weaknesses. All solutions below use semaphores with `wait()` and `signal()`.

## 1. Bounded-Buffer (Producer-Consumer) Problem

A producer places items into a buffer of **n** slots; a consumer removes them. The producer must wait when the buffer is full and the consumer when it is empty, and buffer updates must be mutually exclusive.

### Shared data

| Semaphore | Initial value | Meaning |
|---|---|---|
| mutex | 1 | Mutual exclusion on the buffer |
| empty | n | Number of empty slots |
| full | 0 | Number of filled slots |

### Producer

```
while (true) {
    item = produce_item();
    wait(empty);          // wait for a free slot
    wait(mutex);
    buffer[in] = item;
    in = (in + 1) % n;
    signal(mutex);
    signal(full);         // one more filled slot
}
```

### Consumer

```
while (true) {
    wait(full);           // wait for a filled slot
    wait(mutex);
    item = buffer[out];
    out = (out + 1) % n;
    signal(mutex);
    signal(empty);        // one more free slot
    consume_item(item);
}
```

### Key points

- `empty` and `full` are **counting semaphores**; `mutex` is a **binary semaphore**.
- The order of the two `wait` calls matters. If the producer executes `wait(mutex)` before `wait(empty)` when the buffer is full, it blocks while holding `mutex`; the consumer can never enter to free a slot, and the system **deadlocks**.
- The order of the two `signal` calls does not affect correctness.
- Invariant: `empty + full = n` whenever no process is between its `wait` and `signal`.

## 2. Readers-Writers Problem

A shared database is accessed by **readers** (which only read) and **writers** (which update). Any number of readers may read simultaneously, but a writer needs exclusive access.

### Variants

| Variant | Rule | Who may starve |
|---|---|---|
| First readers-writers problem | No reader waits unless a writer already holds access (readers preferred) | Writers |
| Second readers-writers problem | Once a writer is waiting, no new reader may start (writers preferred) | Readers |

### Solution to the first problem

| Variable | Initial value | Purpose |
|---|---|---|
| rw_mutex (semaphore) | 1 | Exclusive access for writers; also held by the first reader |
| mutex (semaphore) | 1 | Protects read_count |
| read_count (int) | 0 | Number of processes currently reading |

Writer:

```
wait(rw_mutex);
    ... perform writing ...
signal(rw_mutex);
```

Reader:

```
wait(mutex);
read_count++;
if (read_count == 1)
    wait(rw_mutex);       // first reader locks out writers
signal(mutex);
    ... perform reading ...
wait(mutex);
read_count--;
if (read_count == 0)
    signal(rw_mutex);     // last reader lets writers in
signal(mutex);
```

### Key points

- If a writer is in the critical section and n readers are waiting, **one** reader is queued on `rw_mutex` and the other n − 1 are queued on `mutex`.
- A continuous stream of readers keeps `read_count` above zero, so writers can **starve**.
- Many systems provide **reader-writer locks** (for example `pthread_rwlock_t`), which are worthwhile when reads greatly outnumber writes, since they cost more to set up than a mutex.

## 3. Dining-Philosophers Problem

Five philosophers sit at a round table with **five chopsticks**, one between each pair of neighbours. To eat, a philosopher needs both the left and the right chopstick. The problem models allocating several resources among several processes without deadlock or starvation.

### Naive solution

```
semaphore chopstick[5];   // all initialised to 1

philosopher i:
while (true) {
    wait(chopstick[i]);
    wait(chopstick[(i + 1) % 5]);
        ... eat ...
    signal(chopstick[i]);
    signal(chopstick[(i + 1) % 5]);
        ... think ...
}
```

This guarantees that neighbours never eat simultaneously, but it can **deadlock**: if all five philosophers pick up their left chopstick at the same time, every chopstick is held and each philosopher waits forever for the right one. This is a circular wait.

### Deadlock-free remedies

1. **Limit diners**: allow at most **four** philosophers at the table at once (a counting semaphore initialised to 4). At least one philosopher can then obtain both chopsticks.
2. **Atomic pickup**: a philosopher picks up chopsticks only if **both** are available, inside a critical section.
3. **Asymmetric solution**: odd-numbered philosophers pick up the left chopstick first; even-numbered philosophers pick up the right one first. This breaks the circular wait.
4. **Resource ordering**: number the chopsticks and always acquire the lower-numbered one first.

### Monitor solution

```
monitor DiningPhilosophers {
    enum {THINKING, HUNGRY, EATING} state[5];
    condition self[5];

    void pickup(int i) {
        state[i] = HUNGRY;
        test(i);
        if (state[i] != EATING) self[i].wait();
    }
    void putdown(int i) {
        state[i] = THINKING;
        test((i + 4) % 5);       // left neighbour
        test((i + 1) % 5);       // right neighbour
    }
    void test(int i) {
        if (state[(i + 4) % 5] != EATING && state[i] == HUNGRY
                && state[(i + 1) % 5] != EATING) {
            state[i] = EATING;
            self[i].signal();
        }
    }
    initialization: all state[i] = THINKING;
}
```

A philosopher eats only when neither neighbour is eating, so this solution is **deadlock-free**. However, it is **not starvation-free**: two neighbours could alternate eating so that the philosopher between them never gets both chopsticks.

## 4. Summary Table

| Problem | Semaphores (initial values) | Main hazard | Typical fix |
|---|---|---|---|
| Bounded buffer | mutex = 1, empty = n, full = 0 | Deadlock from wrong wait order | Wait on counting semaphore before mutex |
| Readers-writers (first) | rw_mutex = 1, mutex = 1, read_count = 0 | Writer starvation | Writer-preference variant or fair RW locks |
| Dining philosophers | chopstick[5] = 1 each | Deadlock (circular wait), starvation | At most 4 diners, asymmetry, atomic pickup, monitor |

## 5. Self-Test Questions

1. In the bounded buffer with n = 10, what are the values of empty and full when the buffer holds 3 items and no process is active? (Answer: empty = 7, full = 3.)
2. Why does the first reader, and not every reader, execute `wait(rw_mutex)`?
3. Which of the four Coffman conditions does the asymmetric dining-philosophers solution break? (Answer: circular wait.)
4. Explain why the monitor solution to the dining philosophers prevents deadlock but not starvation.
