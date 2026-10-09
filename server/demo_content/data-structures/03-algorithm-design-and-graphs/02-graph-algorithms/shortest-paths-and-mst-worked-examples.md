# Shortest Paths and Minimum Spanning Trees

CS-201 Data Structures and Algorithms · Unit 3 · Worked Examples

This handout works through the weighted-graph algorithms examined in Unit 3: Dijkstra's algorithm, the Bellman-Ford algorithm, and the minimum spanning tree algorithms of Prim and Kruskal, together with the union-find structure Kruskal depends on.

## 1. Relaxation

Single-source shortest-path algorithms maintain an estimate `d[v]` of the distance from the source s, initialised to `d[s] = 0` and `d[v] = ∞` otherwise. **Relaxing** edge `(u, v)` with weight w means:

```python
if d[u] + w < d[v]:
    d[v] = d[u] + w
    parent[v] = u
```

Algorithms differ only in the order and number of relaxations.

## 2. Dijkstra's Algorithm

**Requirement:** all edge weights must be non-negative.

Repeatedly extract the unfinished vertex with the smallest `d`, mark it final, and relax its outgoing edges. Correctness rests on a greedy argument: when u is extracted, any other path to u would have to leave the finished set through a vertex whose distance is already at least `d[u]`, and non-negative weights cannot make that path shorter.

```python
import heapq

def dijkstra(adj, s):
    d = {v: float("inf") for v in adj}
    d[s] = 0
    pq = [(0, s)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > d[u]:
            continue                 # stale entry (lazy deletion)
        for v, w in adj[u]:
            if du + w < d[v]:
                d[v] = du + w
                heapq.heappush(pq, (d[v], v))
    return d
```

### 2.1 Complexity

| Priority queue | Running time | Best for |
|---|---|---|
| Unsorted array | O(V²) | Dense graphs |
| Binary heap | O((V + E) log V) | Sparse graphs |
| Fibonacci heap | O(E + V log V) | Theoretical bound |

With a binary heap there are V extract-min operations and up to E decrease-key (or push) operations, each O(log V), giving **O((V + E) log V)**, usually written O(E log V) for connected graphs.

### 2.2 Worked example

Directed edges: `A→B 4`, `A→C 1`, `C→B 2`, `B→D 1`, `C→D 5`, `D→E 3`. Source A.

| Step | Extracted | d[A] | d[B] | d[C] | d[D] | d[E] |
|---|---|---|---|---|---|---|
| init | — | 0 | ∞ | ∞ | ∞ | ∞ |
| 1 | A | 0 | 4 | 1 | ∞ | ∞ |
| 2 | C (1) | 0 | 3 | 1 | 6 | ∞ |
| 3 | B (3) | 0 | 3 | 1 | 4 | ∞ |
| 4 | D (4) | 0 | 3 | 1 | 4 | 7 |
| 5 | E (7) | 0 | 3 | 1 | 4 | 7 |

Shortest path to E: **A → C → B → D → E**, length 7. Note that the direct edge `A→B` (4) was improved to 3 via C.

### 2.3 Why negative edges break Dijkstra

Edges `S→A 2`, `S→B 5`, `B→A −4`, `A→C 1`. Dijkstra finalises A with d = 2 and C with d = 3 before processing B. The true distances are `d[A] = 1` (via B) and `d[C] = 2`. In the standard algorithm a finalised vertex is never reprocessed, so the error propagates to everything reachable from A. (Heap-based variants that re-push improved vertices may happen to repair small cases like this one, but they lose the O((V + E) log V) guarantee and can take exponential time; they are not a substitute for Bellman-Ford.)

## 3. Bellman-Ford Algorithm

Bellman-Ford handles **negative edge weights** and detects **negative-weight cycles** reachable from the source.

1. Initialise d as above.
2. Repeat `V − 1` times: relax every edge.
3. Make one more pass over all edges. If any edge can still be relaxed, a negative cycle is reachable and shortest paths are undefined.

`V − 1` passes suffice because a shortest simple path has at most `V − 1` edges, and after pass k all shortest paths using at most k edges are correct. Running time **O(V · E)**, which is slower than Dijkstra. It can stop early if a pass changes nothing. Bellman-Ford underlies distance-vector routing protocols such as RIP.

On the example in section 2.3 (V = 4), Bellman-Ford obtains `d[A] = 1` and `d[C] = 2` correctly.

## 4. Minimum Spanning Trees

A **spanning tree** of a connected, undirected, weighted graph connects all V vertices using exactly `V − 1` edges. A **minimum spanning tree (MST)** has the smallest total weight. If all edge weights are distinct, the MST is unique.

Both algorithms below rely on the **cut property**: for any partition of the vertices into two sets, the lightest edge crossing the partition belongs to some MST. A companion fact, the **cycle property**, states that the heaviest edge on any cycle (if unique) is in no MST.

### 4.1 Example graph

Undirected edges: `A–B 1`, `C–D 2`, `A–C 3`, `B–C 4`, `D–E 5`, `B–E 6`, `C–E 7`.

### 4.2 Kruskal's algorithm

Sort edges by weight; add each edge if it does not create a cycle, using union-find to test whether its endpoints are already connected.

- `A–B 1`: accept. `C–D 2`: accept. `A–C 3`: accept (joins {A, B} with {C, D}).
- `B–C 4`: reject, B and C are already connected.
- `D–E 5`: accept. Now `V − 1 = 4` edges; stop.

MST weight: `1 + 2 + 3 + 5 = 11`. Complexity **O(E log E) = O(E log V)**, dominated by sorting.

### 4.3 Prim's algorithm

Grow a single tree from a start vertex; at each step add the lightest edge connecting the tree to a vertex outside it (using a min-priority queue keyed on that edge weight). From A: take `A–B 1`, then `A–C 3`, then `C–D 2`, then `D–E 5`. Same total weight 11.

Complexity: **O(E log V)** with a binary heap, **O(V²)** with an array (better for dense graphs).

| Aspect | Prim | Kruskal |
|---|---|---|
| Strategy | Grow one tree from a vertex | Merge a forest of trees by global edge order |
| Key structure | Min-priority queue | Sorting + union-find |
| Complexity | O(E log V) heap, O(V²) array | O(E log E) |
| Better for | Dense graphs | Sparse graphs, edges already sorted |
| Disconnected graph | Spans one component | Produces a minimum spanning forest |

## 5. Union-Find (Disjoint Set Union)

Supports `find(x)` (representative of x's set) and `union(x, y)`.

```python
parent, rank = {}, {}

def find(x):
    if parent[x] != x:
        parent[x] = find(parent[x])          # path compression
    return parent[x]

def union(x, y):
    rx, ry = find(x), find(y)
    if rx == ry:
        return False                         # same set: edge forms a cycle
    if rank[rx] < rank[ry]:
        rx, ry = ry, rx
    parent[ry] = rx                          # union by rank
    if rank[rx] == rank[ry]:
        rank[rx] += 1
    return True
```

With both **union by rank** and **path compression**, a sequence of m operations costs `O(m · α(n))`, where α is the inverse Ackermann function; `α(n) ≤ 4` for any practical n, so each operation is effectively constant time. With union by rank alone, find is O(log n).

## 6. Choosing an Algorithm

- Unweighted graph: BFS, O(V + E).
- Non-negative weights: Dijkstra.
- Negative weights or negative-cycle detection: Bellman-Ford.
- All-pairs shortest paths on a dense graph: Floyd-Warshall, O(V³).
- DAG with any weights: relax edges in topological order, O(V + E).
