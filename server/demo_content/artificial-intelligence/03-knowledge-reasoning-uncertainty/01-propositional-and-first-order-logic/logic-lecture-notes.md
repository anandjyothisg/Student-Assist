# Propositional and First-Order Logic

## 1. Knowledge-Based Agents

A **knowledge-based agent** maintains a **knowledge base (KB)**: a set of **sentences** in a formal **knowledge representation language**. It interacts with the KB through two operations:

- `TELL(KB, sentence)`: add a sentence (a percept or background fact).
- `ASK(KB, query)`: ask whether the query follows from the KB.

Answers must follow from what has been told; this is the job of the **inference** mechanism. The declarative approach means a designer can tell the agent what it needs to know rather than encoding behaviour procedurally.

## 2. Propositional Logic: Syntax

- **Atomic sentences** are proposition symbols such as `P`, `Q`, `W1,3` ("there is a wumpus in square [1,3]"), plus the constants `True` and `False`.
- **Complex sentences** are built with five connectives, listed in order of precedence (highest first):

| Connective | Name | Example | Reading |
|---|---|---|---|
| ¬ | negation | ¬P | not P |
| ∧ | conjunction | P ∧ Q | P and Q |
| ∨ | disjunction | P ∨ Q | P or Q |
| ⇒ | implication | P ⇒ Q | if P then Q |
| ⇔ | biconditional | P ⇔ Q | P if and only if Q |

In `P ⇒ Q`, `P` is the **premise** (antecedent) and `Q` the **conclusion** (consequent). A **literal** is an atom or a negated atom.

## 3. Semantics

A **model** assigns `true` or `false` to every proposition symbol; with `n` symbols there are `2^n` models. The truth value of a complex sentence is computed recursively using truth tables. The only potentially surprising case is implication: `P ⇒ Q` is **false only when P is true and Q is false**. In particular, `False ⇒ anything` is true.

### 3.1 Entailment

`KB ⊨ α` (KB **entails** α) means α is true in every model in which KB is true. Writing `M(KB)` for the set of models of KB:

```
KB ⊨ α   if and only if   M(KB) ⊆ M(α)
```

Entailment is a semantic relation; **inference** (`KB ⊢ α`) is the syntactic process of deriving α.

- An inference procedure is **sound** (truth-preserving) if it derives only entailed sentences.
- It is **complete** if it can derive every entailed sentence.

### 3.2 Validity and satisfiability

- A sentence is **valid** (a **tautology**) if it is true in all models, e.g. `P ∨ ¬P`.
- A sentence is **satisfiable** if it is true in at least one model; **unsatisfiable** if true in none, e.g. `P ∧ ¬P`.
- **Deduction theorem**: `α ⊨ β` iff `(α ⇒ β)` is valid.
- **Refutation (proof by contradiction)**: `α ⊨ β` iff `(α ∧ ¬β)` is unsatisfiable. This is the basis of resolution.

Propositional satisfiability (**SAT**) was the first problem proved **NP-complete** (Cook, 1971). Truth-table model checking is sound and complete but takes `O(2^n)` time for `n` symbols (and `O(n)` space with depth-first enumeration). Practical solvers include **DPLL** (complete, backtracking with unit propagation and pure-symbol heuristics) and **WalkSAT** (incomplete local search).

## 4. Logical Equivalences

Two sentences are **logically equivalent** (`α ≡ β`) if they are true in the same set of models, equivalently if each entails the other.

| Name | Equivalence |
|---|---|
| Double negation | ¬(¬α) ≡ α |
| Contraposition | (α ⇒ β) ≡ (¬β ⇒ ¬α) |
| Implication elimination | (α ⇒ β) ≡ (¬α ∨ β) |
| Biconditional elimination | (α ⇔ β) ≡ ((α ⇒ β) ∧ (β ⇒ α)) |
| De Morgan | ¬(α ∧ β) ≡ (¬α ∨ ¬β); ¬(α ∨ β) ≡ (¬α ∧ ¬β) |
| Distributivity of ∨ over ∧ | (α ∨ (β ∧ γ)) ≡ ((α ∨ β) ∧ (α ∨ γ)) |

Note: `α ⇒ β` is **not** equivalent to its converse `β ⇒ α`.

## 5. Inference Rules

An inference rule is written premises / conclusion. Standard sound rules:

- **Modus Ponens**: from `α ⇒ β` and `α`, infer `β`.
- **And-Elimination**: from `α ∧ β`, infer `α` (and `β`).
- **Modus Tollens**: from `α ⇒ β` and `¬β`, infer `¬α`.
- **Biconditional elimination** and all the equivalences above, used in either direction.
- **Resolution**: from `(ℓ1 ∨ ... ∨ ℓk)` and `m` where `m` is the complement of some `ℓi`, infer the clause with `ℓi` removed. In general, two clauses containing complementary literals resolve to the disjunction of their remaining literals.

**Example.** KB = { `R ⇒ W` ("if it rains the grass is wet"), `R` }. Modus Ponens derives `W`. If instead KB = { `R ⇒ W`, `¬W` }, Modus Tollens derives `¬R`. Note that from `R ⇒ W` and `W` we **cannot** conclude `R` (the fallacy of affirming the consequent).

**Monotonicity**: the set of entailed sentences can only grow as information is added to the KB. If `KB ⊨ α`, then `KB ∧ β ⊨ α`.

Resolution requires sentences in **conjunctive normal form (CNF)**; forward and backward chaining operate on **Horn clauses**. These procedures are worked through in the companion document *Resolution, CNF and Chaining — Worked Examples*.

## 6. First-Order Logic (FOL)

Propositional logic cannot express general statements compactly: "pits cause breezes in adjacent squares" needs a separate sentence for every square. First-order (predicate) logic assumes the world contains **objects**, **relations** among them and **functions**.

### 6.1 Syntax

- **Constant symbols** name objects: `John`, `Richard`.
- **Predicate symbols** name relations: `Brother(Richard, John)`, `King(John)`.
- **Function symbols** name functions: `LeftLeg(John)`.
- A **term** refers to an object: a constant, a variable, or a function applied to terms.
- An **atomic sentence** is a predicate applied to terms, or an equality `t1 = t2`.
- Complex sentences use the propositional connectives and **quantifiers**.

### 6.2 Quantifiers

- **Universal** `∀x P(x)`: P holds for every object. "All kings are persons": `∀x King(x) ⇒ Person(x)`.
- **Existential** `∃x P(x)`: P holds for at least one object. "John has a crown on his head": `∃x Crown(x) ∧ OnHead(x, John)`.

Rules of thumb (frequent exam errors):

- `⇒` is the natural connective with `∀`. Writing `∀x King(x) ∧ Person(x)` wrongly asserts that everything is a king and a person.
- `∧` is the natural connective with `∃`. Writing `∃x Crown(x) ⇒ OnHead(x, John)` is true if there is any object that is not a crown, which is far too weak.

Quantifier order matters: `∀x ∃y Loves(x, y)` ("everybody loves somebody") differs from `∃y ∀x Loves(x, y)` ("there is someone loved by everyone"). The quantifiers are dual:

```
∀x ¬P(x) ≡ ¬∃x P(x)        ¬∀x P(x) ≡ ∃x ¬P(x)
```

### 6.3 Inference in FOL

- **Universal Instantiation (UI)**: from `∀v α`, infer `SUBST({v/g}, α)` for any ground term `g`. Can be applied many times.
- **Existential Instantiation (EI)**: from `∃v α`, infer `SUBST({v/k}, α)` for a **new** constant `k` (a **Skolem constant**) not appearing elsewhere. Applied once.
- **Unification** finds a substitution θ that makes two expressions identical: `UNIFY(Knows(John, x), Knows(y, Bill)) = {y/John, x/Bill}`. The **most general unifier** is unique up to renaming. The **occurs check** prevents unifying `x` with `F(x)`.
- **Generalized Modus Ponens**: from `p1', ..., pn'` and `(p1 ∧ ... ∧ pn ⇒ q)`, with `SUBST(θ, pi') = SUBST(θ, pi)` for all `i`, infer `SUBST(θ, q)`.

Entailment in FOL is **semidecidable** (Turing and Church, 1936): algorithms exist that say yes to every entailed sentence, but none can say no to every non-entailed sentence.

## 7. Summary

| Property | Propositional logic | First-order logic |
|---|---|---|
| Ontology | Facts | Objects, relations, functions |
| Quantification | None | ∀, ∃ over objects |
| Entailment decidable? | Yes (co-NP-complete) | Semidecidable |
| Typical complete inference | Resolution, DPLL | Resolution with unification |
