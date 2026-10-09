# Stacks and Queues

CS-201 Data Structures and Algorithms · Unit 1 · Lecture Notes

## 1. Abstract Data Types

A stack and a queue are **abstract data types (ADTs)**: they are defined by the operations they support and the order in which elements leave, not by how they are stored. Both can be implemented with an array or a linked list, and in both cases every core operation runs in O(1) time.

| Property | Stack | Queue |
|---|---|---|
| Removal order | Last In, First Out (LIFO) | First In, First Out (FIFO) |
| Insert operation | `push(x)` at the top | `enqueue(x)` at the rear |
| Remove operation | `pop()` from the top | `dequeue()` from the front |
| Inspect | `peek()` / `top()` | `front()` |
| Typical uses | Function calls, undo, expression evaluation, DFS | Scheduling, buffering, BFS |

## 2. Stacks

### 2.1 Array implementation

Keep an array and an integer `top` holding the index of the top element (or `-1` when empty). `push` increments `top` and writes; `pop` reads and decrements. With a dynamic array, push is amortized O(1).

```python
class Stack:
    def __init__(self):
        self._items = []
    def push(self, x):
        self._items.append(x)       # amortized O(1)
    def pop(self):
        if not self._items:
            raise IndexError("pop from empty stack")   # underflow
        return self._items.pop()    # O(1)
    def peek(self):
        return self._items[-1]
    def is_empty(self):
        return len(self._items) == 0
```

### 2.2 Linked-list implementation

Push and pop both operate at the **head** of a singly linked list, which gives worst-case O(1) for each (no resizing). The cost is one pointer per element and poorer cache locality.

### 2.3 Stack errors

- **Underflow:** popping from an empty stack.
- **Overflow:** pushing onto a full fixed-capacity array stack.

## 3. Queues

### 3.1 Why a naive array queue fails

If `dequeue` removes `a[0]` and shifts the rest left, dequeue is O(n). If instead a `front` index is advanced, the array's front portion becomes unusable and the queue "runs off" the end even though slots are free.

### 3.2 Circular queue (ring buffer)

A circular queue of capacity `N` keeps `front` and `size` (or `front` and `rear`) and wraps indices with modulo arithmetic:

- `enqueue(x)`: `a[(front + size) % N] = x; size += 1`
- `dequeue()`: `x = a[front]; front = (front + 1) % N; size -= 1`

Both are O(1). If the implementation tracks only `front` and `rear` without a size counter, the conditions "full" and "empty" both look like `front == rear`. The standard fix is to leave one slot unused, so the queue is **full when `(rear + 1) % N == front`** and **empty when `front == rear`**; such a queue holds at most `N - 1` elements.

### 3.3 Linked-list queue

Maintain both `head` and `tail`. Enqueue at the tail and dequeue from the head; both are O(1). Enqueueing at the head and dequeueing at the tail would make dequeue O(n) in a singly linked list, because the new tail's predecessor must be found.

### 3.4 Deque

A **double-ended queue** supports insertion and removal at both ends in O(1). It can be implemented with a circular array or a doubly linked list. Python provides `collections.deque`, which should be used instead of `list.pop(0)` (which is O(n)). A deque can simulate both a stack and a queue.

### 3.5 Priority queue (introduction)

A **priority queue** removes the element with the highest (or lowest) priority rather than the oldest. Implementation choices:

| Implementation | insert | extract-min |
|---|---|---|
| Unsorted array | O(1) | O(n) |
| Sorted array | O(n) | O(1) |
| Binary heap | O(log n) | O(log n) |

The binary heap is the standard choice and is covered in Unit 2.

## 4. Application: Balanced Parentheses

Scan the string left to right. Push every opening bracket; on a closing bracket, pop and check that it matches. The string is balanced if and only if no mismatch occurs and the stack is empty at the end. Time O(n), space O(n).

```python
def balanced(s):
    pairs = {')': '(', ']': '[', '}': '{'}
    stack = []
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack
```

`"{[()]}"` is balanced; `"([)]"` is not, because `)` meets `[` on top of the stack; `"(("` fails the final empty-stack check.

## 5. Application: Infix to Postfix (Shunting-Yard)

In **postfix** (Reverse Polish) notation, operators follow their operands and no parentheses are needed. The conversion uses an operator stack:

1. Operand: append to output.
2. `(`: push.
3. `)`: pop to output until `(` is found; discard both parentheses.
4. Operator `op`: while the top of the stack is an operator with higher precedence, or equal precedence and `op` is left-associative, pop it to output. Then push `op`.
5. At the end, pop all remaining operators to output.

Precedence: `^` (right-associative) > `*` `/` > `+` `-`.

### Worked example: `A + B * (C - D) / E`

| Token | Action | Stack (bottom→top) | Output |
|---|---|---|---|
| A | output | | A |
| + | push | + | A |
| B | output | + | A B |
| * | `*` > `+`, push | + * | A B |
| ( | push | + * ( | A B |
| C | output | + * ( | A B C |
| - | top is `(`, push | + * ( - | A B C |
| D | output | + * ( - | A B C D |
| ) | pop until `(` | + * | A B C D - |
| / | pop `*` (equal, left-assoc), push `/` | + / | A B C D - * |
| E | output | + / | A B C D - * E |
| end | pop all | | A B C D - * E / + |

Result: **`A B C D - * E / +`**.

To **evaluate** a postfix expression, scan left to right, push operands, and on each operator pop two values (the first popped is the right operand). Both conversion and evaluation run in O(n).

## 6. Application: Breadth-First Search

BFS explores a graph level by level using a FIFO queue: dequeue a vertex, visit each unvisited neighbour, mark it, and enqueue it. Because the queue releases vertices in the order they were discovered, BFS finds shortest paths (in number of edges) in unweighted graphs. Replacing the queue with a stack produces an iterative depth-first search. Graph traversal is treated in full in Unit 3.

## 7. Pitfalls

- Calling `pop()` without checking for an empty stack.
- Using `list.pop(0)` in Python for a queue: each call is O(n).
- In a circular queue, forgetting the modulo when advancing `rear`.
- In postfix evaluation, reversing the operand order for `-` and `/`: for tokens `8 2 -`, pop `2` then `8` and compute `8 - 2 = 6`.
