# Functional Dependencies and Normal Forms

CS-305 Database Management Systems · Unit 2 · Lecture Notes

## 1. Why Normalize?

A poorly designed relation stores the same fact in many rows. This redundancy causes three **anomalies**:

- **Update anomaly:** changing an instructor's office requires updating every row for every course that instructor teaches; missing one leaves the data inconsistent.
- **Insertion anomaly:** a new instructor cannot be recorded until they teach a course with at least one enrolled student.
- **Deletion anomaly:** deleting the last enrolment in a course also deletes the only record of the course's title.

Normalization removes such redundancy by decomposing relations according to their **functional dependencies**.

## 2. Functional Dependencies

For attribute sets X and Y of relation R, the **functional dependency (FD)** `X → Y` holds if any two tuples that agree on X also agree on Y. X is the determinant.

- `X → Y` is **trivial** if Y ⊆ X.
- An FD is a constraint on **all legal instances** of the schema; it cannot be proven from one sample instance, though one instance can disprove it.
- K is a superkey of R exactly when `K → R` (K determines every attribute).

### 2.1 Armstrong's axioms

These three rules are **sound** (they derive only valid FDs) and **complete** (they derive every FD implied by a set F):

1. **Reflexivity:** if Y ⊆ X then `X → Y`.
2. **Augmentation:** if `X → Y` then `XZ → YZ`.
3. **Transitivity:** if `X → Y` and `Y → Z` then `X → Z`.

Derived rules:

- **Union:** `X → Y` and `X → Z` imply `X → YZ`.
- **Decomposition:** `X → YZ` implies `X → Y` and `X → Z`.
- **Pseudotransitivity:** `X → Y` and `WY → Z` imply `WX → Z`.

There is no rule that splits the left side: `AB → C` does **not** imply `A → C`.

### 2.2 Attribute closure

The closure `X+` is the set of all attributes functionally determined by X.

```python
def closure(attrs, fds):
    """fds: list of (lhs_set, rhs_set)."""
    result = set(attrs)
    changed = True
    while changed:
        changed = False
        for lhs, rhs in fds:
            if lhs <= result and not rhs <= result:
                result |= rhs
                changed = True
    return result
```

**Example.** `R(A, B, C, D, E)` with `F = {A → B, B → C, CD → E}`.
`{A}+`: start {A}; A → B adds B; B → C adds C. Result {A, B, C}.
`{A, D}+`: {A, D} → add B → add C → CD → E adds E. Result is all attributes, so **AD is a superkey**. Neither `{A}+` nor `{D}+ = {D}` contains every attribute, so AD is minimal and is a **candidate key**. Since A and D appear on no right-hand side, every key must contain both, so AD is the only candidate key.

Closures are used to test whether an FD `X → Y` is implied by F (check Y ⊆ X+) and to find keys.

A **prime attribute** is one that belongs to some candidate key.

## 3. Normal Forms

| Normal form | Condition (for every non-trivial FD `X → A`, unless stated) | Removes |
|---|---|---|
| 1NF | All attribute values are atomic; no repeating groups | Multivalued cells |
| 2NF | 1NF, and no non-prime attribute depends on a **proper subset** of a candidate key | Partial dependencies |
| 3NF | X is a superkey, **or** A is prime | Transitive dependencies |
| BCNF | X is a superkey | All FD-based redundancy |

Each form implies the previous ones: BCNF ⊂ 3NF ⊂ 2NF ⊂ 1NF. A relation whose candidate keys are all single attributes is automatically in 2NF. Every two-attribute relation is in BCNF.

## 4. Worked Decomposition

Relation:

`Enrol(sid, sname, cid, ctitle, instructor, office, marks)`

FDs:

- `sid → sname`
- `cid → ctitle, instructor`
- `instructor → office`
- `sid, cid → marks`

**Key.** `{sid, cid}+` = {sid, cid, sname, ctitle, instructor, office, marks}, so `{sid, cid}` is the candidate key. Prime attributes: sid, cid.

**2NF check.** `sid → sname` and `cid → ctitle, instructor` are partial dependencies on the key (and `office` depends on `cid` transitively). Not in 2NF. Decompose:

- `Student(sid, sname)`
- `Course(cid, ctitle, instructor, office)`
- `Enrolment(sid, cid, marks)`

**3NF check.** In `Course`, `instructor → office` has a determinant that is not a superkey, and `office` is not prime: a transitive dependency `cid → instructor → office`. Decompose `Course` into:

- `Course(cid, ctitle, instructor)`
- `Instructor(instructor, office)`

**Result.** Four relations, each in BCNF, since in each one every non-trivial FD has a key as its determinant. All four original FDs are enforceable within a single relation, so the decomposition preserves dependencies, and each step split on an FD whose left side is a key of one part, so it is lossless.

## 5. 3NF versus BCNF

BCNF is stricter. A relation can be in 3NF but not in BCNF when a non-superkey determines a prime attribute.

**Example.** `Teach(student, course, instructor)` where each instructor teaches exactly one course, and for each course a student has one instructor:

- `student, course → instructor`
- `instructor → course`

Candidate keys: `{student, course}` and `{student, instructor}`. All three attributes are prime, so the relation is in 3NF. It is **not** in BCNF, because `instructor` is not a superkey. The BCNF decomposition `(instructor, course)` and `(student, instructor)` is lossless, but the FD `student, course → instructor` can no longer be checked inside one relation: **dependency preservation is lost**.

This illustrates the general trade-off:

- A **3NF** decomposition that is both lossless and dependency-preserving **always exists** (synthesis algorithm using a minimal cover).
- A **BCNF** decomposition that is lossless always exists, but it may not preserve dependencies.

## 6. Properties of Decompositions

### 6.1 Lossless join

Decomposing R into R1 and R2 is **lossless** if joining R1 and R2 always reproduces exactly R, with no spurious tuples. Test for a binary decomposition:

`R1 ∩ R2 → R1` or `R1 ∩ R2 → R2` must be in F+

that is, the common attributes must be a superkey of at least one part. Example: splitting `Instructor(instructor, office)` off `Course` is lossless because the common attribute `instructor` is a key of `Instructor`. Splitting `Enrol` into `(sid, sname)` and `(cname, marks)` with no shared attribute would give a Cartesian product: lossy.

### 6.2 Dependency preservation

A decomposition is **dependency-preserving** if the union of the FDs that can be checked within each individual relation implies all of F. Without it, enforcing a constraint requires a join on every update.

## 7. Pitfalls

- Treating "more normalized" as always better: higher normal forms mean more joins, and analytical schemas often denormalize deliberately.
- Concluding an FD holds because it holds in the sample rows.
- Forgetting that 3NF permits a dependency `X → A` when A is prime.
