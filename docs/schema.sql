-- ============================================================
-- JA LITE DATABASE SCHEMA
-- Target: Supabase Postgres
-- Version: 0.1.0
-- Created: 2026-04-15
-- ============================================================
-- Run this file against your Supabase project via:
--   Supabase Dashboard > SQL Editor > Paste and run
--   OR: psql -h <host> -U postgres -d postgres -f schema.sql
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE project_status      AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE task_status         AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'blocked');
CREATE TYPE contact_type        AS ENUM ('subcontractor', 'supplier', 'employee', 'client', 'other');
CREATE TYPE contact_method      AS ENUM ('sms', 'email', 'phone', 'whatsapp');
CREATE TYPE assignment_role     AS ENUM ('lead', 'support', 'supplier', 'consulted', 'inspector');
CREATE TYPE comm_method         AS ENUM ('sms', 'email', 'phone', 'whatsapp');
CREATE TYPE comm_direction      AS ENUM ('outbound', 'inbound');
CREATE TYPE comm_status         AS ENUM ('pending', 'sent', 'delivered', 'failed', 'cancelled');
CREATE TYPE notification_type   AS ENUM ('reschedule', 'assignment', 'reminder', 'onboarding', 'general');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');
CREATE TYPE onboarding_status   AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE audit_action        AS ENUM (
    'created', 'updated', 'deleted',
    'rescheduled', 'assigned', 'unassigned',
    'notified', 'completed', 'cancelled'
);


-- ============================================================
-- TABLE: project_templates
-- Reusable project blueprints (e.g. "Residential Build", "Commercial Fit-Out")
-- Jeff selects one of these when creating a new project.
-- ============================================================

CREATE TABLE project_templates (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT        NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: project_template_tasks
-- Individual task blueprints within a project template.
-- When a project is created from a template, these become real tasks.
-- sequence_order controls the display/execution order.
-- ============================================================

CREATE TABLE project_template_tasks (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_template_id UUID        NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
    name                TEXT        NOT NULL,
    description         TEXT,
    default_duration_days NUMERIC(5,1) NOT NULL DEFAULT 1.0,
    sequence_order      INTEGER     NOT NULL DEFAULT 0,
    category            TEXT,                           -- e.g. "electrical", "framing", "inspection"
    depends_on_names    TEXT,                           -- comma-separated template task names (Column B)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: projects
-- A live job/project instance.
-- May be created from a template or from scratch.
-- ============================================================

CREATE TABLE projects (
    id          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID            REFERENCES project_templates(id) ON DELETE SET NULL,
    name        TEXT            NOT NULL,
    description TEXT,
    address     TEXT,
    status      project_status  NOT NULL DEFAULT 'planning',
    start_date  DATE,
    end_date    DATE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: tasks
-- A single unit of work within a project.
-- May be created from a template task or manually.
-- ============================================================

CREATE TABLE tasks (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id       UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    template_task_id UUID        REFERENCES project_template_tasks(id) ON DELETE SET NULL,
    name             TEXT        NOT NULL,
    description      TEXT,
    category         TEXT,
    status           task_status NOT NULL DEFAULT 'pending',
    scheduled_start  TIMESTAMPTZ,
    scheduled_end    TIMESTAMPTZ,
    actual_start     TIMESTAMPTZ,
    actual_end       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: task_dependencies
-- Task A cannot start until Task B is complete.
-- Prevents circular dependencies via application logic (not DB constraint).
-- ============================================================

CREATE TABLE task_dependencies (
    id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id            UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT no_self_dependency  CHECK (task_id <> depends_on_task_id),
    CONSTRAINT unique_dependency   UNIQUE (task_id, depends_on_task_id)
);


-- ============================================================
-- TABLE: contacts
-- All people Jeff works with: subcontractors, suppliers, employees, clients.
-- preferred_contact_method drives how Ja sends notifications.
-- ============================================================

CREATE TABLE contacts (
    id                       UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                     TEXT            NOT NULL,
    company                  TEXT,
    contact_type             contact_type    NOT NULL DEFAULT 'other',
    phone                    TEXT,
    email                    TEXT,
    preferred_contact_method contact_method  NOT NULL DEFAULT 'sms',
    notes                    TEXT,
    trade                    TEXT,
    sub_role                 TEXT,
    is_active                BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: task_assignments
-- Links contacts to tasks with a role.
-- One contact per task (unique constraint), but a task can have many contacts.
-- ============================================================

CREATE TABLE task_assignments (
    id         UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id    UUID            NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    contact_id UUID            NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    role       assignment_role NOT NULL DEFAULT 'lead',
    notes      TEXT,
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_task_contact UNIQUE (task_id, contact_id)
);


-- ============================================================
-- TABLE: new_starts
-- Onboarding records for new workers joining a project.
-- Tracks who is starting, on which project, and their onboarding status.
-- ============================================================

CREATE TABLE new_starts (
    id         UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID              NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    project_id UUID              NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    start_date DATE              NOT NULL,
    status     onboarding_status NOT NULL DEFAULT 'pending',
    notes      TEXT,
    created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: communications_log
-- Immutable log of every message sent or received.
-- Records method, direction, body, and delivery status.
-- Tied to a contact; optionally to a task and/or project.
-- ============================================================

CREATE TABLE communications_log (
    id         UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID            NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    task_id    UUID            REFERENCES tasks(id) ON DELETE SET NULL,
    project_id UUID            REFERENCES projects(id) ON DELETE SET NULL,
    method     comm_method     NOT NULL,
    direction  comm_direction  NOT NULL DEFAULT 'outbound',
    subject    TEXT,
    body       TEXT            NOT NULL,
    status     comm_status     NOT NULL DEFAULT 'pending',
    sent_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: notifications
-- Tracks pending and sent notifications (reschedule alerts, reminders, etc.)
-- communication_id links to the actual message once sent.
-- ============================================================

CREATE TABLE notifications (
    id               UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id       UUID                NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    task_id          UUID                REFERENCES tasks(id) ON DELETE SET NULL,
    project_id       UUID                REFERENCES projects(id) ON DELETE SET NULL,
    communication_id UUID                REFERENCES communications_log(id) ON DELETE SET NULL,
    type             notification_type   NOT NULL,
    message          TEXT                NOT NULL,
    status           notification_status NOT NULL DEFAULT 'pending',
    scheduled_for    TIMESTAMPTZ,
    sent_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: audit_log
-- Immutable record of every change to any entity.
-- old_value / new_value stored as JSONB snapshots.
-- changed_by is 'jeff' or 'system' until auth is added.
-- Never delete rows from this table.
-- ============================================================

CREATE TABLE audit_log (
    id          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT            NOT NULL,   -- 'project', 'task', 'contact', 'assignment', etc.
    entity_id   UUID            NOT NULL,
    action      audit_action    NOT NULL,
    changed_by  TEXT            NOT NULL DEFAULT 'jeff',
    old_value   JSONB,
    new_value   JSONB,
    notes       TEXT,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- project_template_tasks
CREATE INDEX idx_ptt_template_id     ON project_template_tasks(project_template_id);

-- projects
CREATE INDEX idx_projects_status      ON projects(status);
CREATE INDEX idx_projects_template_id ON projects(template_id);

-- tasks
CREATE INDEX idx_tasks_project_id       ON tasks(project_id);
CREATE INDEX idx_tasks_status           ON tasks(status);
CREATE INDEX idx_tasks_scheduled_start  ON tasks(scheduled_start);

-- task_dependencies
CREATE INDEX idx_task_dep_task_id       ON task_dependencies(task_id);
CREATE INDEX idx_task_dep_depends_on    ON task_dependencies(depends_on_task_id);

-- task_assignments
CREATE INDEX idx_assignments_task_id    ON task_assignments(task_id);
CREATE INDEX idx_assignments_contact_id ON task_assignments(contact_id);

-- contacts
CREATE INDEX idx_contacts_type          ON contacts(contact_type);
CREATE INDEX idx_contacts_is_active     ON contacts(is_active);

-- new_starts
CREATE INDEX idx_new_starts_contact_id  ON new_starts(contact_id);
CREATE INDEX idx_new_starts_project_id  ON new_starts(project_id);
CREATE INDEX idx_new_starts_start_date  ON new_starts(start_date);

-- communications_log
CREATE INDEX idx_comms_contact_id       ON communications_log(contact_id);
CREATE INDEX idx_comms_task_id          ON communications_log(task_id);
CREATE INDEX idx_comms_project_id       ON communications_log(project_id);
CREATE INDEX idx_comms_status           ON communications_log(status);

-- notifications
CREATE INDEX idx_notif_contact_id       ON notifications(contact_id);
CREATE INDEX idx_notif_status           ON notifications(status);
CREATE INDEX idx_notif_scheduled_for    ON notifications(scheduled_for);

-- audit_log
CREATE INDEX idx_audit_entity           ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created_at       ON audit_log(created_at);


-- ============================================================
-- TRIGGER: auto-update updated_at on row change
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_templates_updated_at
    BEFORE UPDATE ON project_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_project_template_tasks_updated_at
    BEFORE UPDATE ON project_template_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_new_starts_updated_at
    BEFORE UPDATE ON new_starts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
