# Uninformed Search Strategies

## 1. Problem Formulation

A search problem is defined by five components:

1. **Initial state** `s0`, for example `In(Arad)` in the Romania route-finding problem.
2. **Actions**: `ACTIONS(s)` returns the actions applicable in state `s`.
3. **Transition model**: `RESULT(s, a)` returns the state reached by doing `a` in `s`.
4. **Goal test**: decides whether a state is a goal (explicit set or abstract property such as checkmate).
5. **Path cost**: an additive function; the **step cost** `c(s, a, s')` is assumed non-negative.

A **solution** is an action sequence from the initial state to a goal; an **optimal solution** has the lowest path cost among all solutions. The set of states reachable from the initial state forms the **state space**, a directed graph.

### 1.1 Search trees, frontier and reached set

Search algorithms build a **search tree** whose root is the initial state. **Expanding** a node generates its children. The set of generated but unexpanded nodes is the **frontier** (open list). A **node** is a bookkeeping structure containing the state, a parent pointer, the action that produced it and the path cost `g(n)`; distinct nodes may contain the same state.

- **Tree-like search** does not remember visited states and may revisit them, including along loopy paths.
- **Graph search** keeps a **reached** (explored/closed) set and discards newly generated nodes whose states were already reached. This removes redundant paths at the cost of memory.

### 1.2 Evaluation criteria and notation

- **Completeness**: is the algorithm guaranteed to find a solution when one exists?
- **Cost optimality**: does it find a lowest-cost solution?
- **Time complexity**: number of nodes generated.
- **Space complexity**: maximum number of nodes stored in memory.

Complexities are expressed with:

- `b`: the **branching factor**, the maximum number of successors of any node.
- `d`: the **depth** of the shallowest goal node.
- `m`: the **maximum depth** of any path in the state space (may be infinite).
- `C*`: the cost of the optimal solution; `ε`: the minimum step cost (`ε > 0`).

## 2. Breadth-First Search (BFS)

BFS expands the shallowest unexpanded node first, using a **FIFO queue** for the frontier. The goal test can be applied when a node is **generated** (early goal test) because the first goal generated is at the shallowest depth.

```python
from collections import deque

def bfs(problem):
    node = Node(problem.initial)
    if problem.is_goal(node.state):
        return node
    frontier = deque([node])
    reached = {problem.initial}
    while frontier:
        node = frontier.popleft()
        for child in expand(problem, node):
            if problem.is_goal(child.state):
                return child          # early goal test
            if child.state not in reached:
                reached.add(child.state)
                frontier.append(child)
    return None
```

- Complete if `b` is finite.
- Optimal when all step costs are equal (it finds the shallowest goal).
- Nodes generated: `1 + b + b^2 + ... + b^d = O(b^d)`.
- Space `O(b^d)`: every generated node is kept in the frontier or reached set.

**Memory is the binding constraint.** With `b = 10`, one million nodes generated per second and 1 KB per node: depth 6 needs about 1 second and 1 GB; depth 8 about 100 seconds and 100 GB; depth 10 about 2.8 hours and 10 TB.

## 3. Uniform-Cost Search (UCS)

UCS (Dijkstra's algorithm applied to search) expands the node with the lowest path cost `g(n)`, using a **priority queue**. The goal test must be applied when a node is **selected for expansion**, not when generated, because a cheaper path to the goal may still be found. When a cheaper path to a state already on the frontier is found, the frontier entry is replaced.

- Complete provided every step cost is at least `ε > 0` (otherwise it can loop forever on zero-cost actions).
- Optimal for any non-negative step costs.
- Time and space `O(b^(1 + floor(C*/ε)))`, which can be much larger than `b^d` when there are many cheap steps. When all step costs are equal, this becomes `O(b^(d+1))`.

## 4. Depth-First Search (DFS)

DFS expands the deepest unexpanded node, using a **LIFO stack** (or recursion).

- Not complete in infinite state spaces or with loops in tree-like search; the graph-search version is complete in finite state spaces.
- Not optimal: it returns the first solution found, regardless of cost.
- Time `O(b^m)`, which is terrible if `m` is much larger than `d`.
- Space `O(bm)`: only a single path plus the unexpanded siblings of each node on it. **Backtracking search**, which generates one successor at a time, needs only `O(m)` memory.

The linear space requirement is the main reason DFS remains important.

## 5. Depth-Limited Search (DLS)

DLS is DFS with a depth limit `l`; nodes at depth `l` are treated as having no successors.

- Incomplete if `l < d`; not optimal if `l > d`.
- Time `O(b^l)`, space `O(bl)`.
- The limit can be chosen from domain knowledge, e.g. the **diameter** of the state space (any city in the 20-city Romania map is reachable from any other in at most 9 steps).

DLS has two kinds of failure: *failure* (no solution) and *cutoff* (no solution within the limit).

## 6. Iterative Deepening Search (IDS)

IDS runs DLS with limits `0, 1, 2, ...` until a goal is found. It combines the advantages of BFS and DFS.

```python
def iterative_deepening_search(problem):
    for limit in itertools.count():
        result = depth_limited_search(problem, limit)
        if result != "cutoff":
            return result
```

- Complete when `b` is finite; optimal when step costs are equal.
- Space `O(bd)`.
- Time `O(b^d)`. Nodes at depth 1 are generated `d` times, at depth 2 `d - 1` times, and so on: `N(IDS) = d*b + (d-1)*b^2 + ... + 1*b^d`.

**Worked comparison** with `b = 10`, `d = 5`:

- `N(IDS) = 50 + 400 + 3,000 + 20,000 + 100,000 = 123,450`
- `N(BFS) = 10 + 100 + 1,000 + 10,000 + 100,000 = 111,110`

The repeated work costs only about 11% extra. IDS is the preferred uninformed method when the search space is large and the solution depth is unknown.

## 7. Bidirectional Search

Run two simultaneous searches, forward from the initial state and backward from the goal, stopping when the frontiers meet. Motivation: `b^(d/2) + b^(d/2)` is much smaller than `b^d` (for `b = 10`, `d = 6`: 2,000 versus 1,000,000). It requires that actions can be reversed (predecessors computable) and that the goal is explicitly known. Time and space are `O(b^(d/2))`.

## 8. Summary Table

| Criterion | BFS | Uniform-cost | DFS | Depth-limited | Iterative deepening | Bidirectional |
|---|---|---|---|---|---|---|
| Complete? | Yes (a) | Yes (a, b) | No | No | Yes (a) | Yes (a, d) |
| Optimal? | Yes (c) | Yes | No | No | Yes (c) | Yes (c, d) |
| Time | O(b^d) | O(b^(1+floor(C*/ε))) | O(b^m) | O(b^l) | O(b^d) | O(b^(d/2)) |
| Space | O(b^d) | O(b^(1+floor(C*/ε))) | O(bm) | O(bl) | O(bd) | O(b^(d/2)) |

Conditions: (a) complete if `b` is finite; (b) complete if all step costs are at least `ε > 0`; (c) optimal if all step costs are identical; (d) if both directions use BFS.

## 9. Exam Pitfalls

- Applying the goal test at generation is correct for BFS but **incorrect** for UCS.
- DFS space is `O(bm)`, not `O(b^m)`; its **time** is `O(b^m)`.
- BFS is optimal only for uniform step costs; with varying costs use UCS.
- IDS is not wasteful in practice: most nodes lie at the deepest level.
