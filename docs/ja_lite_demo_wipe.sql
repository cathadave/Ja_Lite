-- ============================================================
-- JA LITE DEMO WIPE
-- docs/ja_lite_demo_wipe.sql
-- Version: 1.0  |  2026-04-25
--
-- PURPOSE: Safely remove all data before reseeding.
-- RUN THIS FIRST, then run ja_lite_final_demo_seed.sql.
--
-- Does NOT drop tables, enums, indexes, or triggers.
-- Safe to run repeatedly.
-- ============================================================

-- execution_logs: not in schema.sql but may exist in Supabase
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'execution_logs'
    ) THEN
        EXECUTE 'DELETE FROM execution_logs';
    END IF;
END $$;

-- Delete in FK-safe order (children before parents)
DELETE FROM audit_log;
DELETE FROM communications_log;
DELETE FROM notifications;
DELETE FROM new_starts;
DELETE FROM task_assignments;
DELETE FROM task_dependencies;
DELETE FROM tasks;
DELETE FROM projects;
DELETE FROM contacts;
DELETE FROM project_template_tasks;
DELETE FROM project_templates;

-- ============================================================
-- Verification (uncomment to confirm zero rows after wipe)
-- ============================================================
-- SELECT 'audit_log'               AS tbl, COUNT(*) FROM audit_log
-- UNION ALL SELECT 'communications_log',   COUNT(*) FROM communications_log
-- UNION ALL SELECT 'notifications',         COUNT(*) FROM notifications
-- UNION ALL SELECT 'new_starts',            COUNT(*) FROM new_starts
-- UNION ALL SELECT 'task_assignments',      COUNT(*) FROM task_assignments
-- UNION ALL SELECT 'task_dependencies',     COUNT(*) FROM task_dependencies
-- UNION ALL SELECT 'tasks',                 COUNT(*) FROM tasks
-- UNION ALL SELECT 'projects',              COUNT(*) FROM projects
-- UNION ALL SELECT 'contacts',              COUNT(*) FROM contacts
-- UNION ALL SELECT 'project_template_tasks',COUNT(*) FROM project_template_tasks
-- UNION ALL SELECT 'project_templates',     COUNT(*) FROM project_templates;
