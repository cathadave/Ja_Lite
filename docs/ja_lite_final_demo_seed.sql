-- ============================================================
-- JA LITE FINAL DEMO SEED
-- docs/ja_lite_final_demo_seed.sql
-- Version: 1.0  |  2026-04-25
--
-- Run AFTER docs/ja_lite_demo_wipe.sql
-- Target: Supabase Postgres
--
-- Project mix (20 total):
--   Phase A:  3 fresh starts   — planning, task 1 in_progress
--   Phase B:  6 through slab   — active,   tasks 1-9 done, task 10 in_progress
--   Phase C:  5 through framing — active,  tasks 1-13 done, task 14 in_progress
--   Phase D:  4 through cabinets — active, tasks 1-23 done, task 24 in_progress
--   Phase E:  2 fully complete  — completed, all 26 tasks done
--
-- Expected row counts:
--   project_templates:      1
--   project_template_tasks: 26
--   contacts:               43
--   projects:               20
--   tasks:                 520  (26 x 20)
--   task_dependencies:     500  (25 x 20)
--   task_assignments:      680  (34 x 20)
-- ============================================================


-- ============================================================
-- STEP 1: PROJECT TEMPLATE
-- ============================================================

INSERT INTO project_templates (name, description)
VALUES (
    'Residential Build',
    'Standard 26-phase Florida residential new construction workflow. North Port / Port Charlotte market.'
);


-- ============================================================
-- STEP 2: TEMPLATE TASKS (26)
-- Durations match mvp_seed.sql. Sequence order is authoritative.
-- ============================================================

DO $$
DECLARE
    v_tid UUID;
BEGIN
    SELECT id INTO v_tid FROM project_templates WHERE name = 'Residential Build';

    INSERT INTO project_template_tasks
        (project_template_id, name, description, default_duration_days, sequence_order, category)
    VALUES
        (v_tid, 'Permit Release & Survey Stake Lot',
         'Permit released, lot staked, and initial survey control set for field start.',
         1, 1, 'preconstruction'),

        (v_tid, 'Site Clearing & Stormwater Controls',
         'Clear lot, root rake, and install silt fence and stormwater protection.',
         2, 2, 'sitework'),

        (v_tid, 'Construction Entrance & Temp Culvert',
         'Install stabilized construction entrance and temporary culvert access.',
         1, 3, 'sitework'),

        (v_tid, 'Pad Build, Compaction & Survey Hub',
         'Build pad, compact fill, verify compaction, and reset survey hub and tack points.',
         2, 4, 'sitework'),

        (v_tid, 'Footings / Slab Prep',
         'Prepare footing and slab layout, formwork, and pre-pour slab package.',
         3, 5, 'concrete'),

        (v_tid, 'Underground Plumbing',
         'Install underground plumbing prior to slab and utility inspections.',
         2, 6, 'plumbing'),

        (v_tid, 'Underground Electrical / Ufer',
         'Install underground electrical components and Ufer grounding where required.',
         2, 7, 'electrical'),

        (v_tid, 'Inspection - Slab',
         'Slab-stage inspection milestone including mono/slab and related pre-pour checks.',
         1, 8, 'inspection'),

        (v_tid, 'Pour Monolithic Slab',
         'Pour monolithic slab and complete immediate slab-stage curing and protection activities.',
         1, 9, 'concrete'),

        (v_tid, 'Block Walls & Openings',
         'Lay block walls and frame required openings for shell progression.',
         4, 10, 'masonry'),

        (v_tid, 'Tie Beam, Rebar & Beam Pour',
         'Install tie beam steel, lintels, beam prep, and complete beam pour.',
         3, 11, 'masonry'),

        (v_tid, 'Framing Materials Delivery',
         'Deliver trusses, framing package, and sheathing materials to site.',
         1, 12, 'logistics'),

        (v_tid, 'Framing & Roof Sheathing',
         'Frame structure and install roof and wall sheathing for shell progression.',
         5, 13, 'framing'),

        (v_tid, 'Inspection - Sheathing / Roof Sheathing',
         'Inspection milestone for framing shell, wall sheathing, and roof sheathing readiness.',
         1, 14, 'inspection'),

        (v_tid, 'Dry-In (Roof, Windows, Doors)',
         'Achieve dry-in with roofing, windows, and exterior doors installed.',
         4, 15, 'envelope'),

        (v_tid, 'Rough Plumbing',
         'Complete rough plumbing above slab and in-wall phase.',
         3, 16, 'plumbing'),

        (v_tid, 'Rough Electrical',
         'Complete rough electrical wiring and device boxes.',
         3, 17, 'electrical'),

        (v_tid, 'Rough HVAC',
         'Complete HVAC rough-in and related mechanical rough phase.',
         3, 18, 'mechanical'),

        (v_tid, 'Septic / Utility / Well Prep',
         'Complete septic, utility, or well-related prep required before close-in and finals.',
         2, 19, 'utilities'),

        (v_tid, 'Inspection - MEP & Framing',
         'Combined milestone for framing and MEP rough inspection readiness.',
         1, 20, 'inspection'),

        (v_tid, 'Insulation Install',
         'Install insulation package after approved roughs.',
         2, 21, 'insulation'),

        (v_tid, 'Inspection - Insulation',
         'Inspection milestone for insulation stage and close-in readiness.',
         1, 22, 'inspection'),

        (v_tid, 'Exterior Finish (Stucco / Siding / Soffit)',
         'Complete exterior finish package including stucco, siding, soffit, and related trim.',
         4, 23, 'exterior'),

        (v_tid, 'Interior Finish (Trim, Cabinets, Flooring, Paint)',
         'Complete interior trim, cabinets, flooring, and paint progression.',
         6, 24, 'finishes'),

        (v_tid, 'Final MEP Install & Finals',
         'Complete final plumbing, electrical, HVAC trim-out, and trade finals readiness.',
         3, 25, 'finals'),

        (v_tid, 'Inspection - CO / Public Works Final / Handover',
         'Final inspection milestone including public works closeout, CO, and customer handover readiness.',
         1, 26, 'handover');
END $$;


-- ============================================================
-- STEP 3: CONTACTS (43 total)
-- 18 subcontractors, 5 employees, 20 clients
-- 555-XXXX numbers and .demo emails — safe for demo use
-- ============================================================

-- Subcontractors
INSERT INTO contacts
    (name, company, contact_type, phone, email, preferred_contact_method, notes, is_active)
VALUES
    ('Brad Miller',   'Miller Site Prep LLC',             'subcontractor'::contact_type, '+19415550101', 'brad@millersiteprep.demo',   'sms'::contact_method,   'Site clearing, grading, and pad work.', TRUE),
    ('Tony Alvarez',  'Suncoast Erosion Control LLC',     'subcontractor'::contact_type, '+19415550102', 'tony@suncoasterosion.demo',  'sms'::contact_method,   'Silt fence and stormwater controls.', TRUE),
    ('Logan Price',   'North Port Culvert & Access LLC',  'subcontractor'::contact_type, '+19415550103', 'logan@npculvert.demo',       'phone'::contact_method, 'Construction entrance and culvert access.', TRUE),
    ('Derek Shaw',    'Gulf Compaction Testing LLC',      'subcontractor'::contact_type, '+19415550104', 'derek@gulfcompact.demo',     'email'::contact_method, 'Compaction testing, survey, and inspection coordination.', TRUE),
    ('Mike Turner',   'Suncoast Concrete LLC',            'subcontractor'::contact_type, '+19415550105', 'mike@suncoastconcrete.demo', 'sms'::contact_method,   'Footings, slab prep, and slab pours.', TRUE),
    ('Carlos Vega',   'Charlotte Block & Masonry LLC',    'subcontractor'::contact_type, '+19415550106', 'carlos@charlotteblock.demo', 'sms'::contact_method,   'Block walls, openings, and tie beam.', TRUE),
    ('Eric Nolan',    'Suncoast Rebar Services LLC',      'subcontractor'::contact_type, '+19415550107', 'eric@suncoastrebar.demo',    'sms'::contact_method,   'Rebar placement and tie beam reinforcement.', TRUE),
    ('Luke Foster',   'Southwest Truss & Lumber LLC',     'subcontractor'::contact_type, '+19415550108', 'luke@swtruss.demo',          'email'::contact_method, 'Framing materials delivery and truss coordination.', TRUE),
    ('Nathan Doyle',  'Gulf Shore Framing LLC',           'subcontractor'::contact_type, '+19415550109', 'nathan@gulfshoreframe.demo', 'sms'::contact_method,   'Framing and roof sheathing lead.', TRUE),
    ('Jack Carter',   'Gulf Coast Roofing LLC',           'subcontractor'::contact_type, '+19415550110', 'jack@gulfcoastroof.demo',    'phone'::contact_method, 'Dry-in roofing lead.', TRUE),
    ('Owen Price',    'Suncoast Windows & Doors LLC',     'subcontractor'::contact_type, '+19415550111', 'owen@suncoastwd.demo',       'email'::contact_method, 'Windows and exterior doors.', TRUE),
    ('Ryan Scott',    'North Port Plumbing LLC',          'subcontractor'::contact_type, '+19415550112', 'ryan@npplumbing.demo',       'sms'::contact_method,   'Underground, rough, and final plumbing.', TRUE),
    ('Tyler Brooks',  'Gulf Coast Electric LLC',          'subcontractor'::contact_type, '+19415550113', 'tyler@gulfcoastelec.demo',   'sms'::contact_method,   'Underground, rough, and final electrical.', TRUE),
    ('Noah Bennett',  'Coastal Air Systems LLC',          'subcontractor'::contact_type, '+19415550114', 'noah@coastalair.demo',       'sms'::contact_method,   'HVAC rough and final.', TRUE),
    ('Connor Wells',  'Southwest Septic LLC',             'subcontractor'::contact_type, '+19415550115', 'connor@swseptic.demo',       'sms'::contact_method,   'Septic and utility connections.', TRUE),
    ('Jordan Bell',   'Suncoast Insulation LLC',          'subcontractor'::contact_type, '+19415550116', 'jordan@suncoastins.demo',    'sms'::contact_method,   'Insulation install.', TRUE),
    ('Oliver White',  'Southwest Stucco & Siding LLC',   'subcontractor'::contact_type, '+19415550117', 'oliver@swstucco.demo',       'sms'::contact_method,   'Exterior stucco, siding, and soffit.', TRUE),
    ('Dylan Ward',    'Precision Interiors LLC',          'subcontractor'::contact_type, '+19415550118', 'dylan@precisionint.demo',    'sms'::contact_method,   'Interior trim, cabinets, flooring, and paint.', TRUE);

-- Employees (PM, boss, sales)
INSERT INTO contacts
    (name, company, contact_type, phone, email, preferred_contact_method, notes, is_active)
VALUES
    ('Steve Copeland', 'Copeland Homes', 'employee'::contact_type, '+19415550001', 'steve@copelandhomes.demo', 'email'::contact_method, 'Owner / principal.', TRUE),
    ('Dave Peterson',  'Copeland Homes', 'employee'::contact_type, '+19415550002', 'dave@copelandhomes.demo',  'sms'::contact_method,   'Project manager.', TRUE),
    ('Sarah Collins',  'Copeland Homes', 'employee'::contact_type, '+19415550003', 'sarah@copelandhomes.demo', 'email'::contact_method, 'Sales consultant.', TRUE),
    ('James Porter',   'Copeland Homes', 'employee'::contact_type, '+19415550004', 'james@copelandhomes.demo', 'email'::contact_method, 'Sales consultant.', TRUE),
    ('Megan Brooks',   'Copeland Homes', 'employee'::contact_type, '+19415550005', 'megan@copelandhomes.demo', 'email'::contact_method, 'Sales consultant.', TRUE);

-- Clients (one per project, 20 total)
INSERT INTO contacts
    (name, contact_type, phone, email, preferred_contact_method, is_active)
VALUES
    ('Emma Anderson',      'client'::contact_type, '+19415550201', 'emma.anderson@demo.com',      'email'::contact_method, TRUE),
    ('Michael Nguyen',     'client'::contact_type, '+19415550202', 'michael.nguyen@demo.com',     'email'::contact_method, TRUE),
    ('Priya Patel',        'client'::contact_type, '+19415550203', 'priya.patel@demo.com',        'email'::contact_method, TRUE),
    ('Daniel Kim',         'client'::contact_type, '+19415550204', 'daniel.kim@demo.com',         'email'::contact_method, TRUE),
    ('Sophie Wilson',      'client'::contact_type, '+19415550205', 'sophie.wilson@demo.com',      'email'::contact_method, TRUE),
    ('James Brown',        'client'::contact_type, '+19415550206', 'james.brown@demo.com',        'email'::contact_method, TRUE),
    ('Olivia Davis',       'client'::contact_type, '+19415550207', 'olivia.davis@demo.com',       'email'::contact_method, TRUE),
    ('Ethan Garcia',       'client'::contact_type, '+19415550208', 'ethan.garcia@demo.com',       'email'::contact_method, TRUE),
    ('Charlotte Martinez', 'client'::contact_type, '+19415550209', 'charlotte.martinez@demo.com', 'email'::contact_method, TRUE),
    ('Liam Robinson',      'client'::contact_type, '+19415550210', 'liam.robinson@demo.com',      'email'::contact_method, TRUE),
    ('Ava Thompson',       'client'::contact_type, '+19415550211', 'ava.thompson@demo.com',       'email'::contact_method, TRUE),
    ('Noah Hall',          'client'::contact_type, '+19415550212', 'noah.hall@demo.com',          'email'::contact_method, TRUE),
    ('Mia Allen',          'client'::contact_type, '+19415550213', 'mia.allen@demo.com',          'email'::contact_method, TRUE),
    ('Lucas Young',        'client'::contact_type, '+19415550214', 'lucas.young@demo.com',        'email'::contact_method, TRUE),
    ('Grace Hernandez',    'client'::contact_type, '+19415550215', 'grace.hernandez@demo.com',    'email'::contact_method, TRUE),
    ('Henry Wright',       'client'::contact_type, '+19415550216', 'henry.wright@demo.com',       'email'::contact_method, TRUE),
    ('Zoe Lopez',          'client'::contact_type, '+19415550217', 'zoe.lopez@demo.com',          'email'::contact_method, TRUE),
    ('Mason Hill',         'client'::contact_type, '+19415550218', 'mason.hill@demo.com',         'email'::contact_method, TRUE),
    ('Chloe Scott',        'client'::contact_type, '+19415550219', 'chloe.scott@demo.com',        'email'::contact_method, TRUE),
    ('Leo Adams',          'client'::contact_type, '+19415550220', 'leo.adams@demo.com',          'email'::contact_method, TRUE);


-- ============================================================
-- STEP 4: PROJECTS (20)
-- name = Job #
-- description contains Lot, Block, Model, Permit, Customer, Sales Consultant
-- Dates calculated: project_start + 62 calendar days = end_date
-- ============================================================

DO $$
DECLARE
    v_tid UUID;
BEGIN
    SELECT id INTO v_tid FROM project_templates WHERE name = 'Residential Build';

    INSERT INTO projects (template_id, name, description, address, status, start_date, end_date)
    VALUES

    -- --------------------------------------------------------
    -- PHASE A: Fresh Starts (planning, task 1 in_progress)
    -- --------------------------------------------------------
    (v_tid, 'JL-2026-001',
     E'Lot: 12  Block: 3\nModel: Magnolia\nPermit: NP-2026-04821\nCustomer: Emma Anderson\nSales Consultant: Sarah Collins',
     '1243 Aldermoor Terr, North Port, FL 34286',
     'planning'::project_status, '2026-04-22', '2026-06-23'),

    (v_tid, 'JL-2026-002',
     E'Lot: 7  Block: 5\nModel: Sarasota\nPermit: NP-2026-04847\nCustomer: Michael Nguyen\nSales Consultant: James Porter',
     '5872 Bermuda Ave, North Port, FL 34287',
     'planning'::project_status, '2026-04-23', '2026-06-24'),

    (v_tid, 'JL-2026-003',
     E'Lot: 22  Block: 8\nModel: Cypress\nPermit: NP-2026-04863\nCustomer: Priya Patel\nSales Consultant: Megan Brooks',
     '3461 Chamberlain Blvd, North Port, FL 34288',
     'planning'::project_status, '2026-04-24', '2026-06-25'),

    -- --------------------------------------------------------
    -- PHASE B: Through Slab (active, tasks 1-9 done, task 10 in_progress)
    -- --------------------------------------------------------
    (v_tid, 'JL-2026-004',
     E'Lot: 15  Block: 2\nModel: Palmetto\nPermit: NP-2026-04412\nCustomer: Daniel Kim\nSales Consultant: Sarah Collins',
     '7214 Dexter Ave, North Port, FL 34286',
     'active'::project_status, '2026-03-25', '2026-05-26'),

    (v_tid, 'JL-2026-005',
     E'Lot: 31  Block: 6\nModel: Osprey\nPermit: NP-2026-04437\nCustomer: Sophie Wilson\nSales Consultant: James Porter',
     '2156 Elkcam Blvd, North Port, FL 34287',
     'active'::project_status, '2026-03-28', '2026-05-29'),

    (v_tid, 'JL-2026-006',
     E'Lot: 9  Block: 11\nModel: Tarpon\nPermit: NP-2026-04458\nCustomer: James Brown\nSales Consultant: Megan Brooks',
     '8934 Flotilla St, North Port, FL 34288',
     'active'::project_status, '2026-03-31', '2026-06-01'),

    (v_tid, 'JL-2026-007',
     E'Lot: 44  Block: 4\nModel: Manatee\nPermit: PC-2026-03127\nCustomer: Olivia Davis\nSales Consultant: Sarah Collins',
     '4527 Glenellen Ave, Port Charlotte, FL 33948',
     'active'::project_status, '2026-04-01', '2026-06-02'),

    (v_tid, 'JL-2026-008',
     E'Lot: 18  Block: 7\nModel: Flamingo\nPermit: NP-2026-04471\nCustomer: Ethan Garcia\nSales Consultant: James Porter',
     '6341 Haberland Blvd, North Port, FL 34286',
     'active'::project_status, '2026-04-03', '2026-06-04'),

    (v_tid, 'JL-2026-009',
     E'Lot: 5  Block: 13\nModel: Pelican\nPermit: NP-2026-04489\nCustomer: Charlotte Martinez\nSales Consultant: Megan Brooks',
     '1089 Ippolita Ave, North Port, FL 34287',
     'active'::project_status, '2026-04-05', '2026-06-06'),

    -- --------------------------------------------------------
    -- PHASE C: Through Framing (active, tasks 1-13 done, task 14 in_progress)
    -- --------------------------------------------------------
    (v_tid, 'JL-2026-010',
     E'Lot: 27  Block: 9\nModel: Sandpiper\nPermit: NP-2026-04201\nCustomer: Liam Robinson\nSales Consultant: Sarah Collins',
     '3724 Jaffa Ave, North Port, FL 34288',
     'active'::project_status, '2026-03-01', '2026-05-02'),

    (v_tid, 'JL-2026-011',
     E'Lot: 41  Block: 1\nModel: Ibis\nPermit: NP-2026-04214\nCustomer: Ava Thompson\nSales Consultant: James Porter',
     '8165 Kilkenny Blvd, North Port, FL 34286',
     'active'::project_status, '2026-03-03', '2026-05-04'),

    (v_tid, 'JL-2026-012',
     E'Lot: 13  Block: 16\nModel: Egret\nPermit: PC-2026-02983\nCustomer: Noah Hall\nSales Consultant: Megan Brooks',
     '2493 Lantern Rd, Port Charlotte, FL 33948',
     'active'::project_status, '2026-03-05', '2026-05-06'),

    (v_tid, 'JL-2026-013',
     E'Lot: 8  Block: 12\nModel: Heron\nPermit: NP-2026-04228\nCustomer: Mia Allen\nSales Consultant: Sarah Collins',
     '5817 Manassas Ave, North Port, FL 34287',
     'active'::project_status, '2026-03-07', '2026-05-08'),

    (v_tid, 'JL-2026-014',
     E'Lot: 36  Block: 10\nModel: Snook\nPermit: NP-2026-04241\nCustomer: Lucas Young\nSales Consultant: James Porter',
     '9234 Navarre Ave, North Port, FL 34288',
     'active'::project_status, '2026-03-10', '2026-05-11'),

    -- --------------------------------------------------------
    -- PHASE D: Through Cabinets (active, tasks 1-23 done, task 24 in_progress)
    -- --------------------------------------------------------
    (v_tid, 'JL-2026-015',
     E'Lot: 21  Block: 14\nModel: Redfish\nPermit: NP-2025-11872\nCustomer: Grace Hernandez\nSales Consultant: Megan Brooks',
     '4671 Ortega Ave, North Port, FL 34286',
     'active'::project_status, '2026-01-25', '2026-03-28'),

    (v_tid, 'JL-2026-016',
     E'Lot: 3  Block: 17\nModel: Grouper\nPermit: PC-2025-09341\nCustomer: Henry Wright\nSales Consultant: Sarah Collins',
     '1358 Primrose Ave, Port Charlotte, FL 33948',
     'active'::project_status, '2026-01-28', '2026-03-31'),

    (v_tid, 'JL-2026-017',
     E'Lot: 52  Block: 5\nModel: Dolphin\nPermit: NP-2025-11901\nCustomer: Zoe Lopez\nSales Consultant: James Porter',
     '7892 Reisert Ave, North Port, FL 34287',
     'active'::project_status, '2026-02-01', '2026-04-04'),

    (v_tid, 'JL-2026-018',
     E'Lot: 17  Block: 19\nModel: Seahawk\nPermit: NP-2025-11924\nCustomer: Mason Hill\nSales Consultant: Megan Brooks',
     '3145 Salford Blvd, North Port, FL 34288',
     'active'::project_status, '2026-02-08', '2026-04-11'),

    -- --------------------------------------------------------
    -- PHASE E: Fully Complete (completed, all 26 tasks done)
    -- --------------------------------------------------------
    (v_tid, 'JL-2025-019',
     E'Lot: 29  Block: 8\nModel: Stingray\nPermit: NP-2025-09183\nCustomer: Chloe Scott\nSales Consultant: Sarah Collins',
     '6489 Tiburon Blvd, North Port, FL 34286',
     'completed'::project_status, '2025-11-15', '2026-01-16'),

    (v_tid, 'JL-2025-020',
     E'Lot: 46  Block: 22\nModel: Ibis II\nPermit: PC-2025-08774\nCustomer: Leo Adams\nSales Consultant: James Porter',
     '2734 Utica Ave, Port Charlotte, FL 33948',
     'completed'::project_status, '2025-11-25', '2026-01-26');

END $$;


-- ============================================================
-- STEP 5: TASKS (520 rows — 26 per project x 20 projects)
--
-- Cumulative day offsets derived from template default_duration_days:
--   seq:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26
--   dur:  1  2  1  2  3  2  2  1  1  4  3  1  5  1  4  3  3  3  2  1  2  1  4  6  3  1
--   start:0  1  3  4  6  9 11 13 14 15 19 22 23 28 29 33 36 39 42 44 45 47 48 52 58 61
--   end:  1  3  4  6  9 11 13 14 15 19 22 23 28 29 33 36 39 42 44 45 47 48 52 58 61 62
--
-- Phase logic per task seq j, given project's current_seq:
--   j < current_seq  → completed  (actual_start = sched_s, actual_end = sched_e)
--   j = current_seq  → in_progress (actual_start = sched_s, actual_end = NULL)
--   j > current_seq  → pending    (no actual dates)
--   current_seq = 27 → all tasks completed
-- ============================================================

DO $$
DECLARE
    v_template_id UUID;
    v_tt_ids      UUID[];
    v_tt_names    TEXT[];
    v_tt_descs    TEXT[];
    v_tt_cats     TEXT[];

    v_proj_rec    RECORD;
    v_current_seq INT;
    v_proj_start  DATE;
    j             INT;

    v_sched_s     TIMESTAMP;
    v_sched_e     TIMESTAMP;
    v_actual_s    TIMESTAMP;
    v_actual_e    TIMESTAMP;
    v_status      task_status;

    -- Cumulative start-day offset for each task (index = sequence_order)
    v_day_start INT[] := ARRAY[0,1,3,4,6,9,11,13,14,15,19,22,23,28,29,33,36,39,42,44,45,47,48,52,58,61];
    -- Cumulative end-day offset for each task
    v_day_end   INT[] := ARRAY[1,3,4,6,9,11,13,14,15,19,22,23,28,29,33,36,39,42,44,45,47,48,52,58,61,62];
BEGIN
    SELECT id INTO v_template_id FROM project_templates WHERE name = 'Residential Build';

    -- Load template task metadata in sequence order (arrays are 1-indexed: index 1 = seq 1)
    SELECT
        ARRAY_AGG(id          ORDER BY sequence_order),
        ARRAY_AGG(name        ORDER BY sequence_order),
        ARRAY_AGG(COALESCE(description, '') ORDER BY sequence_order),
        ARRAY_AGG(COALESCE(category, '')    ORDER BY sequence_order)
    INTO v_tt_ids, v_tt_names, v_tt_descs, v_tt_cats
    FROM project_template_tasks
    WHERE project_template_id = v_template_id;

    -- current_seq key:
    --   1  = Phase A (task 1 in_progress, rest pending)
    --  10  = Phase B (tasks 1-9 done, task 10 in_progress)
    --  14  = Phase C (tasks 1-13 done, task 14 in_progress)
    --  24  = Phase D (tasks 1-23 done, task 24 in_progress)
    --  27  = Phase E (all 26 done)
    FOR v_proj_rec IN
        SELECT
            p.id,
            p.name,
            p.start_date,
            CASE p.name
                WHEN 'JL-2026-001' THEN 1
                WHEN 'JL-2026-002' THEN 1
                WHEN 'JL-2026-003' THEN 1
                WHEN 'JL-2026-004' THEN 10
                WHEN 'JL-2026-005' THEN 10
                WHEN 'JL-2026-006' THEN 10
                WHEN 'JL-2026-007' THEN 10
                WHEN 'JL-2026-008' THEN 10
                WHEN 'JL-2026-009' THEN 10
                WHEN 'JL-2026-010' THEN 14
                WHEN 'JL-2026-011' THEN 14
                WHEN 'JL-2026-012' THEN 14
                WHEN 'JL-2026-013' THEN 14
                WHEN 'JL-2026-014' THEN 14
                WHEN 'JL-2026-015' THEN 24
                WHEN 'JL-2026-016' THEN 24
                WHEN 'JL-2026-017' THEN 24
                WHEN 'JL-2026-018' THEN 24
                WHEN 'JL-2025-019' THEN 27
                WHEN 'JL-2025-020' THEN 27
                ELSE 1
            END AS current_seq
        FROM projects p
    LOOP
        v_proj_start  := v_proj_rec.start_date;
        v_current_seq := v_proj_rec.current_seq;

        FOR j IN 1..26 LOOP
            v_sched_s := (v_proj_start + v_day_start[j])::TIMESTAMP + INTERVAL '7 hours';
            v_sched_e := (v_proj_start + v_day_end[j])::TIMESTAMP   + INTERVAL '17 hours';

            IF v_current_seq = 27 THEN
                -- Phase E: all completed
                v_status   := 'completed';
                v_actual_s := v_sched_s;
                v_actual_e := v_sched_e;

            ELSIF j < v_current_seq THEN
                -- Completed task
                v_status   := 'completed';
                v_actual_s := v_sched_s;
                v_actual_e := v_sched_e;

            ELSIF j = v_current_seq THEN
                -- Current in_progress task
                v_status   := 'in_progress';
                v_actual_s := v_sched_s;
                v_actual_e := NULL;

            ELSE
                -- Future pending task
                v_status   := 'pending';
                v_actual_s := NULL;
                v_actual_e := NULL;
            END IF;

            INSERT INTO tasks (
                project_id,
                template_task_id,
                name,
                description,
                category,
                status,
                scheduled_start,
                scheduled_end,
                actual_start,
                actual_end
            ) VALUES (
                v_proj_rec.id,
                v_tt_ids[j],
                v_tt_names[j],
                v_tt_descs[j],
                v_tt_cats[j],
                v_status,
                v_sched_s,
                v_sched_e,
                v_actual_s,
                v_actual_e
            );
        END LOOP;
    END LOOP;
END $$;


-- ============================================================
-- STEP 6: TASK DEPENDENCIES (500 rows — 25 per project x 20 projects)
-- Sequential chain: each task depends on the task before it.
-- Ordered by template sequence_order to guarantee correct chain.
-- ============================================================

DO $$
DECLARE
    v_proj_id  UUID;
    v_task_ids UUID[];
    i          INT;
BEGIN
    FOR v_proj_id IN SELECT id FROM projects LOOP

        -- Collect task IDs in template sequence order
        SELECT ARRAY_AGG(t.id ORDER BY ptt.sequence_order)
        INTO   v_task_ids
        FROM   tasks t
        JOIN   project_template_tasks ptt ON ptt.id = t.template_task_id
        WHERE  t.project_id = v_proj_id;

        -- Insert dependency: task[i] depends on task[i-1]
        FOR i IN 2..array_length(v_task_ids, 1) LOOP
            INSERT INTO task_dependencies (task_id, depends_on_task_id)
            VALUES (v_task_ids[i], v_task_ids[i - 1])
            ON CONFLICT DO NOTHING;
        END LOOP;

    END LOOP;
END $$;


-- ============================================================
-- STEP 7: TASK ASSIGNMENTS (680 rows — 34 per project x 20 projects)
--
-- Trade-to-sequence mapping:
--   seq  1: Derek Shaw (lead),   Brad Miller (support)
--   seq  2: Brad Miller (lead),  Tony Alvarez (support)
--   seq  3: Brad Miller (lead),  Logan Price (support)
--   seq  4: Brad Miller (lead),  Derek Shaw (support)
--   seq  5: Mike Turner (lead)
--   seq  6: Ryan Scott (lead)
--   seq  7: Tyler Brooks (lead)
--   seq  8: Derek Shaw (lead)
--   seq  9: Mike Turner (lead)
--   seq 10: Carlos Vega (lead)
--   seq 11: Carlos Vega (lead),  Eric Nolan (support)
--   seq 12: Luke Foster (supplier)
--   seq 13: Nathan Doyle (lead)
--   seq 14: Derek Shaw (lead)
--   seq 15: Jack Carter (lead),  Owen Price (support)
--   seq 16: Ryan Scott (lead)
--   seq 17: Tyler Brooks (lead)
--   seq 18: Noah Bennett (lead)
--   seq 19: Connor Wells (lead)
--   seq 20: Derek Shaw (lead)
--   seq 21: Jordan Bell (lead)
--   seq 22: Derek Shaw (lead)
--   seq 23: Oliver White (lead)
--   seq 24: Dylan Ward (lead)
--   seq 25: Ryan Scott (lead),   Tyler Brooks (support), Noah Bennett (support)
--   seq 26: Derek Shaw (lead)
-- ============================================================

DO $$
DECLARE
    v_proj_id  UUID;
    v_task_id  UUID;
    j          INT;

    -- Contact ID cache
    v_brad    UUID; v_tony   UUID; v_logan  UUID; v_derek  UUID;
    v_mike    UUID; v_carlos UUID; v_eric   UUID; v_luke   UUID;
    v_nathan  UUID; v_jack   UUID; v_owen   UUID; v_ryan   UUID;
    v_tyler   UUID; v_noah   UUID; v_connor UUID; v_jordan UUID;
    v_oliver  UUID; v_dylan  UUID;
BEGIN
    -- Load contact IDs once
    SELECT id INTO v_brad   FROM contacts WHERE name = 'Brad Miller';
    SELECT id INTO v_tony   FROM contacts WHERE name = 'Tony Alvarez';
    SELECT id INTO v_logan  FROM contacts WHERE name = 'Logan Price';
    SELECT id INTO v_derek  FROM contacts WHERE name = 'Derek Shaw';
    SELECT id INTO v_mike   FROM contacts WHERE name = 'Mike Turner';
    SELECT id INTO v_carlos FROM contacts WHERE name = 'Carlos Vega';
    SELECT id INTO v_eric   FROM contacts WHERE name = 'Eric Nolan';
    SELECT id INTO v_luke   FROM contacts WHERE name = 'Luke Foster';
    SELECT id INTO v_nathan FROM contacts WHERE name = 'Nathan Doyle';
    SELECT id INTO v_jack   FROM contacts WHERE name = 'Jack Carter';
    SELECT id INTO v_owen   FROM contacts WHERE name = 'Owen Price';
    SELECT id INTO v_ryan   FROM contacts WHERE name = 'Ryan Scott';
    SELECT id INTO v_tyler  FROM contacts WHERE name = 'Tyler Brooks';
    SELECT id INTO v_noah   FROM contacts WHERE name = 'Noah Bennett';
    SELECT id INTO v_connor FROM contacts WHERE name = 'Connor Wells';
    SELECT id INTO v_jordan FROM contacts WHERE name = 'Jordan Bell';
    SELECT id INTO v_oliver FROM contacts WHERE name = 'Oliver White';
    SELECT id INTO v_dylan  FROM contacts WHERE name = 'Dylan Ward';

    FOR v_proj_id IN SELECT id FROM projects LOOP
        FOR j IN 1..26 LOOP

            -- Resolve task ID for this project + sequence
            SELECT t.id INTO v_task_id
            FROM   tasks t
            JOIN   project_template_tasks ptt ON ptt.id = t.template_task_id
            WHERE  t.project_id         = v_proj_id
              AND  ptt.sequence_order   = j;

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
END $$;


-- ============================================================
-- VERIFICATION (uncomment to confirm row counts after seed)
-- ============================================================
-- SELECT 'project_templates'      AS tbl, COUNT(*) AS rows FROM project_templates      -- expect 1
-- UNION ALL SELECT 'project_template_tasks', COUNT(*) FROM project_template_tasks      -- expect 26
-- UNION ALL SELECT 'contacts',               COUNT(*) FROM contacts                    -- expect 43
-- UNION ALL SELECT 'projects',               COUNT(*) FROM projects                    -- expect 20
-- UNION ALL SELECT 'tasks',                  COUNT(*) FROM tasks                       -- expect 520
-- UNION ALL SELECT 'task_dependencies',      COUNT(*) FROM task_dependencies           -- expect 500
-- UNION ALL SELECT 'task_assignments',       COUNT(*) FROM task_assignments;           -- expect 680
