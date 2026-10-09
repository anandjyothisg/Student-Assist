# Adversarial Search: Minimax and Alpha-Beta Pruning

## 1. Games as Search Problems

Adversarial search addresses **competitive multi-agent environments** in which opponents have conflicting goals. The classic setting is a **two-player, deterministic, turn-taking, perfect-information, zero-sum** game (chess, checkers, Go, tic-tac-toe). "Zero-sum" means the total payoff to all players is the same for every outcome: one player's gain is the other's loss.

The two players are called **MAX** (moves first) and **MIN**. A game is defined by:

- `S0`: the initial state.
- `TO-MOVE(s)`: the player whose turn it is in state `s`.
- `ACTIONS(s)`: the legal moves in `s`.
- `RESULT(s, a)`: the transition model.
- `IS-TERMINAL(s)`: true when the game is over.
- `UTILITY(s, p)`: the numeric payoff of terminal state `s` for player `p` (chess: +1, 0 or -1; equivalently 1, 1/2, 0).

The **game tree** for tic-tac-toe has fewer than 9! = 362,880 terminal nodes (only 5,478 distinct legal positions). Chess has an average branching factor of about **35**, games often reach about 100 plies (half-moves), giving a tree of roughly 35^100 ≈ 10^154 nodes, although only about 10^40 distinct positions.

## 2. The Minimax Algorithm

The **minimax value** of a state is the utility (for MAX) of being in that state, assuming both players play optimally to the end:

```
MINIMAX(s) =
    UTILITY(s, MAX)                                if IS-TERMINAL(s)
    max over a in ACTIONS(s) of MINIMAX(RESULT(s,a))   if TO-MOVE(s) = MAX
    min over a in ACTIONS(s) of MINIMAX(RESULT(s,a))   if TO-MOVE(s) = MIN
```

```python
def minimax_decision(game, state):
    return max(game.actions(state),
               key=lambda a: min_value(game, game.result(state, a)))

def max_value(game, s):
    if game.is_terminal(s):
        return game.utility(s, MAX)
    return max(min_value(game, game.result(s, a)) for a in game.actions(s))

def min_value(game, s):
    if game.is_terminal(s):
        return game.utility(s, MAX)
    return min(max_value(game, game.result(s, a)) for a in game.actions(s))
```

Minimax performs a complete **depth-first** exploration of the game tree:

- Complete if the tree is finite; optimal against an optimal opponent.
- Time `O(b^m)`, space `O(bm)` (or `O(m)` if actions are generated one at a time), where `m` is the maximum depth.
- Against a suboptimal opponent, MAX does at least as well as the minimax value.

## 3. Worked Example: Minimax

Consider a two-ply tree. The root A is a MAX node with three moves `a1, a2, a3` leading to MIN nodes B, C and D. Each MIN node has three moves leading to terminal states with the following utilities (left to right):

| MIN node | Leaf utilities | Minimax value |
|---|---|---|
| B | 3, 12, 8 | min = 3 |
| C | 2, 4, 6 | min = 2 |
| D | 14, 5, 2 | min = 2 |

The root value is `max(3, 2, 2) = 3`, so the **minimax decision** at A is move `a1` (to B). MIN would answer `a1` with the move leading to utility 3.

## 4. Alpha-Beta Pruning

Alpha-beta pruning returns the **same decision as minimax** but avoids examining branches that cannot influence the decision. It maintains two bounds along the current path:

- `α` (alpha): the value of the best (highest) choice found so far for MAX along the path. Initially `-∞`.
- `β` (beta): the value of the best (lowest) choice found so far for MIN along the path. Initially `+∞`.

A MIN node stops examining children as soon as its value `v <= α` (MAX above will never let play reach here). A MAX node stops as soon as `v >= β`.

```python
def alphabeta_max(game, s, alpha, beta):
    if game.is_terminal(s):
        return game.utility(s, MAX)
    v = float("-inf")
    for a in game.actions(s):
        v = max(v, alphabeta_min(game, game.result(s, a), alpha, beta))
        if v >= beta:
            return v              # beta cut-off
        alpha = max(alpha, v)
    return v

def alphabeta_min(game, s, alpha, beta):
    if game.is_terminal(s):
        return game.utility(s, MAX)
    v = float("inf")
    for a in game.actions(s):
        v = min(v, alphabeta_max(game, game.result(s, a), alpha, beta))
        if v <= alpha:
            return v              # alpha cut-off
        beta = min(beta, v)
    return v
```

### 4.1 Trace on the example tree

1. At A: `α = -∞, β = +∞`. Visit B.
2. B, leaf 3: `v = 3`, so B's `β = 3`. Leaf 12 and leaf 8 do not lower `v`. B returns **3**. At A, `α = 3`.
3. C, with `α = 3`: first leaf 2 gives `v = 2 <= α = 3`. **Prune** the leaves 4 and 6: whatever they are, C's value is at most 2, and MAX already has 3. C returns 2.
4. D, with `α = 3`: leaf 14 gives `v = 14`, `β = 14`; leaf 5 gives `v = 5`, `β = 5`; leaf 2 gives `v = 2`. D returns 2.
5. Root value = `max(3, 2, 2) = 3`. Decision: `a1`.

Seven of the nine leaves were evaluated. Had D's leaves been ordered `2, 5, 14`, the first leaf would have triggered a cut-off immediately, and only **five** leaves would have been evaluated.

### 4.2 Effect of move ordering

| Move ordering | Nodes examined | Effective branching factor |
|---|---|---|
| No pruning (plain minimax) | O(b^m) | b |
| Random ordering | about O(b^(3m/4)) | about b^(3/4) |
| Perfect ordering (best move first) | O(b^(m/2)) | sqrt(b) |

With perfect ordering, alpha-beta can search **roughly twice as deep** as minimax in the same time; for chess, the effective branching factor drops from 35 to about 6. Practical ordering techniques:

- Try **captures first**, then threats, then forward moves, then backward moves.
- **Killer move heuristic**: try moves that caused cut-offs elsewhere at the same depth.
- **Iterative deepening**: use the best moves from the previous iteration to order the current one.
- **Transposition tables**: cache values of positions already evaluated, since different move sequences can reach the same position.

## 5. Imperfect Real-Time Decisions

Real games cannot be searched to terminal states. **Heuristic alpha-beta** replaces the terminal test with a **cutoff test** (e.g. a depth limit) and the utility with an **evaluation function** `EVAL(s)`, typically a weighted linear function:

```
EVAL(s) = w1*f1(s) + w2*f2(s) + ... + wn*fn(s)
```

In chess, the classical material weights are pawn 1, knight 3, bishop 3, rook 5, queen 9. Important refinements:

- **Quiescence search**: extend the search in non-quiescent positions (e.g. pending captures) so the evaluation is applied only to stable positions.
- **Horizon effect**: an unavoidable loss is pushed beyond the search depth by delaying moves, making the position look better than it is.
- **Forward pruning** (e.g. beam search, ProbCut) discards moves that appear poor without full search; unlike alpha-beta it can lose the optimal move.

## 6. Stochastic Games

Games with chance elements (backgammon) add **chance nodes**. **Expectiminimax** computes the probability-weighted average at chance nodes: `EXPECTIMINIMAX(s) = sum over r of P(r) * EXPECTIMINIMAX(RESULT(s, r))`. Time becomes `O(b^m n^m)`, where `n` is the number of distinct chance outcomes (21 for two dice in backgammon). Unlike minimax, whose decisions are unchanged by any order-preserving transformation of the evaluation function, expectiminimax decisions are preserved only under **positive linear** transformations, so the evaluation function must be proportional to expected utility.

## 7. Exam Pitfalls

- Alpha-beta never changes the minimax value at the root; it only skips irrelevant nodes.
- The `O(b^(m/2))` bound is the **best case**, requiring perfect ordering.
- `α` belongs to MAX and is raised; `β` belongs to MIN and is lowered. Prune when `α >= β`.
