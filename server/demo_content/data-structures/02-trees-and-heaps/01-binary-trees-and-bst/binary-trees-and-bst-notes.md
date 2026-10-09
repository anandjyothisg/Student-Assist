# Binary Trees, Binary Search Trees and AVL Trees

CS-201 Data Structures and Algorithms · Unit 2 · Lecture Notes

## 1. Terminology

A **binary tree** is either empty or consists of a root node with a left subtree and a right subtree, each of which is a binary tree.

- **Depth** of a node: number of edges from the root to the node (root has depth 0).
- **Height** of a tree: number of edges on the longest root-to-leaf path. By the convention used in this course, a single node has height 0 and an empty tree has height -1.
- **Full** binary tree: every node has 0 or 2 children.
- **Complete** binary tree: every level is completely filled except possibly the last, which is filled from left to right (this is the shape used by binary heaps).
- **Perfect** binary tree: all internal nodes have 2 children and all leaves are at the same depth; a perfect tree of height h has `2^(h+1) - 1` nodes.

A binary tree with n nodes has height between `floor(log2 n)` (perfectly balanced) and `n - 1` (a degenerate "chain").

## 2. Traversals

All four traversals visit each node exactly once, so each runs in O(n) time. Recursive depth-first traversals use O(h) stack space; level-order uses a queue of size up to O(w), where w is the maximum width.

| Traversal | Order | Typical use |
|---|---|---|
| Preorder | node, left, right | Copying a tree, prefix expressions |
| Inorder | left, node, right | Produces sorted order in a BST |
| Postorder | left, right, node | Deleting a tree, evaluating expression trees |
| Level-order | level by level, left to right | BFS, printing by depth |

### Worked example

Insert the keys `50, 30, 70, 20, 40, 60, 80` into an empty BST. The resulting tree has root 50, children 30 and 70, and leaves 20, 40, 60, 80.

- Preorder: `50 30 20 40 70 60 80`
- Inorder: `20 30 40 50 60 70 80`
- Postorder: `20 40 30 60 80 70 50`
- Level-order: `50 30 70 20 40 60 80`

A binary tree is uniquely determined by its inorder traversal together with either its preorder or its postorder traversal. Preorder and postorder alone are not sufficient in general.

```python
def inorder(node, out):
    if node is not None:
        inorder(node.left, out)
        out.append(node.key)
        inorder(node.right, out)
```

## 3. Binary Search Trees

A **binary search tree (BST)** satisfies the ordering property: for every node `x`, all keys in the left subtree are less than `x.key` and all keys in the right subtree are greater than `x.key`. (Duplicates are either disallowed or consistently placed on one side.)

### 3.1 Search and insert

Start at the root and go left if the target is smaller, right if larger. Insertion follows the same path and attaches the new key as a leaf where the search fails.

```python
def insert(root, key):
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root
```

### 3.2 Deletion: three cases

To delete a node `z`:

1. **z is a leaf:** remove it by setting its parent's pointer to `None`.
2. **z has one child:** replace `z` with its child (splice it out).
3. **z has two children:** find the **inorder successor** `s` (the minimum of `z`'s right subtree, reached by going right once and then left as far as possible). Copy `s.key` into `z`, then delete `s` from the right subtree. The successor has no left child, so its deletion falls into case 1 or case 2. The inorder predecessor (maximum of the left subtree) may be used symmetrically.

Example: deleting 50 from the tree above replaces the root key with 60 (its successor) and removes the leaf 60.

### 3.3 Cost

Search, insert, delete, minimum, maximum, successor and predecessor all run in **O(h)**, where h is the height. For random insertion orders the expected height is O(log n), but inserting already sorted keys (e.g. `1, 2, 3, ..., n`) produces a chain with h = n - 1, so operations degrade to **O(n)**. Self-balancing trees guarantee h = O(log n).

## 4. AVL Trees

An **AVL tree** (Adelson-Velsky and Landis, 1962) is a BST in which every node satisfies

`balance factor = height(left subtree) - height(right subtree) ∈ {-1, 0, +1}`

The height of an AVL tree with n nodes is at most about `1.44 log2(n + 2)`, so search, insert and delete are **O(log n)** in the worst case. The bound follows from the minimum number of nodes in an AVL tree of height h: `N(h) = N(h-1) + N(h-2) + 1`, a Fibonacci-like recurrence that grows exponentially.

### 4.1 Rebalancing after insertion

After a standard BST insertion, walk back towards the root updating heights. The first node whose balance factor becomes +2 or -2 is the **critical node** `z`. Four cases arise depending on where the new key was inserted relative to `z`:

| Case | Inserted into | Balance factors | Fix |
|---|---|---|---|
| LL | left subtree of left child | z: +2, child: +1 | single **right** rotation at z |
| RR | right subtree of right child | z: -2, child: -1 | single **left** rotation at z |
| LR | right subtree of left child | z: +2, child: -1 | left rotation at child, then right rotation at z |
| RL | left subtree of right child | z: -2, child: +1 | right rotation at child, then left rotation at z |

A rotation changes only a constant number of pointers and preserves the inorder sequence, so the BST property is maintained. After an insertion, at most one single or double rotation is needed; after a deletion, rotations may propagate up to O(log n) ancestors.

```python
def rotate_right(z):
    y = z.left
    z.left = y.right       # y's right subtree moves under z
    y.right = z
    update_height(z); update_height(y)
    return y               # y is the new subtree root
```

### 4.2 Worked examples

- **RR:** insert `10, 20, 30`. Node 10 gets balance factor -2 with right child 20 at -1. A left rotation at 10 makes 20 the root with children 10 and 30.
- **LR:** insert `30, 10, 20`. Node 30 has balance factor +2; its left child 10 has -1. Rotate left at 10 (giving 30 → 20 → 10 on the left), then rotate right at 30. Result: root 20, children 10 and 30.

## 5. Pitfalls

- Checking only a node's immediate children when verifying the BST property. The tree with root 50, left child 30 and 30's right child 60 violates the property even though each parent-child pair looks valid. A correct check passes down a `(low, high)` range.
- Confusing height and depth, or the height convention (edges vs nodes). State the convention in exam answers.
- Forgetting to update heights after a rotation, bottom node first.
