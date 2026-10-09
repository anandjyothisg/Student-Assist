# The Relational Model and Entity-Relationship Modelling

CS-305 Database Management Systems · Unit 1 · Lecture Notes

## 1. The Relational Model

The relational model, introduced by E. F. Codd in 1970, represents all data as **relations**. Its strength is a clean mathematical foundation: queries are expressed declaratively over sets, and the physical storage is hidden from the user (**physical data independence**).

### 1.1 Core terminology

| Formal term | Informal / SQL term | Meaning |
|---|---|---|
| Relation | Table | A set of tuples sharing the same attributes |
| Tuple | Row / record | One element of the relation |
| Attribute | Column / field | A named property with a domain |
| Domain | Data type | The set of permitted atomic values for an attribute |
| Degree (arity) | Number of columns | Number of attributes |
| Cardinality | Number of rows | Number of tuples |
| Relation schema | Table definition | Name plus attributes, e.g. `Student(sid, name, dept, gpa)` |
| Relation instance | Table contents | The set of tuples at a moment in time |

Because a relation is a **set**:

- Tuples are unordered, and there are no duplicate tuples. (SQL tables are multisets and permit duplicates unless a key is declared; this is a known departure from the pure model.)
- Attributes are unordered in the formal model; they are referenced by name.
- Every attribute value must be **atomic** (indivisible). This requirement is the definition of First Normal Form.

## 2. Keys

Let R be a relation schema and K a set of its attributes.

- **Superkey:** K is a superkey if no two distinct tuples can agree on all attributes of K. The set of all attributes is always a superkey.
- **Candidate key:** a **minimal** superkey; removing any attribute from it destroys uniqueness.
- **Primary key:** the candidate key chosen by the designer to identify tuples. Its attributes may not be NULL (**entity integrity**).
- **Alternate key:** a candidate key not chosen as primary; usually enforced with a `UNIQUE` constraint.
- **Foreign key:** a set of attributes in one relation whose values must match the primary key (or a unique key) of a referenced relation, or be NULL (**referential integrity**).
- **Composite key:** a key with more than one attribute.

### Example

`Student(sid, email, name, dept)` where both `sid` and `email` are unique.

- Superkeys include `{sid}`, `{email}`, `{sid, name}`, `{sid, email, name, dept}`.
- Candidate keys: `{sid}` and `{email}`.
- `{sid, name}` is a superkey but not a candidate key, because `{sid}` alone suffices.
- If `{sid}` is chosen as primary key, `{email}` is an alternate key.

A relation with n attributes and a single-attribute candidate key A has `2^(n−1)` superkeys containing A, since any subset of the remaining n − 1 attributes may be added.

### Referential actions

When a referenced row is deleted or its key updated, SQL foreign keys specify what happens to referencing rows: `RESTRICT`/`NO ACTION` (reject the change), `CASCADE` (propagate the delete or update), `SET NULL`, or `SET DEFAULT`.

```sql
CREATE TABLE Enrollment (
    sid    INT REFERENCES Student(sid) ON DELETE CASCADE,
    cid    VARCHAR(10) REFERENCES Course(cid),
    grade  CHAR(2),
    PRIMARY KEY (sid, cid)
);
```

## 3. Entity-Relationship (ER) Modelling

The ER model (Chen, 1976) is a conceptual design notation used before tables are defined.

- **Entity:** a distinguishable real-world object, e.g. a particular student. An **entity set** is a collection of similar entities, drawn as a rectangle.
- **Attribute:** a property, drawn as an oval. Variants: **composite** (`name` = first + last), **multivalued** (`phone_numbers`, double oval), **derived** (`age` from `date_of_birth`, dashed oval), and **key** attributes (underlined).
- **Relationship:** an association among entities, drawn as a diamond, e.g. `Student — enrols in — Course`. Relationships may have their own attributes (`grade` belongs to the enrolment, not to the student or the course).
- **Weak entity set:** cannot be identified by its own attributes alone; it depends on an **owner** (identifying) entity set. Example: `Dependent` of an `Employee`, identified by `(emp_id, dependent_name)`. Drawn with a double rectangle; its identifying relationship has a double diamond, and its partial key is underlined with a dashed line.

### 3.1 Cardinality and participation

For a binary relationship between A and B, the **cardinality ratio** is one of:

- **One-to-one (1:1):** e.g. `Department — managed by — Professor` (each department has one head; each professor heads at most one department).
- **One-to-many (1:N):** e.g. `Department — offers — Course`.
- **Many-to-many (M:N):** e.g. `Student — enrols in — Course`.

**Participation** is **total** if every entity must take part (double line; e.g. every course must be offered by some department) and **partial** otherwise. In (min, max) notation, total participation corresponds to a minimum of 1.

## 4. Mapping an ER Diagram to Relations

| ER construct | Relational mapping |
|---|---|
| Strong entity set | One table; key attribute becomes the primary key |
| Composite attribute | One column per component (`first_name`, `last_name`) |
| Multivalued attribute | Separate table `(owner_key, value)`, with both as primary key |
| Derived attribute | Usually not stored; computed in a query or view |
| Weak entity set | Table including the owner's primary key as a foreign key; primary key = owner key + partial key |
| 1:1 relationship | Foreign key in either table, preferably on the side with total participation, declared `UNIQUE` |
| 1:N relationship | Foreign key on the **N side** referencing the 1 side |
| M:N relationship | New table holding the foreign keys of both sides (together forming the primary key) plus relationship attributes |

### Worked mapping

ER design: `Department(dept_id, name)`, `Course(cid, title, credits)`, `Student(sid, name)`. Department offers Course (1:N, total on Course). Student enrols in Course (M:N, attribute `grade`).

```sql
CREATE TABLE Department (dept_id INT PRIMARY KEY, name VARCHAR(50) NOT NULL);
CREATE TABLE Course (
    cid      VARCHAR(10) PRIMARY KEY,
    title    VARCHAR(100),
    credits  INT,
    dept_id  INT NOT NULL REFERENCES Department(dept_id)   -- 1:N, total participation
);
CREATE TABLE Student (sid INT PRIMARY KEY, name VARCHAR(50));
CREATE TABLE Enrollment (                                    -- M:N relationship
    sid INT REFERENCES Student(sid),
    cid VARCHAR(10) REFERENCES Course(cid),
    grade CHAR(2),
    PRIMARY KEY (sid, cid)
);
```

The `NOT NULL` on `Course.dept_id` enforces total participation of Course in "offers". Total participation on the "one" side of a 1:N relationship (every department must offer at least one course) cannot be expressed by keys alone and needs a trigger or assertion.

## 5. Pitfalls

- Placing the foreign key for a 1:N relationship on the "one" side, which would require a multivalued column.
- Storing a multivalued attribute as a comma-separated string, which violates atomicity.
- Confusing a candidate key with any unique-looking column: uniqueness must hold for every legal instance, not just current data.
