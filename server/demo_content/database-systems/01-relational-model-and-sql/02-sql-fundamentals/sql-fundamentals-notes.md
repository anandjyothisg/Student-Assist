# SQL Fundamentals

CS-305 Database Management Systems · Unit 1 · Lecture Notes

## 1. Sublanguages of SQL

SQL (Structured Query Language) is a declarative language: a query states *what* result is wanted, and the optimizer decides *how* to compute it.

| Sublanguage | Purpose | Main statements |
|---|---|---|
| DDL (Data Definition) | Define and change schema objects | `CREATE`, `ALTER`, `DROP`, `TRUNCATE` |
| DML (Data Manipulation) | Query and modify rows | `SELECT`, `INSERT`, `UPDATE`, `DELETE` |
| DCL (Data Control) | Permissions | `GRANT`, `REVOKE` |
| TCL (Transaction Control) | Transaction boundaries | `COMMIT`, `ROLLBACK`, `SAVEPOINT` |

`DELETE FROM t` removes rows one by one, can have a `WHERE` clause, fires row triggers and is logged per row. `TRUNCATE TABLE t` removes all rows at once, cannot be filtered, and is typically much faster. `DROP TABLE t` removes the table definition itself.

```sql
CREATE TABLE Employee (
    eid      INT PRIMARY KEY,
    name     VARCHAR(50) NOT NULL,
    salary   DECIMAL(10,2) CHECK (salary >= 0),
    dept_id  INT REFERENCES Department(dept_id)
);
ALTER TABLE Employee ADD COLUMN hire_date DATE;
UPDATE Employee SET salary = salary * 1.05 WHERE dept_id = 10;
```

## 2. The Basic Query Block

```sql
SELECT   [DISTINCT] column_list
FROM     table_list
WHERE    row_condition
GROUP BY grouping_columns
HAVING   group_condition
ORDER BY sort_columns;
```

### Logical order of evaluation

Although written starting with `SELECT`, a query is evaluated logically in this order:

1. `FROM` (and joins): form the combined rows.
2. `WHERE`: filter individual rows.
3. `GROUP BY`: form groups.
4. `HAVING`: filter groups.
5. `SELECT`: compute output columns and aliases.
6. `DISTINCT`: remove duplicates.
7. `ORDER BY`: sort (and then `LIMIT`/`FETCH FIRST`).

This order explains common errors: a column alias defined in `SELECT` cannot be used in `WHERE` (it does not exist yet), but it can be used in `ORDER BY`. An aggregate such as `AVG(salary)` cannot appear in `WHERE`, because groups have not yet been formed; it belongs in `HAVING`.

## 3. Joins

Example tables:

**Employee**

| eid | name | dept_id |
|---|---|---|
| 1 | Asha | 10 |
| 2 | Bilal | 20 |
| 3 | Chen | NULL |

**Department**

| dept_id | dname |
|---|---|
| 10 | Sales |
| 20 | Research |
| 30 | Legal |

```sql
SELECT e.name, d.dname
FROM Employee e
LEFT JOIN Department d ON e.dept_id = d.dept_id;
```

| Join type | Rows kept | Result for the example |
|---|---|---|
| `INNER JOIN` | Only matching pairs | (Asha, Sales), (Bilal, Research): 2 rows |
| `LEFT [OUTER] JOIN` | All employees; NULLs where no department matches | Inner rows + (Chen, NULL): 3 rows |
| `RIGHT [OUTER] JOIN` | All departments; NULLs where no employee matches | Inner rows + (NULL, Legal): 3 rows |
| `FULL [OUTER] JOIN` | All rows from both sides | Inner rows + (Chen, NULL) + (NULL, Legal): 4 rows |
| `CROSS JOIN` | Cartesian product | 3 × 3 = 9 rows |

Chen does not match any department even though Chen's `dept_id` is NULL, because `NULL = 10` is not true. Other variants:

- **Natural join** joins on all identically named columns and keeps one copy of each; it is fragile because adding a same-named column silently changes the join condition.
- **Self join** joins a table to itself using aliases, e.g. employees with their managers.
- A condition on the right-hand table placed in `WHERE` after a `LEFT JOIN` (e.g. `WHERE d.dname = 'Sales'`) discards the NULL-extended rows and effectively turns the outer join into an inner join. Put such conditions in the `ON` clause to keep unmatched left rows.

## 4. Aggregation, GROUP BY and HAVING

Aggregate functions: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`.

```sql
SELECT   dept_id, COUNT(*) AS headcount, AVG(salary) AS avg_sal
FROM     Employee
WHERE    salary > 30000          -- filters rows before grouping
GROUP BY dept_id
HAVING   COUNT(*) >= 5           -- filters groups after aggregation
ORDER BY avg_sal DESC;
```

Rule: every non-aggregated column in the `SELECT` list must appear in `GROUP BY` (standard SQL; some systems relax this when the column is functionally dependent on the grouping columns).

## 5. NULL Semantics

NULL represents a missing or inapplicable value. SQL uses **three-valued logic**: TRUE, FALSE and UNKNOWN.

- Any arithmetic with NULL yields NULL: `5 + NULL` is NULL.
- Any comparison with NULL yields UNKNOWN, including `NULL = NULL`. Use `IS NULL` / `IS NOT NULL`.
- `WHERE` and `HAVING` keep only rows whose condition is TRUE; UNKNOWN rows are discarded.
- `TRUE OR UNKNOWN = TRUE`; `FALSE AND UNKNOWN = FALSE`; `NOT UNKNOWN = UNKNOWN`.
- `COUNT(*)` counts all rows; `COUNT(col)` counts non-NULL values; `SUM`, `AVG`, `MIN`, `MAX` ignore NULLs. Hence `AVG(col)` may differ from `SUM(col) / COUNT(*)`.
- On an empty input, `COUNT` returns 0 while `SUM` and `AVG` return NULL.
- `GROUP BY` places all NULLs in a single group; `DISTINCT` treats NULLs as duplicates of each other.
- `COALESCE(x, 0)` returns the first non-NULL argument.

## 6. Subqueries

- **Scalar subquery:** returns one value, usable wherever an expression is allowed.
- **IN / NOT IN:** membership in the subquery result.
- **EXISTS / NOT EXISTS:** true if the subquery returns at least one row.
- **Correlated subquery:** references a column of the outer query and is logically re-evaluated for each outer row.
- **ANY / ALL:** `salary > ALL (SELECT ...)` means greater than every value.

```sql
-- Employees earning more than their department's average (correlated)
SELECT e.name
FROM   Employee e
WHERE  e.salary > (SELECT AVG(e2.salary)
                   FROM Employee e2
                   WHERE e2.dept_id = e.dept_id);
```

### The NOT IN pitfall

If the subquery of `NOT IN` returns any NULL, the predicate can never be TRUE, so the query returns **no rows**. For example, `x NOT IN (1, NULL)` expands to `x <> 1 AND x <> NULL`, which is at best UNKNOWN. `NOT EXISTS` does not have this problem and is the safer choice.

## 7. Set Operations

`UNION`, `INTERSECT` and `EXCEPT` (`MINUS` in Oracle) require union-compatible operands (same number of columns with compatible types) and remove duplicates by default. `UNION ALL` keeps duplicates and avoids a sort or hash step, so it is faster when duplicates are impossible or acceptable.
