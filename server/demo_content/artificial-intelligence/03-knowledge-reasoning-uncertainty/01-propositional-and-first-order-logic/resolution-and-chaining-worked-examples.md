# Resolution, CNF and Chaining — Worked Examples

These examples accompany the logic lecture notes. Work each one by hand before reading the solution.

## 1. Conjunctive Normal Form (CNF)

A sentence is in **CNF** if it is a conjunction of **clauses**, where each clause is a disjunction of literals: for example `(A ∨ ¬B) ∧ (B ∨ C ∨ ¬D)`. Every propositional sentence is logically equivalent to a CNF sentence.

### 1.1 Conversion procedure (propositional)

1. **Eliminate ⇔**: replace `α ⇔ β` with `(α ⇒ β) ∧ (β ⇒ α)`.
2. **Eliminate ⇒**: replace `α ⇒ β` with `¬α ∨ β`.
3. **Move ¬ inwards** using double negation and De Morgan's laws, until negation applies only to atoms.
4. **Distribute ∨ over ∧**: `α ∨ (β ∧ γ)` becomes `(α ∨ β) ∧ (α ∨ γ)`.

### 1.2 Example: the wumpus-world breeze rule

Convert `B1,1 ⇔ (P1,2 ∨ P2,1)` ("square [1,1] is breezy iff there is a pit in [1,2] or [2,1]").

- Step 1: `(B1,1 ⇒ (P1,2 ∨ P2,1)) ∧ ((P1,2 ∨ P2,1) ⇒ B1,1)`
- Step 2: `(¬B1,1 ∨ P1,2 ∨ P2,1) ∧ (¬(P1,2 ∨ P2,1) ∨ B1,1)`
- Step 3: `(¬B1,1 ∨ P1,2 ∨ P2,1) ∧ ((¬P1,2 ∧ ¬P2,1) ∨ B1,1)`
- Step 4: `(¬B1,1 ∨ P1,2 ∨ P2,1) ∧ (¬P1,2 ∨ B1,1) ∧ (¬P2,1 ∨ B1,1)`

Result: three clauses.

### 1.3 Practice

Convert `(A ∧ B) ⇒ C`. Answer: `¬(A ∧ B) ∨ C` then `¬A ∨ ¬B ∨ C`, a single clause. A clause of this form, with at most one positive literal, is a **Horn clause**.

## 2. The Resolution Rule

Given two clauses containing a complementary pair of literals, resolution produces the **resolvent**: the disjunction of all remaining literals.

```
(ℓ1 ∨ ... ∨ ℓi ∨ ... ∨ ℓk),   (m1 ∨ ... ∨ mj ∨ ... ∨ mn)     where ℓi = ¬mj
-------------------------------------------------------------------------
(ℓ1 ∨ ... ∨ ℓi-1 ∨ ℓi+1 ∨ ... ∨ ℓk ∨ m1 ∨ ... ∨ mj-1 ∨ mj+1 ∨ ... ∨ mn)
```

- Example: `(P ∨ Q)` and `(¬Q ∨ R)` resolve to `(P ∨ R)`.
- **Factoring**: the resolvent must contain only one copy of each literal: `(A ∨ B)` and `(A ∨ ¬B)` resolve to `A`, not `A ∨ A`.
- Resolve on **one** complementary pair at a time. `(P ∨ Q)` and `(¬P ∨ ¬Q)` do **not** resolve to the empty clause; resolving on P gives `Q ∨ ¬Q`, a tautology.
- Resolving `P` with `¬P` gives the **empty clause**, written `□`, which represents a contradiction.

## 3. Resolution Refutation

To show `KB ⊨ α`, show that `KB ∧ ¬α` is unsatisfiable:

```python
def pl_resolution(kb_clauses, alpha):
    clauses = set(kb_clauses) | set(to_cnf(Not(alpha)))
    while True:
        new = set()
        for ci, cj in all_pairs(clauses):
            for resolvent in resolve(ci, cj):
                if resolvent == EMPTY_CLAUSE:
                    return True        # KB entails alpha
                new.add(resolvent)
        if new <= clauses:
            return False               # no new clauses: not entailed
        clauses |= new
```

Propositional resolution is **sound and complete** for refutation (the **ground resolution theorem**): if a set of clauses is unsatisfiable, the resolution closure contains the empty clause.

### 3.1 Worked example

KB: the breeze rule from 1.2 plus the percept `¬B1,1`. Query: `α = ¬P1,2` (there is no pit in [1,2]).

Clauses:

| # | Clause | Source |
|---|---|---|
| 1 | ¬B1,1 ∨ P1,2 ∨ P2,1 | KB |
| 2 | ¬P1,2 ∨ B1,1 | KB |
| 3 | ¬P2,1 ∨ B1,1 | KB |
| 4 | ¬B1,1 | KB (percept) |
| 5 | P1,2 | negated query |

Derivation:

- Resolve 5 with 2 on `P1,2`: clause 6 = `B1,1`.
- Resolve 6 with 4 on `B1,1`: the **empty clause**.

Therefore `KB ⊨ ¬P1,2`. Two resolution steps suffice; a breadth-first resolution procedure would generate many more irrelevant clauses before finding them.

## 4. Resolution in First-Order Logic

FOL CNF conversion adds steps: eliminate implications, move ¬ inwards (with `¬∀x p ≡ ∃x ¬p`), **standardise variables apart**, **Skolemise** (replace existential variables by Skolem constants or by Skolem functions of the enclosing universal variables), **drop universal quantifiers**, then distribute ∨ over ∧.

Example: from `∀x Man(x) ⇒ Mortal(x)` and `Man(Socrates)`, prove `Mortal(Socrates)`.

1. Clauses: `¬Man(x) ∨ Mortal(x)`; `Man(Socrates)`; negated goal `¬Mortal(Socrates)`.
2. Resolve clause 1 with the negated goal using unifier `{x/Socrates}`: `¬Man(Socrates)`.
3. Resolve with `Man(Socrates)`: empty clause. Proven.

## 5. Horn Clauses, Forward and Backward Chaining

A **definite clause** has exactly one positive literal; a **Horn clause** has at most one. Definite clauses can be written as implications whose premise is a conjunction of positive literals: `¬L ∨ ¬M ∨ P` is `L ∧ M ⇒ P`. A single positive literal is a **fact**. Entailment for Horn KBs can be decided in time **linear** in the size of the KB.

Knowledge base used below:

```
1. P ⇒ Q
2. L ∧ M ⇒ P
3. B ∧ L ⇒ M
4. A ∧ P ⇒ L
5. A ∧ B ⇒ L
6. A
7. B
```

Query: `Q`.

### 5.1 Forward chaining (data-driven)

Start from known facts and fire any rule whose premises are all satisfied, adding its conclusion, until the query is added or nothing new can be inferred. Each rule keeps a count of unsatisfied premises.

- Known: A, B.
- Rule 5 (A ∧ B): infer **L**.
- Rule 3 (B ∧ L): infer **M**.
- Rule 2 (L ∧ M): infer **P**.
- Rule 1 (P): infer **Q**. Query proven. (Rule 4 now also fires but adds nothing new.)

### 5.2 Backward chaining (goal-driven)

Start from the query and work backwards, finding rules that conclude the goal and proving their premises recursively.

- Goal Q: by rule 1, need P.
- Goal P: by rule 2, need L and M.
- Goal L: rule 4 needs A and P, but P is already on the goal stack, so this branch is abandoned to avoid a loop. Rule 5 needs A and B: both are facts. L proven.
- Goal M: rule 3 needs B (fact) and L (proven). M proven.
- Hence P, then Q, proven.

### 5.3 Comparison

| Aspect | Forward chaining | Backward chaining |
|---|---|---|
| Direction | Facts to conclusions | Query to facts |
| Style | Data-driven | Goal-driven |
| Work done | May derive many irrelevant facts | Touches only relevant facts; often much less than linear |
| Typical use | Monitoring, production systems, updating beliefs on new percepts | Question answering, Prolog |
| Complexity (Horn) | Linear in KB size | Linear or better |

Both are sound and complete for definite-clause KBs. They are **not** complete for general propositional KBs, where full resolution is required.
