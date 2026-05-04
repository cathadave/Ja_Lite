-- ============================================================
-- JA LITE BACKFILL: TASK ASSIGNMENTS
-- docs/ja_lite_backfill_assignments.sql
-- Version: 1.0  |  2026-05-03
--
-- PURPOSE:
--   Inserts task_assignments for all existing seeded projects.
--   Use this when projects, tasks, and contacts exist in Supabase
--   but task_assignments is empty (e.g. after a failed wipe+seed).
--
-- SAFE TO RUN MORE THAN ONCE:
--   ON CONFLICT DO NOTHING targets the unique_task_contact
--   constraint (task_id, contact_id). Existing rows are skipped.
--
-- LIMIT 1 on every contact lookup:
--   Prevents TOO_MANY_ROWS errors if contacts were duplicated by
--   a seed run that ran without a prior successful wipe.
--
-- CONTACT-TO-TASK MAPPING:
--   Identical to Step 7 of ja_lite_final_demo_seed.sql.
--   34 assignments per project x 20 projects = 680 total rows.
--
-- DOES NOT MODIFY:
--   Schema, projects, tasks, contacts, task_dependencies,
--   or any other table.
-- ============================================================


DO $$
DECLARE
    v_proj_id  UUID;
    v_task_id  UUID;
    j          INT;

    -- Contact ID cache — LIMIT 1 guards against duplicate names
    v_brad    UUID; v_tony   UUID; v_logan  UUID; v_derek  UUID;
    v_mike    UUID; v_carlos UUID; v_eric   UUID; v_luke   UUID;
    v_nathan  UUID; v_jack   UUID; v_owen   UUID; v_ryan   UUID;
    v_tyler   UUID; v_noah   UUID; v_connor UUID; v_jordan UUID;
    v_oliver  UUID; v_dylan  UUID;
BEGIN

    -- --------------------------------------------------------
    -- Load contact IDs once.
    -- LIMIT 1 prevents TOO_MANY_ROWS if contacts table has
    -- duplicates from a seed that ran without a prior wipe.
    -- --------------------------------------------------------
    SELECT id INTO v_brad   FROM contacts WHERE name = 'Brad Miller'   LIMIT 1;
    SELECT id INTO v_tony   FROM contacts WHERE name = 'Tony Alvarez'  LIMIT 1;
    SELECT id INTO v_logan  FROM contacts WHERE name = 'Logan Price'   LIMIT 1;
    SELECT id INTO v_derek  FROM contacts WHERE name = 'Derek Shaw'    LIMIT 1;
    SELECT id INTO v_mike   FROM contacts WHERE name = 'Mike Turner'   LIMIT 1;
    SELECT id INTO v_carlos FROM contacts WHERE name = 'Carlos Vega'   LIMIT 1;
    SELECT id INTO v_eric   FROM contacts WHERE name = 'Eric Nolan'    LIMIT 1;
    SELECT id INTO v_luke   FROM contacts WHERE name = 'Luke Foster'   LIMIT 1;
    SELECT id INTO v_nathan FROM contacts WHERE name = 'Nathan Doyle'  LIMIT 1;
    SELECT id INTO v_jack   FROM contacts WHERE name = 'Jack Carter'   LIMIT 1;
    SELECT id INTO v_owen   FROM contacts WHERE name = 'Owen Price'    LIMIT 1;
    SELECT id INTO v_ryan   FROM contacts WHERE name = 'Ryan Scott'    LIMIT 1;
    SELECT id INTO v_tyler  FROM contacts WHERE name = 'Tyler Brooks'  LIMIT 1;
    SELECT id INTO v_noah   FROM contacts WHERE name = 'Noah Bennett'  LIMIT 1;
    SELECT id INTO v_connor FROM contacts WHERE name = 'Connor Wells'  LIMIT 1;
    SELECT id INTO v_jordan FROM contacts WHERE name = 'Jordan Bell'   LIMIT 1;
    SELECT id INTO v_oliver FROM contacts WHERE name = 'Oliver White'  LIMIT 1;
    SELECT id INTO v_dylan  FROM contacts WHERE name = 'Dylan Ward'    LIMIT 1;

    -- --------------------------------------------------------
    -- Pre-flight: abort with a clear message if any required
    -- contact is missing. Prevents silent FK errors downstream.
    -- --------------------------------------------------------
    IF  v_brad   IS NULL OR v_tony   IS NULL OR v_logan  IS NULL OR v_derek  IS NULL
     OR v_mike   IS NULL OR v_carlos IS NULL OR v_eric   IS NULL OR v_luke   IS NULL
     OR v_nathan IS NULL OR v_jack   IS NULL OR v_owen   IS NULL OR v_ryan   IS NULL
     OR v_tyler  IS NULL OR v_noah   IS NULL OR v_connor IS NULL OR v_jordan IS NULL
     OR v_oliver IS NULL OR v_dylan  IS NULL
    THEN
        RAISE EXCEPTION
            'Backfill aborted: one or more required subcontractor contacts not found. '
            'Ensure ja_lite_final_demo_seed.sql Step 3 has been run successfully first.';
    END IF;

    -- --------------------------------------------------------
    -- Insert assignments for every project x 26 task sequences.
    -- Mapping is identical to Step 7 of ja_lite_final_demo_seed.sql.
    -- --------------------------------------------------------
    FOR v_proj_id IN SELECT id FROM projects LOOP
        FOR j IN 1..26 LOOP

            -- Resolve the task ID for this project + sequence position
            SELECT t.id INTO v_task_id
            FROM   tasks t
            JOIN   project_template_tasks ptt ON ptt.id = t.template_task_id
            WHERE  t.project_id       = v_proj_id
              AND  ptt.sequence_order = j;

            -- Skip if no task found at this sequence (non-template projects, etc.)
            IF v_task_id IS NULL THEN CONTINUE; END IF;

            CASE j
                WHEN 1 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_derek, 'lead'::assignment_role),
                        (v_task_id, v_brad,  'support'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 2 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_brad, 'lead'::assignment_role),
                        (v_task_id, v_tony, 'support'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 3 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_brad,  'lead'::assignment_role),
                        (v_task_id, v_logan, 'support'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 4 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_brad,  'lead'::assignment_role),
                        (v_task_id, v_derek, 'support'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 5 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_mike, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 6 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_ryan, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 7 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_tyler, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 8 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_derek, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 9 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_mike, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 10 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_carlos, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 11 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_carlos, 'lead'::assignment_role),
                        (v_task_id, v_eric,   'support'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 12 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_luke, 'supplier'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 13 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_nathan, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 14 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_derek, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 15 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_jack, 'lead'::assignment_role),
                        (v_task_id, v_owen, 'support'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 16 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_ryan, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 17 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_tyler, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 18 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_noah, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 19 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_connor, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 20 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_derek, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 21 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_jordan, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 22 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_derek, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 23 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_oliver, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 24 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_dylan, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 25 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_ryan,  'lead'::assignment_role),
                        (v_task_id, v_tyler, 'support'::assignment_role),
                        (v_task_id, v_noah,  'support'::assignment_role)
                    ON CONFLICT DO NOTHING;

                WHEN 26 THEN
                    INSERT INTO task_assignments (task_id, contact_id, role) VALUES
                        (v_task_id, v_derek, 'lead'::assignment_role)
                    ON CONFLICT DO NOTHING;

                ELSE NULL;
            END CASE;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'task_assignments backfill complete.';
END $$;


-- ============================================================
-- VERIFICATION
-- Run each query separately in Supabase SQL Editor after the
-- DO block above completes without error.
-- ============================================================

-- 1. Total row count — expect 680 for a clean 20-project seed.
--    Higher is acceptable if extra projects exist.
-- SELECT COUNT(*) AS total_assignments FROM task_assignments;

-- 2. No NULL contact_id rows — expect 0.
-- SELECT COUNT(*) AS null_contact_assignments
-- FROM task_assignments
-- WHERE contact_id IS NULL;

-- 3. Per-project assignment count — expect exactly 34 for each seeded project.
-- SELECT p.name AS project, COUNT(ta.id) AS assignments
-- FROM projects p
-- JOIN tasks t ON t.project_id = p.id
-- JOIN task_assignments ta ON ta.task_id = t.id
-- GROUP BY p.name
-- ORDER BY p.name;

-- 4. Tasks with zero assignments — expect 0 rows for any seeded project.
--    Any rows returned here indicate a gap.
-- SELECT p.name AS project, ptt.sequence_order AS seq, t.name AS task
-- FROM tasks t
-- JOIN projects p ON p.id = t.project_id
-- JOIN project_template_tasks ptt ON ptt.id = t.template_task_id
-- LEFT JOIN task_assignments ta ON ta.task_id = t.id
-- WHERE ta.id IS NULL
-- ORDER BY p.name, ptt.sequence_order;

-- 5. Contact assignment coverage — each listed subcontractor should appear.
-- SELECT c.name, COUNT(ta.id) AS assignments
-- FROM contacts c
-- JOIN task_assignments ta ON ta.contact_id = c.id
-- GROUP BY c.name
-- ORDER BY assignments DESC;
