# Graph Representation, Traversal and Topological Sort

CS-201 Data Structures and Algorithms · Unit 3 · Lecture Notes

## 1. Definitions

A **graph** `G = (V, E)` consists of a set of vertices V and a set of edges E. Throughout, `V` and `E` also denote the number of vertices and edges.

- **Directed** graph: edges are ordered pairs `(u, v)`. **Undirected**: unordered pairs `{u, v}`.
- **Weighted** graph: each edge carries a weight `w(u, v)`.
- **Degree** of a vertex in an undirected graph: number of incident edges. The **handshaking lemma** states that the sum of all degrees equals `2E`.
- In a directed graph, each vertex has an **in-degree** and an **out-degree**.
- A simple undirected graph has at most `V(V − 1)/2` edges; a simple directed graph at most `V(V − 1)`. A graph is **dense** if E is close to V² and **sparse** if E is close to V.
- A **DAG** is a directed acyclic graph.

## 2. Representations

### 2.1 Adjacency matrix

A `V × V` array where `M[u][v] = 1` (or the weight) if edge `(u, v)` exists. For an undirected graph the matrix is symmetric.

### 2.2 Adjacency list

An array of V lists; list `Adj[u]` contains the neighbours of u (with weights, if any). An undirected edge appears in two lists, so the total list length is `2E`; for a directed graph it is `E`.

| Criterion | Adjacency matrix | Adjacency list |
|---|---|---|
| Space | Θ(V²) | Θ(V + E) |
| Test whether edge (u, v) exists | O(1) | O(deg(u)) |
| Iterate over neighbours of u | Θ(V) | Θ(deg(u)) |
| Add an edge | O(1) | O(1) |
| Best suited for | Dense graphs, frequent edge queries | Sparse graphs (most real graphs) |

The choice of representation changes the complexity of traversals: BFS and DFS run in **O(V + E)** with adjacency lists but **O(V²)** with an adjacency matrix, because finding the neighbours of each vertex requires scanning a whole row.

```python
from collections import defaultdict
graph = defaultdict(list)
for u, v in [("A", "B"), ("A", "C"), ("B", "D"), ("C", "D")]:
    graph[u].append(v)
    graph[v].append(u)      # omit for a directed graph
```

## 3. Breadth-First Search (BFS)

BFS starts at a source s and explores vertices in order of increasing distance (number of edges) from s, using a FIFO queue.

```python
from collections import deque

def bfs(graph, s):
    dist = {s: 0}
    parent = {s: None}
    q = deque([s])
    while q:
        u = q.popleft()
        for v in graph[u]:
            if v not in dist:            # mark when enqueued, not when dequeued
                dist[v] = dist[u] + 1
                parent[v] = u
                q.append(v)
    return dist, parent
```

Properties:

- Each vertex is enqueued at most once and each adjacency list is scanned once: **O(V + E)** time, O(V) extra space.
- `dist[v]` is the **shortest-path distance in edges** from s; following `parent` pointers reconstructs a shortest path. BFS does not give shortest paths in weighted graphs.
- The parent pointers form a **BFS tree**. In an undirected graph, every non-tree edge connects vertices whose levels differ by at most 1.
- Applications: shortest paths in unweighted graphs, testing bipartiteness (2-colour by level parity; an edge within one level means an odd cycle), finding connected components, web crawling.

## 4. Depth-First Search (DFS)

DFS goes as deep as possible along each branch before backtracking. It is naturally recursive (or uses an explicit stack).

```python
def dfs(graph, u, visited, order):
    visited.add(u)
    for v in graph[u]:
        if v not in visited:
            dfs(graph, v, visited, order)
    order.append(u)       # postorder: u finishes after all descendants
```

DFS also runs in **O(V + E)**. Recording discovery and finish times classifies the edges of a directed graph:

- **Tree edge:** to a newly discovered vertex.
- **Back edge:** to an ancestor still on the recursion stack. **A directed graph has a cycle if and only if DFS finds a back edge.**
- **Forward edge:** to a descendant already finished.
- **Cross edge:** to a vertex in another, already finished subtree.

In an undirected graph only tree and back edges occur. Applications of DFS include cycle detection, topological sorting, strongly connected components (Kosaraju or Tarjan, both O(V + E)), and finding bridges and articulation points.

### BFS versus DFS

| Aspect | BFS | DFS |
|---|---|---|
| Data structure | Queue | Stack / recursion |
| Order | Level by level | Deep first, then backtrack |
| Shortest path (unweighted) | Yes | No |
| Memory on wide, shallow graphs | High (stores a whole level) | Low |
| Typical uses | Distances, bipartite test | Cycles, topological order, SCCs |

## 5. Topological Sort

A **topological order** of a DAG is a linear ordering of vertices such that for every edge `(u, v)`, u appears before v. It exists **if and only if the graph is acyclic**, and is generally not unique. Typical use: scheduling tasks with prerequisites, such as course prerequisites or build dependencies.

### 5.1 Kahn's algorithm (BFS-based)

1. Compute the in-degree of every vertex.
2. Enqueue all vertices with in-degree 0.
3. Repeatedly dequeue u, append it to the output, and decrement the in-degree of each successor v; if v's in-degree becomes 0, enqueue v.
4. If the output contains fewer than V vertices, the graph has a cycle.

Running time **O(V + E)**.

```python
from collections import deque

def kahn(vertices, edges):
    adj = {v: [] for v in vertices}
    indeg = {v: 0 for v in vertices}
    for u, v in edges:
        adj[u].append(v)
        indeg[v] += 1
    q = deque(v for v in vertices if indeg[v] == 0)
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(order) != len(vertices):
        raise ValueError("graph contains a cycle")
    return order
```

### 5.2 Worked example

Edges: `A→C, B→C, C→D, B→E, E→D`. Initial in-degrees: A 0, B 0, C 2, D 2, E 1.

1. Queue `[A, B]`. Remove A; C drops to 1.
2. Remove B; C drops to 0 (enqueue C); E drops to 0 (enqueue E).
3. Remove C; D drops to 1.
4. Remove E; D drops to 0 (enqueue D).
5. Remove D.

Topological order: **A, B, C, E, D**. (B, A, E, C, D is also valid.)

### 5.3 DFS-based alternative

Run DFS from every unvisited vertex and output vertices in **reverse order of finishing time** (reverse postorder). Also O(V + E). A back edge discovered during the search indicates that no topological order exists.

## 6. Pitfalls

- Marking vertices visited when they are dequeued rather than when enqueued in BFS, which allows duplicates in the queue.
- Running topological sort on a graph with cycles and not checking the output length.
- Forgetting that recursive DFS on a path of 10^5 vertices exceeds Python's default recursion limit of 1000; use an explicit stack.
