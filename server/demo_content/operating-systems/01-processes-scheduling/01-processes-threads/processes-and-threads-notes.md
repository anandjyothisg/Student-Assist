# Processes and Threads — Lecture Notes

CS-304 Operating Systems · Unit 1 · Processes and CPU Scheduling

## 1. What Is a Process?

A **program** is a passive file of instructions on disk. A **process** is a program in execution: an active entity with a program counter, registers and allocated resources. Two users running the same editor create two processes that share the same program code.

The memory image of a process has four main sections:

- **Text**: executable code.
- **Data**: initialised and uninitialised global variables.
- **Heap**: memory allocated dynamically at run time (`malloc`, `new`); grows upward.
- **Stack**: function parameters, return addresses and local variables; grows downward.

## 2. Process States

```
            admitted                 interrupt / time slice expires
   [New] -----------> [Ready] <------------------------------+
                         |                                   |
                         | scheduler dispatch                |
                         v                                   |
   [Waiting] <------- [Running] ------------------------------+
       |   I/O or event wait  |
       |                      | exit
       | I/O or event          v
       | completion       [Terminated]
       +-----------> [Ready]
```

- **New**: being created.
- **Ready**: in memory, waiting for the CPU.
- **Running**: instructions are executing. On a single core, at most one process is running at a time.
- **Waiting (Blocked)**: waiting for an event such as I/O completion or a signal.
- **Terminated**: finished; its resources are being reclaimed.

A waiting process can never go directly to running: when its event occurs it moves to ready and must be dispatched again.

## 3. Process Control Block (PCB)

The kernel represents each process with a **PCB** (in Linux, `struct task_struct`). It contains:

| Category | Contents |
|---|---|
| Identification | Process ID (PID), parent PID, user and group IDs |
| Process state | New, ready, running, waiting, terminated |
| CPU context | Program counter, general-purpose registers, stack pointer, status flags |
| Scheduling information | Priority, pointers to scheduling queues, CPU time used |
| Memory management | Base and limit registers, page table pointer or segment table |
| Accounting | CPU time consumed, time limits, start time |
| I/O status | List of open files, allocated devices, pending I/O requests |

## 4. Context Switching

A **context switch** occurs when the CPU moves from one process to another. The kernel saves the current process's CPU context into its PCB and loads the saved context of the next process.

- Context switch time is **pure overhead**: no useful user work is done. It typically costs a few microseconds, plus indirect costs from cache and TLB misses afterwards.
- Triggers include timer interrupts (pre-emption), system calls that block, and I/O interrupts.
- Hardware support such as multiple register sets reduces the cost.

A **mode switch** (user mode to kernel mode for a system call) is not a context switch unless a different process is scheduled as a result.

## 5. Process Creation in UNIX: fork and exec

`fork()` creates a child process that is a near-copy of the parent. It returns **0 in the child**, the **child's PID in the parent**, and **-1 on failure**. Modern systems use **copy-on-write** so pages are copied only when one side writes. `exec()` (for example `execlp`) replaces the calling process's memory image with a new program; on success it never returns. `wait()` makes the parent block until a child terminates.

```c
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

int main(void) {
    pid_t pid = fork();
    if (pid < 0) {
        perror("fork failed");
        return 1;
    } else if (pid == 0) {                 /* child */
        execlp("/bin/ls", "ls", "-l", NULL);
        perror("exec failed");            /* reached only if exec fails */
    } else {                               /* parent */
        wait(NULL);
        printf("Child %d complete\n", pid);
    }
    return 0;
}
```

### Counting processes

Each call to `fork()` doubles the number of processes executing the following code. Three consecutive calls `fork(); fork(); fork();` produce **2^3 = 8** processes in total, that is **7 new child processes**. In general n calls produce 2^n processes.

### Zombies and orphans

- A **zombie** has terminated but its parent has not yet called `wait()`, so its PCB entry (exit status) remains.
- An **orphan** is a child whose parent has terminated; in Linux it is adopted by `init`/`systemd` (PID 1), which reaps it.

## 6. Threads

A **thread** is the basic unit of CPU utilisation within a process. Threads of the same process **share** the code section, data section, heap, open files and signals. Each thread has its own **thread ID, program counter, register set and stack**.

Benefits: responsiveness (a GUI remains interactive while a worker thread computes), resource sharing, economy (creating a thread is much cheaper than creating a process, and switching between threads of one process avoids changing the address space), and scalability on multicore processors.

### User-level versus kernel-level threads

| Aspect | User-level threads | Kernel-level threads |
|---|---|---|
| Managed by | Thread library in user space | Operating system kernel |
| Kernel awareness | Kernel sees only the process | Kernel schedules each thread |
| Switching cost | Very low (no system call) | Higher (kernel involvement) |
| Blocking system call | Blocks the entire process | Blocks only the calling thread |
| Multicore parallelism | Not possible on its own | Threads run in parallel on different cores |

### Multithreading models

- **Many-to-one**: many user threads map to one kernel thread. Efficient, but one blocking call blocks all threads and there is no parallelism. Example: early Solaris Green Threads.
- **One-to-one**: each user thread maps to its own kernel thread. Provides concurrency and parallelism; the cost is one kernel thread per user thread. Used by **Linux and Windows** (including pthreads on Linux).
- **Many-to-many**: many user threads are multiplexed over a smaller or equal number of kernel threads. Flexible but complex to implement. The **two-level model** is a variant that also allows binding a user thread to a kernel thread.

## 7. Interprocess Communication (IPC)

Cooperating processes exchange data through two fundamental models.

### Shared memory

Processes map a common region of memory (POSIX `shm_open` + `mmap`, or System V `shmget`/`shmat`). After setup, communication runs at memory speed with no kernel involvement, but the processes must **synchronise access themselves** (for example, with semaphores).

### Message passing

The kernel delivers messages via `send(message)` and `receive(message)`. Design choices:

- **Direct** communication names the peer process; **indirect** communication uses mailboxes or ports.
- **Blocking (synchronous)** versus **non-blocking (asynchronous)** send and receive. When both send and receive are blocking, the exchange is a **rendezvous**.
- Buffering: zero capacity, bounded capacity or unbounded capacity.

Message passing is easier to use correctly and works across machines, but each message requires system calls.

### Pipes

An ordinary pipe is a **unidirectional** byte stream between related processes (typically parent and child).

```c
int fd[2];
pipe(fd);        /* fd[0] is the read end, fd[1] is the write end */
```

After `fork()`, the writer closes `fd[0]` and the reader closes `fd[1]`. Reading from an empty pipe blocks; once all write ends are closed, `read` returns 0 (end of file). **Named pipes (FIFOs)**, created with `mkfifo`, persist in the file system and can connect unrelated processes.

## 8. Review Questions

1. Which PCB fields must be saved during a context switch, and which need not change?
2. How many times does `printf("hi\n")` execute after `fork(); fork();`? (Answer: 4.)
3. Why does a blocking `read` in one user-level thread stall every thread under the many-to-one model?
