# Module 1 — Validation Guide
# Database Schema (Supabase Postgres)
# Version: 0.1.0 | Date: 2026-04-15

---

## SECTION 1 — Supabase Setup

### Step 1.1 — Create a Supabase account (skip if you already have one)
1. Open your browser and go to: https://supabase.com
2. Click **Start your project**
3. Sign up with GitHub or email
4. Confirm your email if prompted

### Step 1.2 — Create a new project
1. From the Supabase dashboard, click **New project**
2. Fill in:
   - **Name:** `ja-lite` (or any name you prefer)
   - **Database Password:** Choose a strong password and SAVE IT somewhere safe
   - **Region:** Pick the closest region to you
3. Click **Create new project**
4. Wait 1–2 minutes for provisioning. The dashboard will show a spinner.
5. When complete, you will land on the project overview screen.

### Step 1.3 — Find the SQL Editor
1. In the left sidebar, click **SQL Editor** (looks like a code icon `</>`)
2. You will see a blank query area
3. This is where you will paste and run all SQL in this guide

---

## SECTION 2 — Applying schema.sql

### Step 2.1 — Open the schema file
1. On your computer, open the file:
   `E:\Catha\Ja_Lite\docs\schema.sql`
2. Open it in any text editor (Notepad, VS Code, etc.)
3. Press **Ctrl+A** to select all text
4. Press **Ctrl+C** to copy

### Step 2.2 — Paste into Supabase SQL Editor
1. Click inside the Supabase SQL Editor query area
2. Press **Ctrl+A** to clear any existing content
3. Press **Ctrl+V** to paste the schema

### Step 2.3 — Run the schema
1. Click the green **Run** button (top right of the SQL Editor)
   OR press **Ctrl+Enter**
2. Wait for the query to finish
3. Look at the bottom panel — you should see:
   ```
   Success. No rows returned.
   ```
4. If you see any red error text, STOP and go to Section 8.

---

## SECTION 3 — Tables That Should Appear

### Step 3.1 — Verify in Table Editor
1. In the left sidebar, click **Table Editor**
2. You should see the following tables listed (scroll down if needed):

   | Table Name | Should Exist? |
   |---|---|
   | `project_templates` | YES |
   | `project_template_tasks` | YES |
   | `projects` | YES |
   | `tasks` | YES |
   | `task_dependencies` | YES |
   | `contacts` | YES |
   | `task_assignments` | YES |
   | `new_starts` | YES |
   | `communications_log` | YES |
   | `notifications` | YES |
   | `audit_log` | YES |

   **Total: 11 tables**

3. If any table is missing, go to Section 8.

### Step 3.2 — Verify table columns (spot check)
Click on the `contacts` table in Table Editor. You should see these columns:
- `id`
- `name`
- `company`
- `contact_type`
- `phone`
- `email`
- `preferred_contact_method`
- `notes`
- `is_active`
- `created_at`
- `updated_at`

---

## SECTION 4 — Relationships to Verify

Go to **Database > Tables** in the Supabase sidebar (under the Database section, not Table Editor).

### Step 4.1 — Check foreign keys via SQL
In the SQL Editor, paste and run this query:

```sql
SELECT
    tc.table_name AS "from_table",
    kcu.column_name AS "from_column",
    ccu.table_name AS "to_table",
    ccu.column_name AS "to_column"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

You should see these relationships returned:

| from_table | from_column | to_table | to_column |
|---|---|---|---|
| `communications_log` | `contact_id` | `contacts` | `id` |
| `communications_log` | `project_id` | `projects` | `id` |
| `communications_log` | `task_id` | `tasks` | `id` |
| `new_starts` | `contact_id` | `contacts` | `id` |
| `new_starts` | `project_id` | `projects` | `id` |
| `notifications` | `communication_id` | `communications_log` | `id` |
| `notifications` | `contact_id` | `contacts` | `id` |
| `notifications` | `project_id` | `projects` | `id` |
| `notifications` | `task_id` | `tasks` | `id` |
| `project_template_tasks` | `project_template_id` | `project_templates` | `id` |
| `projects` | `template_id` | `project_templates` | `id` |
| `task_assignments` | `contact_id` | `contacts` | `id` |
| `task_assignments` | `task_id` | `tasks` | `id` |
| `task_dependencies` | `depends_on_task_id` | `tasks` | `id` |
| `task_dependencies` | `task_id` | `tasks` | `id` |
| `tasks` | `project_id` | `projects` | `id` |
| `tasks` | `template_task_id` | `project_template_tasks` | `id` |

If any relationship is missing, go to Section 8.

---

## SECTION 5 — Sample Inserts to Test

Run these one at a time, in order. Each block depends on the one before it.
Paste each block into the SQL Editor and press **Run** (Ctrl+Enter).

---

### Test 1 — Insert a project template
```sql
INSERT INTO project_templates (name, description)
VALUES ('Residential Build', 'Standard new home construction project');
```
**Expected result:** `Success. 1 row affected.`

---

### Test 2 — Insert a template task
```sql
INSERT INTO project_template_tasks (
    project_template_id,
    name,
    default_duration_days,
    sequence_order,
    category
)
VALUES (
    (SELECT id FROM project_templates WHERE name = 'Residential Build'),
    'Pour Foundation',
    3,
    1,
    'concrete'
);
```
**Expected result:** `Success. 1 row affected.`

---

### Test 3 — Insert a project linked to that template
```sql
INSERT INTO projects (template_id, name, address, status, start_date)
VALUES (
    (SELECT id FROM project_templates WHERE name = 'Residential Build'),
    'Smith Residence',
    '12 Oak Street, Suburb',
    'planning',
    '2026-05-01'
);
```
**Expected result:** `Success. 1 row affected.`

---

### Test 4 — Insert a contact
```sql
INSERT INTO contacts (
    name,
    company,
    contact_type,
    phone,
    email,
    preferred_contact_method
)
VALUES (
    'Bob Crane',
    'Crane Electrical Pty Ltd',
    'subcontractor',
    '0400000000',
    'bob@craneelectrical.com.au',
    'sms'
);
```
**Expected result:** `Success. 1 row affected.`

---

### Test 5 — Insert a task on the project
```sql
INSERT INTO tasks (
    project_id,
    name,
    status,
    scheduled_start,
    scheduled_end
)
VALUES (
    (SELECT id FROM projects WHERE name = 'Smith Residence'),
    'Pour Foundation',
    'pending',
    '2026-05-02 07:00:00+10',
    '2026-05-04 17:00:00+10'
);
```
**Expected result:** `Success. 1 row affected.`

---

### Test 6 — Assign the contact to the task
```sql
INSERT INTO task_assignments (task_id, contact_id, role)
VALUES (
    (SELECT id FROM tasks WHERE name = 'Pour Foundation'),
    (SELECT id FROM contacts WHERE name = 'Bob Crane'),
    'lead'
);
```
**Expected result:** `Success. 1 row affected.`

---

### Test 7 — Test the duplicate assignment block (unique constraint)
```sql
INSERT INTO task_assignments (task_id, contact_id, role)
VALUES (
    (SELECT id FROM tasks WHERE name = 'Pour Foundation'),
    (SELECT id FROM contacts WHERE name = 'Bob Crane'),
    'support'
);
```
**Expected result:** An ERROR like:
```
duplicate key value violates unique constraint "unique_task_contact"
```
This is correct. The constraint is working.

---

### Test 8 — Test the updated_at trigger
```sql
-- First, note the current updated_at
SELECT name, updated_at FROM projects WHERE name = 'Smith Residence';

-- Now update the project
UPDATE projects SET name = 'Smith Residence (Stage 1)' WHERE name = 'Smith Residence';

-- Check that updated_at has changed
SELECT name, updated_at FROM projects WHERE name = 'Smith Residence (Stage 1)';
```
**Expected result:** The `updated_at` value in the second SELECT is later than in the first.

---

### Test 9 — Write an audit log entry
```sql
INSERT INTO audit_log (
    entity_type,
    entity_id,
    action,
    changed_by,
    old_value,
    new_value,
    notes
)
VALUES (
    'project',
    (SELECT id FROM projects WHERE name = 'Smith Residence (Stage 1)'),
    'updated',
    'jeff',
    '{"name": "Smith Residence"}',
    '{"name": "Smith Residence (Stage 1)"}',
    'Renamed to reflect stage breakdown'
);
```
**Expected result:** `Success. 1 row affected.`

---

### Test 10 — Read the audit log back
```sql
SELECT entity_type, action, changed_by, old_value, new_value, created_at
FROM audit_log
ORDER BY created_at DESC
LIMIT 5;
```
**Expected result:** You see your Test 9 entry as the most recent row.

---

## SECTION 6 — What Success Looks Like

After running all tests, run this summary query:

```sql
SELECT
    'project_templates'     AS table_name, COUNT(*) AS row_count FROM project_templates
UNION ALL SELECT 'project_template_tasks', COUNT(*) FROM project_template_tasks
UNION ALL SELECT 'projects',               COUNT(*) FROM projects
UNION ALL SELECT 'tasks',                  COUNT(*) FROM tasks
UNION ALL SELECT 'contacts',               COUNT(*) FROM contacts
UNION ALL SELECT 'task_assignments',       COUNT(*) FROM task_assignments
UNION ALL SELECT 'audit_log',              COUNT(*) FROM audit_log;
```

**Expected output:**

| table_name | row_count |
|---|---|
| `project_templates` | 1 |
| `project_template_tasks` | 1 |
| `projects` | 1 |
| `tasks` | 1 |
| `contacts` | 1 |
| `task_assignments` | 1 |
| `audit_log` | 1 |

If you see these counts, **Module 1 is complete and validated.**

---

## SECTION 7 — Common Failures and What They Mean

| Error message | What it means | What to do |
|---|---|---|
| `type "project_status" already exists` | Schema was already run once | Go to Section 8, rollback, then re-run |
| `relation "projects" already exists` | Same as above | Rollback and re-run |
| `extension "uuid-ossp" does not exist` | Extension not enabled | Rare in Supabase — try running `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` alone first |
| `syntax error at or near ...` | Paste was cut off or corrupted | Re-copy the full schema.sql file and paste again |
| `foreign key violation` | INSERT order was wrong | Run inserts in the order shown in Section 5 |
| `duplicate key value violates unique constraint` | You ran an insert twice | Safe to ignore if it was Test 7 (intentional). Otherwise, check for duplicate data. |
| `null value in column violates not-null constraint` | A required field was missing | Check the insert matches the required fields in Section 5 |
| `permission denied` | Row-level security is blocking you | In Supabase: go to Authentication > Policies, or run queries as the `postgres` role |

---

## SECTION 8 — If schema.sql Fails

### Step 8.1 — Read the error carefully
- The Supabase SQL Editor shows the error in red at the bottom of the screen
- Note the **line number** if shown
- Note the **exact error text**

### Step 8.2 — Run the rollback script
If the schema partially applied and you need a clean slate, paste and run this entire block:

```sql
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS communications_log CASCADE;
DROP TABLE IF EXISTS new_starts CASCADE;
DROP TABLE IF EXISTS task_assignments CASCADE;
DROP TABLE IF EXISTS task_dependencies CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS project_template_tasks CASCADE;
DROP TABLE IF EXISTS project_templates CASCADE;

DROP FUNCTION IF EXISTS update_updated_at CASCADE;

DROP TYPE IF EXISTS audit_action CASCADE;
DROP TYPE IF EXISTS onboarding_status CASCADE;
DROP TYPE IF EXISTS notification_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS comm_status CASCADE;
DROP TYPE IF EXISTS comm_direction CASCADE;
DROP TYPE IF EXISTS comm_method CASCADE;
DROP TYPE IF EXISTS assignment_role CASCADE;
DROP TYPE IF EXISTS contact_method CASCADE;
DROP TYPE IF EXISTS contact_type CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
```

**Expected result:** `Success. No rows returned.`

### Step 8.3 — Re-run the schema
After rollback succeeds, go back to Section 2 and re-apply schema.sql from scratch.

### Step 8.4 — Still failing?
Copy the exact error text and share it. Do not guess or modify schema.sql without guidance.
