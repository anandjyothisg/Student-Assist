# SQL Practice: Worked Query Examples

CS-305 Database Management Systems · Unit 1 · Lab Handout

## Lab Objectives

- Write single-table and multi-table queries against a small university schema.
- Use joins, grouping, `HAVING`, correlated and uncorrelated subqueries correctly.
- Predict the exact result of a query, including the effect of NULL values.

Run the setup script in PostgreSQL (or SQLite) before attempting the exercises. Attempt each query yourself before reading the solution.

## 1. Schema and Sample Data

```sql
CREATE TABLE Student (
    sid   INT PRIMARY KEY,
    name  VARCHAR(40) NOT NULL,
    dept  VARCHAR(4),
    year  INT,
    gpa   DECIMAL(3,1)            -- NULL for first-semester students
);
CREATE TABLE Course (
    cid      VARCHAR(6) PRIMARY KEY,
    title    VARCHAR(60),
    dept     VARCHAR(4),
    credits  INT
);
CREATE TABLE Enrollment (
    sid    INT REFERENCES Student(sid),
    cid    VARCHAR(6) REFERENCES Course(cid),
    marks  INT,                    -- NULL while the course is in progress
    PRIMARY KEY (sid, cid)
);
```

**Student**

| sid | name | dept | year | gpa |
|---|---|---|---|---|
| 101 | Priya | CS | 2 | 8.6 |
| 102 | Rahul | CS | 3 | 7.2 |
| 103 | Meera | EE | 2 | 9.1 |
| 104 | Arjun | ME | 1 | 6.8 |
| 105 | Sara | CS | 1 | NULL |

**Course**

| cid | title | dept | credits |
|---|---|---|---|
| CS201 | Data Structures | CS | 4 |
| CS305 | DBMS | CS | 4 |
| CS450 | Machine Learning | CS | 4 |
| EE210 | Signals | EE | 3 |
| MA101 | Calculus | MA | 3 |

**Enrollment**

| sid | cid | marks |
|---|---|---|
| 101 | CS201 | 88 |
| 101 | CS305 | 91 |
| 101 | MA101 | 76 |
| 102 | CS201 | 64 |
| 102 | CS305 | NULL |
| 103 | EE210 | 93 |
| 103 | MA101 | 85 |
| 104 | MA101 | 58 |

## 2. Solved Queries

### Query 1: CS students ordered by GPA, highest first

```sql
SELECT name, gpa
FROM   Student
WHERE  dept = 'CS'
ORDER  BY gpa DESC NULLS LAST;
```

Result: Priya 8.6, Rahul 7.2, Sara NULL.
Note: PostgreSQL treats NULL as larger than every value, so with plain `DESC` Sara would appear **first**. `NULLS LAST` makes the intent explicit. SQL Server and MySQL instead treat NULL as the smallest value.

### Query 2: Names of students enrolled in CS305

```sql
SELECT s.name
FROM   Student s
JOIN   Enrollment e ON e.sid = s.sid
WHERE  e.cid = 'CS305';
```

Result: Priya, Rahul. Rahul is included even though his marks are NULL: the filter is on `cid`, not on `marks`.

### Query 3: Number of students in every course, including empty courses

```sql
SELECT   c.cid, COUNT(e.sid) AS enrolled
FROM     Course c
LEFT JOIN Enrollment e ON e.cid = c.cid
GROUP BY c.cid
ORDER BY c.cid;
```

Result: CS201 2, CS305 2, CS450 0, EE210 1, MA101 3.
Using `COUNT(*)` instead would report **1** for CS450, because the left join produces one NULL-extended row for it. `COUNT(e.sid)` ignores that NULL.

### Query 4: Courses whose average marks are at least 75

```sql
SELECT   cid, AVG(marks) AS avg_marks, COUNT(*) AS rows_, COUNT(marks) AS graded
FROM     Enrollment
GROUP BY cid
HAVING   AVG(marks) >= 75;
```

| cid | avg_marks | rows_ | graded |
|---|---|---|---|
| CS201 | 76.0 | 2 | 2 |
| CS305 | 91.0 | 2 | 1 |
| EE210 | 93.0 | 1 | 1 |

MA101 is excluded because its average is `(76 + 85 + 58) / 3 = 73.0`. For CS305, `AVG` ignores Rahul's NULL, so the average is 91, not 45.5. The condition belongs in `HAVING` because it refers to an aggregate.

### Query 5: Students not enrolled in any course

```sql
SELECT s.sid, s.name
FROM   Student s
WHERE  NOT EXISTS (SELECT 1 FROM Enrollment e WHERE e.sid = s.sid);
```

Result: 105 Sara. An equivalent anti-join is `LEFT JOIN Enrollment e ON ... WHERE e.sid IS NULL`. Prefer `NOT EXISTS` to `NOT IN` whenever the subquery column could contain NULL.

### Query 6: Student(s) with the highest marks in MA101

```sql
SELECT s.name, e.marks
FROM   Student s JOIN Enrollment e ON e.sid = s.sid
WHERE  e.cid = 'MA101'
  AND  e.marks = (SELECT MAX(marks) FROM Enrollment WHERE cid = 'MA101');
```

Result: Meera 85. Unlike `ORDER BY marks DESC LIMIT 1`, this form returns every student tied for the top mark.

### Query 7: Total registered credits per student, including students with none

```sql
SELECT   s.name, COALESCE(SUM(c.credits), 0) AS total_credits
FROM     Student s
LEFT JOIN Enrollment e ON e.sid = s.sid
LEFT JOIN Course c     ON c.cid = e.cid
GROUP BY s.sid, s.name
ORDER BY total_credits DESC;
```

Result: Priya 11, Rahul 8, Meera 6, Arjun 3, Sara 0.
Without `COALESCE`, Sara's total would be NULL, because `SUM` over no non-NULL values returns NULL. Grouping by `s.sid` as well as `s.name` keeps two different students who share a name in separate groups.

### Query 8: Enrollments where the student scored above the course average

```sql
SELECT s.name, e.cid, e.marks
FROM   Enrollment e
JOIN   Student s ON s.sid = e.sid
WHERE  e.marks > (SELECT AVG(e2.marks)
                  FROM   Enrollment e2
                  WHERE  e2.cid = e.cid);
```

Result: (Priya, CS201, 88), (Priya, MA101, 76), (Meera, MA101, 85).
This is a **correlated** subquery: the inner query uses `e.cid` from the outer row. Priya's 91 in CS305 is not included because it equals, rather than exceeds, the course average of 91; Rahul's NULL row is excluded because `NULL > 91` is UNKNOWN.

## 3. Exercises for Submission

1. List each department with the number of students and the average GPA, ignoring students without a GPA.
2. Find the courses in which every enrolled student has received marks (no NULLs).
3. Find students enrolled in at least one course outside their own department.
4. Rewrite Query 5 using `EXCEPT`.

Submit your queries and their outputs as a single `.sql` file before the next lab session.
