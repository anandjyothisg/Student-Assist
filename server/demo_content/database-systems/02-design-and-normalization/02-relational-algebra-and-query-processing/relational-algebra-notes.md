# Relational Algebra and Query Optimization

CS-305 Database Management Systems · Unit 2 · Lecture Notes

## 1. Role of Relational Algebra

Relational algebra is a procedural query language whose operators take one or two relations as input and produce a relation as output (**closure**), so operators can be composed into expressions. SQL is declarative; a DBMS translates each SQL query into a relational algebra expression, represented as a **query tree**, which the optimizer then rewrites and assigns physical algorithms to.

Notation in these notes uses the Greek symbols with plain-text equivalents: σ (select), π (project), ⋈ (join), ∪, −, ×, ρ (rename).

## 2. Fundamental Operators

| Operator | Symbol | Arity | Result |
|---|---|---|---|
| Selection | `σ_condition(R)` | Unary | Rows of R satisfying the condition |
| Projection | `π_attrs(R)` | Unary | Only the listed columns, duplicates removed |
| Union | `R ∪ S` | Binary | Tuples in R or S |
| Set difference | `R − S` | Binary | Tuples in R but not in S |
| Cartesian product | `R × S` | Binary | Every pairing of an R tuple with an S tuple |
| Rename | `ρ_newname(R)` | Unary | Same relation with a new name or attribute names |

These six operators are a complete set: every other operator can be expressed using them.

### 2.1 Selection and projection

- `σ_{dept='CS' ∧ gpa>8}(Student)` returns CS students with GPA above 8. Selection never changes the schema; its result has at most as many tuples as R.
- `π_{name, dept}(Student)` keeps two columns. Because the result is a set, duplicate rows are removed, so the result can have fewer tuples than R. SQL's `SELECT` does **not** remove duplicates unless `DISTINCT` is written.
- Selections are commutative and cascade: `σ_{c1 ∧ c2}(R) = σ_{c1}(σ_{c2}(R))`.

### 2.2 Union compatibility

`R ∪ S`, `R − S` and `R ∩ S` require R and S to have the same number of attributes with compatible domains. Difference is not commutative: `R − S ≠ S − R` in general.

## 3. Derived Operators

- **Intersection:** `R ∩ S = R − (R − S)`.
- **Theta join:** `R ⋈_θ S = σ_θ(R × S)`.
- **Equi-join:** a theta join whose condition uses only equality.
- **Natural join:** `R ⋈ S` equates all attributes with the same name and keeps one copy of each.
- **Outer joins** (left, right, full) pad unmatched tuples with NULLs; they are extensions beyond the basic algebra.
- **Division:** `R ÷ S` returns the values in R's remaining attributes that are paired in R with **every** tuple of S. Example: `π_{sid,cid}(Enrollment) ÷ π_{cid}(σ_{dept='CS'}(Course))` gives the students enrolled in all CS courses. In SQL, division is usually written with a double `NOT EXISTS`.

Cardinality facts worth remembering: if R has r tuples and S has s tuples, `R × S` has exactly `r · s` tuples; `R ∪ S` has between `max(r, s)` and `r + s`; `R ∩ S` has between 0 and `min(r, s)`.

## 4. From SQL to a Query Tree

```sql
SELECT s.name
FROM   Student s, Enrollment e, Course c
WHERE  s.sid = e.sid AND e.cid = c.cid
  AND  c.dept = 'CS' AND e.marks > 80;
```

The canonical (naive) translation is

`π_name( σ_{s.sid=e.sid ∧ e.cid=c.cid ∧ c.dept='CS' ∧ e.marks>80} ( (Student × Enrollment) × Course ) )`

As a tree: leaves are the base relations, internal nodes are operators, and the root produces the result. Evaluated literally, this computes the full Cartesian product of three tables first, which is enormous: with 10,000 students, 100,000 enrolments and 500 courses, the product has 5 × 10^11 tuples.

## 5. Heuristic (Rule-Based) Optimization

Algebraic equivalences allow the tree to be rewritten without changing its result. The classic heuristics, applied in order:

1. **Break up conjunctive selections** into a cascade of single-condition selections.
2. **Push selections down** the tree, as close to the leaves as possible, so that rows are filtered before they are joined. `σ_{dept='CS'}` moves onto `Course`; `σ_{marks>80}` moves onto `Enrollment`.
3. **Replace a Cartesian product followed by a join condition with a join:** `σ_{s.sid=e.sid}(S × E)` becomes `S ⋈_{s.sid=e.sid} E`.
4. **Order joins so the most restrictive ones run first,** producing small intermediate results, and avoid joins that would be Cartesian products.
5. **Push projections down,** keeping only the attributes needed by later operators, to shrink tuple width.

Optimized tree:

`π_name( Student ⋈_{sid} ( π_{sid,cid}(σ_{marks>80}(Enrollment)) ⋈_{cid} π_{cid}(σ_{dept='CS'}(Course)) ) )`

### Key equivalence rules

| Rule | Equivalence |
|---|---|
| Selection cascade | `σ_{c1∧c2}(R) ≡ σ_{c1}(σ_{c2}(R))` |
| Selection commutes | `σ_{c1}(σ_{c2}(R)) ≡ σ_{c2}(σ_{c1}(R))` |
| Selection past join | `σ_c(R ⋈ S) ≡ σ_c(R) ⋈ S`, if c uses only attributes of R |
| Join commutativity | `R ⋈ S ≡ S ⋈ R` |
| Join associativity | `(R ⋈ S) ⋈ T ≡ R ⋈ (S ⋈ T)` |
| Selection over union | `σ_c(R ∪ S) ≡ σ_c(R) ∪ σ_c(S)` |

Pushing a selection **through an outer join** is only valid on the preserved side; pushing a condition on the NULL-padded side changes the result.

## 6. Cost-Based Optimization

Heuristics produce a good logical plan; a **cost-based optimizer** then chooses among alternatives (join order, join algorithm, access path such as index scan or full scan) using catalog statistics: number of tuples, number of pages, number of distinct values per column, and histograms.

- **Selectivity** of `A = v` is estimated as `1 / V(A)`, where V(A) is the number of distinct values of A, assuming uniform distribution.
- For n relations there are `(2(n−1))! / (n−1)!` join orders, which grows faster than exponentially. The System R optimizer restricts the search to **left-deep trees** and uses dynamic programming over subsets of relations.
- Cost is measured primarily in **page I/Os**, since disk access dominates CPU time.

Join algorithms and their I/O costs are compared in the companion reference sheet.

## 7. Pitfalls

- Forgetting that π removes duplicates in the algebra but not in SQL.
- Applying a projection before a selection that needs a removed attribute.
- Treating `R − S` as symmetric.
