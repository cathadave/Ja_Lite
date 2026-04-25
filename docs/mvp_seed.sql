-- ============================================================
-- JA LITE MVP SEED DATA
-- Target: Supabase Postgres
-- Purpose: Florida / North Port realistic MVP demo data
-- No temp tables
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PROJECT TEMPLATE
-- ============================================================

INSERT INTO project_templates (name, description)
SELECT
    'Residential Build',
    'Florida / North Port single-family residential demo template for Ja Lite MVP testing.'
WHERE NOT EXISTS (
    SELECT 1
    FROM project_templates
    WHERE name = 'Residential Build'
);

-- ============================================================
-- 2. PROJECT TEMPLATE TASKS
-- ============================================================

INSERT INTO project_template_tasks (
    project_template_id,
    name,
    description,
    default_duration_days,
    sequence_order,
    category
)
SELECT
    pt.id,
    src.name,
    src.description,
    src.default_duration_days,
    src.sequence_order,
    src.category
FROM project_templates pt
CROSS JOIN (
    VALUES
        ('Permit Release & Survey Stake Lot', 'Permit released, lot staked, and initial survey control set for field start.', 1, 1, 'preconstruction'),
        ('Site Clearing & Stormwater Controls', 'Clear lot, root rake, and install silt fence / stormwater protection.', 2, 2, 'sitework'),
        ('Construction Entrance & Temp Culvert', 'Install stabilized construction entrance and temporary culvert access.', 1, 3, 'sitework'),
        ('Pad Build, Compaction & Survey Hub', 'Build pad, compact fill, verify compaction, and reset survey hub/tack points.', 2, 4, 'sitework'),
        ('Footings / Slab Prep', 'Prepare footing and slab layout, formwork, and pre-pour slab package.', 3, 5, 'concrete'),
        ('Underground Plumbing', 'Install underground plumbing prior to slab and utility inspections.', 2, 6, 'plumbing'),
        ('Underground Electrical / Ufer', 'Install underground electrical components and Ufer grounding where required.', 2, 7, 'electrical'),
        ('Inspection - Slab', 'Slab-stage inspection milestone including mono/slab and related pre-pour checks.', 1, 8, 'inspection'),
        ('Pour Monolithic Slab', 'Pour monolithic slab and complete immediate slab-stage curing/protection activities.', 1, 9, 'concrete'),
        ('Block Walls & Openings', 'Lay block walls and frame required openings for shell progression.', 4, 10, 'masonry'),
        ('Tie Beam, Rebar & Beam Pour', 'Install tie beam steel, lintels, beam prep, and complete beam pour.', 3, 11, 'masonry'),
        ('Framing Materials Delivery', 'Deliver trusses, framing package, and sheathing materials to site.', 1, 12, 'logistics'),
        ('Framing & Roof Sheathing', 'Frame structure and install roof/wall sheathing for shell progression.', 5, 13, 'framing'),
        ('Inspection - Sheathing / Roof Sheathing', 'Inspection milestone for framing shell, wall sheathing, and roof sheathing readiness.', 1, 14, 'inspection'),
        ('Dry-In (Roof, Windows, Doors)', 'Achieve dry-in with roofing, windows, and exterior doors installed.', 4, 15, 'envelope'),
        ('Rough Plumbing', 'Complete rough plumbing above slab / in-wall phase.', 3, 16, 'plumbing'),
        ('Rough Electrical', 'Complete rough electrical wiring and device boxes.', 3, 17, 'electrical'),
        ('Rough HVAC', 'Complete HVAC rough-in and related mechanical rough phase.', 3, 18, 'mechanical'),
        ('Septic / Utility / Well Prep', 'Complete septic, utility, or well-related prep required before close-in / finals.', 2, 19, 'utilities'),
        ('Inspection - MEP & Framing', 'Combined milestone for framing and MEP rough inspection readiness.', 1, 20, 'inspection'),
        ('Insulation Install', 'Install insulation package after approved roughs.', 2, 21, 'insulation'),
        ('Inspection - Insulation', 'Inspection milestone for insulation stage and close-in readiness.', 1, 22, 'inspection'),
        ('Exterior Finish (Stucco / Siding / Soffit)', 'Complete exterior finish package including stucco, siding, soffit, and related trim.', 4, 23, 'exterior'),
        ('Interior Finish (Trim, Cabinets, Flooring, Paint)', 'Complete interior trim, cabinets, flooring, and paint progression.', 6, 24, 'finishes'),
        ('Final MEP Install & Finals', 'Complete final plumbing, electrical, HVAC trim-out, and trade finals readiness.', 3, 25, 'finals'),
        ('Inspection - CO / Public Works Final / Handover', 'Final inspection milestone including public works closeout, CO, and customer handover readiness.', 1, 26, 'handover')
) AS src(name, description, default_duration_days, sequence_order, category)
WHERE pt.name = 'Residential Build'
AND NOT EXISTS (
    SELECT 1
    FROM project_template_tasks ptt
    WHERE ptt.project_template_id = pt.id
      AND ptt.name = src.name
);

-- ============================================================
-- 3. CONTACTS
-- ============================================================

INSERT INTO contacts (
    name,
    company,
    contact_type,
    phone,
    email,
    preferred_contact_method,
    notes,
    is_active
)
SELECT
    src.name,
    src.company,
    src.contact_type::contact_type,
    src.phone,
    src.email,
    src.preferred_contact_method::contact_method,
    src.notes,
    TRUE
FROM (
    VALUES
        ('Brad Miller',      'Miller Site Prep LLC',                'subcontractor', '+19415550101', 'brad@millersiteprep.com',            'sms',   'Site clearing, grading, and pad work.'),
        ('Tony Alvarez',     'Suncoast Erosion Control LLC',        'subcontractor', '+19415550102', 'tony@suncoasterosioncontrol.com',    'sms',   'Silt fence and stormwater controls.'),
        ('Logan Price',      'North Port Culvert & Access LLC',     'subcontractor', '+19415550103', 'logan@northportculvert.com',         'phone', 'Construction entrance and culvert access.'),
        ('Derek Shaw',       'Gulf Compaction Testing LLC',         'subcontractor', '+19415550104', 'derek@gulfcompactiontesting.com',    'email', 'Compaction testing and field verification.'),
        ('Mike Turner',      'Suncoast Concrete LLC',               'subcontractor', '+19415550105', 'mike@suncoastconcrete.com',          'sms',   'Footings, slab prep, and slab pours.'),
        ('Carlos Vega',      'Charlotte Block & Masonry LLC',       'subcontractor', '+19415550106', 'carlos@charlotteblockmasonry.com',   'sms',   'Block walls, openings, and tie beam work.'),
        ('Eric Nolan',       'Suncoast Rebar Services LLC',         'subcontractor', '+19415550107', 'eric@suncoastrebar.com',             'sms',   'Rebar placement and tie beam reinforcement.'),
        ('Luke Foster',      'Southwest Truss & Lumber LLC',        'subcontractor', '+19415550108', 'luke@southwesttrusslumber.com',      'email', 'Framing material delivery and lumber package coordination.'),
        ('Nathan Doyle',     'Gulf Shore Framing LLC',              'subcontractor', '+19415550109', 'nathan@gulfshoreframing.com',        'sms',   'Framing and roof sheathing lead.'),
        ('Mason Reed',       'Precision Carpentry Services LLC',    'subcontractor', '+19415550110', 'mason@precisioncarpentryfl.com',     'sms',   'Framing support and trim carpentry.'),
        ('Jack Carter',      'Gulf Coast Roofing LLC',              'subcontractor', '+19415550111', 'jack@gulfcoastroofingfl.com',        'phone', 'Dry-in roofing lead.'),
        ('Owen Price',       'Suncoast Windows & Doors LLC',        'subcontractor', '+19415550112', 'owen@suncoastwindowsdoors.com',      'email', 'Windows and exterior doors.'),
        ('Ryan Scott',       'North Port Plumbing LLC',             'subcontractor', '+19415550113', 'ryan@northportplumbing.com',         'sms',   'Underground and rough/final plumbing.'),
        ('Ethan Cole',       'Gulf Sewer & Water Services LLC',     'subcontractor', '+19415550114', 'ethan@gulfsewerwater.com',           'phone', 'Utility side plumbing and service connections.'),
        ('Tyler Brooks',     'Gulf Coast Electric LLC',             'subcontractor', '+19415550115', 'tyler@gulfcoastelectric.com',        'sms',   'Underground, rough, and final electrical.'),
        ('Blake Young',      'Sunstate Power Services LLC',         'subcontractor', '+19415550116', 'blake@sunstatepower.com',            'email', 'Electrical support and service coordination.'),
        ('Noah Bennett',     'Coastal Air Systems LLC',             'subcontractor', '+19415550117', 'noah@coastalairsystems.com',         'phone', 'HVAC rough and final mechanical work.'),
        ('Aiden Hayes',      'Suncoast Ventilation LLC',            'subcontractor', '+19415550118', 'aiden@suncoastventilation.com',      'email', 'Mechanical support and ventilation package.'),
        ('Connor Wells',     'Southwest Septic & Drainfield LLC',   'subcontractor', '+19415550119', 'connor@southwestsepticfl.com',       'phone', 'Septic system install and prep.'),
        ('Xavier Ford',      'Gulf Utility Services LLC',           'subcontractor', '+19415550120', 'xavier@gulfutilityservices.com',     'phone', 'Utility coordination and public works related items.'),
        ('Mitchell Green',   'Florida Well Drilling LLC',           'subcontractor', '+19415550121', 'mitchell@floridawelldrilling.com',   'email', 'Well drilling where applicable.'),
        ('Jordan Bell',      'Suncoast Insulation LLC',             'subcontractor', '+19415550122', 'jordan@suncoastinsulation.com',      'sms',   'Insulation install and inspection readiness.'),
        ('Oliver White',     'Southwest Stucco & Siding LLC',       'subcontractor', '+19415550123', 'oliver@southweststuccosiding.com',   'sms',   'Exterior stucco and siding finishes.'),
        ('Caleb Stone',      'Gulf Exterior Trim LLC',              'subcontractor', '+19415550124', 'caleb@gulfexteriortrim.com',         'phone', 'Soffit, fascia, and exterior trim package.'),
        ('Dylan Ward',       'Precision Interiors LLC',             'subcontractor', '+19415550125', 'dylan@precisioninteriorsfl.com',     'sms',   'Interior finish lead.'),
        ('Levi Ross',        'Gulf Coast Cabinets LLC',             'subcontractor', '+19415550126', 'levi@gulfcoastcabinets.com',         'email', 'Cabinets and millwork support.'),
        ('Patrick Lee',      'Coastal Flooring & Tile LLC',         'subcontractor', '+19415550127', 'patrick@coastalflooringtile.com',    'email', 'Tile and flooring package.'),
        ('Isaac Perry',      'Perry Paint & Finish LLC',            'subcontractor', '+19415550128', 'isaac@perrypaintfinish.com',         'sms',   'Interior and exterior paint finishes.'),
        ('Samuel King',      'Charlotte Final Clean LLC',           'subcontractor', '+19415550129', 'samuel@charlottefinalclean.com',     'phone', 'Final clean and handover prep.'),
        ('Cooper West',      'Coastal Landscape & Driveway LLC',    'subcontractor', '+19415550130', 'cooper@coastallandscapedriveway.com','phone', 'Driveway, grade, and landscape closeout.'),

        ('Emma Anderson',      NULL, 'client', '+19415550201', 'emma.anderson@example.com',      'email', 'Primary customer for Anderson Residence.'),
        ('Michael Nguyen',     NULL, 'client', '+19415550202', 'michael.nguyen@example.com',     'email', 'Primary customer for Nguyen Residence.'),
        ('Priya Patel',        NULL, 'client', '+19415550203', 'priya.patel@example.com',        'email', 'Primary customer for Patel Residence.'),
        ('Daniel Kim',         NULL, 'client', '+19415550204', 'daniel.kim@example.com',         'phone', 'Primary customer for Kim Residence.'),
        ('Sophie Wilson',      NULL, 'client', '+19415550205', 'sophie.wilson@example.com',      'email', 'Primary customer for Wilson Residence.'),
        ('James Brown',        NULL, 'client', '+19415550206', 'james.brown@example.com',        'phone', 'Primary customer for Brown Residence.'),
        ('Olivia Davis',       NULL, 'client', '+19415550207', 'olivia.davis@example.com',       'email', 'Primary customer for Davis Residence.'),
        ('Ethan Garcia',       NULL, 'client', '+19415550208', 'ethan.garcia@example.com',       'phone', 'Primary customer for Garcia Residence.'),
        ('Charlotte Martinez', NULL, 'client', '+19415550209', 'charlotte.martinez@example.com', 'email', 'Primary customer for Martinez Residence.'),
        ('Liam Robinson',      NULL, 'client', '+19415550210', 'liam.robinson@example.com',      'email', 'Primary customer for Robinson Residence.'),
        ('Ava Thompson',       NULL, 'client', '+19415550211', 'ava.thompson@example.com',       'email', 'Primary customer for Thompson Residence.'),
        ('Noah Hall',          NULL, 'client', '+19415550212', 'noah.hall@example.com',          'phone', 'Primary customer for Hall Residence.'),
        ('Mia Allen',          NULL, 'client', '+19415550213', 'mia.allen@example.com',          'email', 'Primary customer for Allen Residence.'),
        ('Lucas Young',        NULL, 'client', '+19415550214', 'lucas.young@example.com',        'email', 'Primary customer for Young Residence.'),
        ('Grace Hernandez',    NULL, 'client', '+19415550215', 'grace.hernandez@example.com',    'email', 'Primary customer for Hernandez Residence.'),
        ('Henry Wright',       NULL, 'client', '+19415550216', 'henry.wright@example.com',       'phone', 'Primary customer for Wright Residence.'),
        ('Zoe Lopez',          NULL, 'client', '+19415550217', 'zoe.lopez@example.com',          'email', 'Primary customer for Lopez Residence.'),
        ('Mason Hill',         NULL, 'client', '+19415550218', 'mason.hill@example.com',         'email', 'Primary customer for Hill Residence.'),
        ('Chloe Scott',        NULL, 'client', '+19415550219', 'chloe.scott@example.com',        'email', 'Primary customer for Scott Residence.'),
        ('Leo Adams',          NULL, 'client', '+19415550220', 'leo.adams@example.com',          'phone', 'Primary customer for Adams Residence.'),

        ('Sarah Collins', 'Ja Lite Sales', 'employee', '+19415550301', 'sarah.collins@jalite.com', 'email', 'Sales consultant.'),
        ('James Porter',  'Ja Lite Sales', 'employee', '+19415550302', 'james.porter@jalite.com',  'email', 'Sales consultant.'),
        ('Megan Brooks',  'Ja Lite Sales', 'employee', '+19415550303', 'megan.brooks@jalite.com',  'email', 'Sales consultant.'),
        ('Chris Morgan',  'Ja Lite Sales', 'employee', '+19415550304', 'chris.morgan@jalite.com',  'email', 'Sales consultant.'),
        ('Laura Bennett', 'Ja Lite Sales', 'employee', '+19415550305', 'laura.bennett@jalite.com', 'email', 'Sales consultant.'),

        ('Steve Copeland', 'Ja Lite', 'employee', '+19415550401', 'steve.copeland@jalite.com', 'phone', 'Boss contact for approvals and escalation testing.'),
        ('Dave Peterson',  'Ja Lite', 'employee', '+19415550402', 'dave.peterson@jalite.com',  'email', 'PM contact for project coordination testing.')
) AS src(name, company, contact_type, phone, email, preferred_contact_method, notes)
WHERE NOT EXISTS (
    SELECT 1
    FROM contacts c
    WHERE c.name = src.name
);

-- ============================================================
-- 4. PROJECTS
-- ============================================================

WITH seed_projects AS (
    SELECT *
    FROM (
        VALUES
            (1,  'Anderson Residence',  'Emma Anderson',      'Sarah Collins', '1234 Sable Palm Drive, North Port, FL 34287', 'planning',  DATE '2026-05-11', DATE '2026-09-18', 'JL-NP-26001', '14', 'B1', 'PRM-NP-26001', 'North Port Estates', 0,  NULL::int, NULL::int),
            (2,  'Nguyen Residence',    'Michael Nguyen',     'James Porter',  '1458 Blue Sage Lane, North Port, FL 34288',   'planning',  DATE '2026-05-18', DATE '2026-09-25', 'JL-NP-26002', '22', 'B1', 'PRM-NP-26002', 'Toledo Blade Corridor', 0, NULL::int, NULL::int),
            (3,  'Patel Residence',     'Priya Patel',        'Megan Brooks',  '1672 North Salford Boulevard, North Port, FL 34286', 'planning', DATE '2026-05-25', DATE '2026-10-02', 'JL-NP-26003', '9',  'A2', 'PRM-NP-26003', 'Cranberry Corridor', 0, NULL::int, NULL::int),
            (4,  'Kim Residence',       'Daniel Kim',         'Chris Morgan',  '1824 Hornbuckle Boulevard, North Port, FL 34291', 'planning', DATE '2026-06-01', DATE '2026-10-09', 'JL-NP-26004', '18', 'A2', 'PRM-NP-26004', 'Sumter Gateway', 0, NULL::int, NULL::int),
            (5,  'Wilson Residence',    'Sophie Wilson',      'Laura Bennett', '1956 Tropicaire Boulevard, North Port, FL 34286', 'planning', DATE '2026-06-08', DATE '2026-10-16', 'JL-NP-26005', '3',  'C4', 'PRM-NP-26005', 'Warm Mineral Springs', 0, NULL::int, NULL::int),

            (6,  'Brown Residence',     'James Brown',        'Sarah Collins', '2145 North Chamberlain Boulevard, North Port, FL 34286', 'active', DATE '2026-02-09', DATE '2026-06-19', 'JL-NP-26006', '11', 'C4', 'PRM-NP-26006', 'North Port Estates', 5, 6,  NULL::int),
            (7,  'Davis Residence',     'Olivia Davis',       'James Porter',  '2288 Haberland Boulevard, North Port, FL 34288', 'active', DATE '2026-02-16', DATE '2026-06-26', 'JL-NP-26007', '7',  'D2', 'PRM-NP-26007', 'Cranberry Corridor', 7, 8,  NULL::int),
            (8,  'Garcia Residence',    'Ethan Garcia',       'Megan Brooks',  '2391 Atwater Drive, North Port, FL 34288', 'active', DATE '2026-02-23', DATE '2026-07-03', 'JL-NP-26008', '15', 'D2', 'PRM-NP-26008', 'Toledo Blade Corridor', 8, 9, NULL::int),
            (9,  'Martinez Residence',  'Charlotte Martinez', 'Chris Morgan',  '2510 N Toledo Blade Boulevard, North Port, FL 34289', 'active', DATE '2026-03-02', DATE '2026-07-10', 'JL-NP-26009', '26', 'E3', 'PRM-NP-26009', 'Heron Creek', 10, 11, NULL::int),
            (10, 'Robinson Residence',  'Liam Robinson',      'Laura Bennett', '2642 Sumter Boulevard, North Port, FL 34287', 'active', DATE '2026-03-09', DATE '2026-07-17', 'JL-NP-26010', '6',  'E3', 'PRM-NP-26010', 'Sumter Gateway', 12, 13, NULL::int),
            (11, 'Thompson Residence',  'Ava Thompson',       'Sarah Collins', '2784 Price Boulevard, North Port, FL 34291', 'active', DATE '2026-03-16', DATE '2026-07-24', 'JL-NP-26011', '12', 'F5', 'PRM-NP-26011', 'Price Corridor', 13, 14, NULL::int),
            (12, 'Hall Residence',      'Noah Hall',          'James Porter',  '2896 S Cranberry Boulevard, North Port, FL 34286', 'active', DATE '2026-03-23', DATE '2026-07-31', 'JL-NP-26012', '19', 'F5', 'PRM-NP-26012', 'Cranberry Corridor', 15, 16, NULL::int),
            (13, 'Allen Residence',     'Mia Allen',          'Megan Brooks',  '3018 W Price Boulevard, North Port, FL 34288', 'active', DATE '2026-03-30', DATE '2026-08-07', 'JL-NP-26013', '8',  'G1', 'PRM-NP-26013', 'Warm Mineral Springs', 16, 17, NULL::int),
            (14, 'Young Residence',     'Lucas Young',        'Chris Morgan',  '3150 N Biscayne Drive, North Port, FL 34291', 'active', DATE '2026-04-06', DATE '2026-08-14', 'JL-NP-26014', '20', 'G1', 'PRM-NP-26014', 'North Port Estates', 18, 19, NULL::int),
            (15, 'Hernandez Residence', 'Grace Hernandez',    'Laura Bennett', '3282 Pan American Boulevard, North Port, FL 34287', 'active', DATE '2026-04-13', DATE '2026-08-21', 'JL-NP-26015', '5',  'H6', 'PRM-NP-26015', 'Toledo Blade Corridor', 20, 21, NULL::int),

            (16, 'Wright Residence',    'Henry Wright',       'Sarah Collins', '3394 Yorkshire Street, North Port, FL 34288', 'on_hold', DATE '2026-01-26', DATE '2026-06-05', 'JL-NP-26016', '17', 'H6', 'PRM-NP-26016', 'Heron Creek', 11, NULL::int, 12),
            (17, 'Lopez Residence',     'Zoe Lopez',          'James Porter',  '3426 Kenvil Drive, North Port, FL 34288', 'on_hold', DATE '2026-02-02', DATE '2026-06-12', 'JL-NP-26017', '4',  'J2', 'PRM-NP-26017', 'Price Corridor', 14, NULL::int, 15),
            (18, 'Hill Residence',      'Mason Hill',         'Megan Brooks',  '3558 Plantation Boulevard, North Port, FL 34289', 'on_hold', DATE '2026-02-09', DATE '2026-06-19', 'JL-NP-26018', '21', 'J2', 'PRM-NP-26018', 'North Port Estates', 18, NULL::int, 19),

            (19, 'Scott Residence',     'Chloe Scott',        'Chris Morgan',  '3680 Talon Bay Drive, North Port, FL 34287', 'completed', DATE '2025-12-29', DATE '2026-04-22', 'JL-NP-26019', '10', 'K3', 'PRM-NP-26019', 'Heron Creek', 26, NULL::int, NULL::int),
            (20, 'Adams Residence',     'Leo Adams',          'Laura Bennett', '3722 Bobcat Trail, North Port, FL 34287', 'completed', DATE '2026-01-05', DATE '2026-04-29', 'JL-NP-26020', '16', 'K3', 'PRM-NP-26020', 'Warm Mineral Springs', 26, NULL::int, NULL::int)
    ) AS v(
        seq, project_name, customer_name, consultant_name, address, status,
        start_date, end_date, job_number, lot_number, block_number,
        permit_number, community_name, completed_through, current_task_order, blocked_task_order
    )
)
INSERT INTO projects (
    template_id,
    name,
    description,
    address,
    status,
    start_date,
    end_date
)
SELECT
    pt.id,
    sp.project_name,
    'Customer: ' || sp.customer_name || E'\n'
    || 'Consultant: ' || sp.consultant_name || E'\n'
    || 'Job Number: ' || sp.job_number || E'\n'
    || 'Lot Number: ' || sp.lot_number || E'\n'
    || 'Block Number: ' || sp.block_number || E'\n'
    || 'Permit Number: ' || sp.permit_number || E'\n'
    || 'Community: ' || sp.community_name,
    sp.address,
    sp.status::project_status,
    sp.start_date,
    sp.end_date
FROM seed_projects sp
CROSS JOIN project_templates pt
WHERE pt.name = 'Residential Build'
AND NOT EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.name = sp.project_name
);

-- ============================================================
-- 5. TASKS
-- ============================================================

WITH seed_projects AS (
    SELECT *
    FROM (
        VALUES
            (1,  'Anderson Residence',  'planning',  DATE '2026-05-11', 0,  NULL::int, NULL::int),
            (2,  'Nguyen Residence',    'planning',  DATE '2026-05-18', 0,  NULL::int, NULL::int),
            (3,  'Patel Residence',     'planning',  DATE '2026-05-25', 0,  NULL::int, NULL::int),
            (4,  'Kim Residence',       'planning',  DATE '2026-06-01', 0,  NULL::int, NULL::int),
            (5,  'Wilson Residence',    'planning',  DATE '2026-06-08', 0,  NULL::int, NULL::int),

            (6,  'Brown Residence',     'active',    DATE '2026-02-09', 5,  6,  NULL::int),
            (7,  'Davis Residence',     'active',    DATE '2026-02-16', 7,  8,  NULL::int),
            (8,  'Garcia Residence',    'active',    DATE '2026-02-23', 8,  9,  NULL::int),
            (9,  'Martinez Residence',  'active',    DATE '2026-03-02', 10, 11, NULL::int),
            (10, 'Robinson Residence',  'active',    DATE '2026-03-09', 12, 13, NULL::int),
            (11, 'Thompson Residence',  'active',    DATE '2026-03-16', 13, 14, NULL::int),
            (12, 'Hall Residence',      'active',    DATE '2026-03-23', 15, 16, NULL::int),
            (13, 'Allen Residence',     'active',    DATE '2026-03-30', 16, 17, NULL::int),
            (14, 'Young Residence',     'active',    DATE '2026-04-06', 18, 19, NULL::int),
            (15, 'Hernandez Residence', 'active',    DATE '2026-04-13', 20, 21, NULL::int),

            (16, 'Wright Residence',    'on_hold',   DATE '2026-01-26', 11, NULL::int, 12),
            (17, 'Lopez Residence',     'on_hold',   DATE '2026-02-02', 14, NULL::int, 15),
            (18, 'Hill Residence',      'on_hold',   DATE '2026-02-09', 18, NULL::int, 19),

            (19, 'Scott Residence',     'completed', DATE '2025-12-29', 26, NULL::int, NULL::int),
            (20, 'Adams Residence',     'completed', DATE '2026-01-05', 26, NULL::int, NULL::int)
    ) AS v(seq, project_name, status, start_date, completed_through, current_task_order, blocked_task_order)
),
template_task_schedule AS (
    SELECT
        ptt.id,
        ptt.project_template_id,
        ptt.name,
        ptt.description,
        ptt.default_duration_days,
        ptt.sequence_order,
        COALESCE(
            SUM(ptt.default_duration_days) OVER (
                PARTITION BY ptt.project_template_id
                ORDER BY ptt.sequence_order
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
        ) AS day_offset
    FROM project_template_tasks ptt
    JOIN project_templates pt
      ON pt.id = ptt.project_template_id
    WHERE pt.name = 'Residential Build'
)
INSERT INTO tasks (
    project_id,
    template_task_id,
    name,
    description,
    status,
    scheduled_start,
    scheduled_end,
    actual_start,
    actual_end
)
SELECT
    p.id,
    tts.id,
    tts.name,
    tts.description,
    CASE
        WHEN sp.status = 'planning' THEN 'pending'::task_status
        WHEN sp.status = 'completed' THEN 'completed'::task_status
        WHEN sp.status = 'on_hold' THEN
            CASE
                WHEN tts.sequence_order <= sp.completed_through THEN 'completed'::task_status
                WHEN tts.sequence_order = sp.blocked_task_order THEN 'blocked'::task_status
                ELSE 'pending'::task_status
            END
        WHEN sp.status = 'active' THEN
            CASE
                WHEN tts.sequence_order <= sp.completed_through THEN 'completed'::task_status
                WHEN tts.sequence_order = sp.current_task_order THEN 'in_progress'::task_status
                ELSE 'pending'::task_status
            END
        ELSE 'pending'::task_status
    END,
    sp.start_date::timestamp
        + make_interval(days => tts.day_offset::int)
        + INTERVAL '7 hours',
    sp.start_date::timestamp
        + make_interval(days => (tts.day_offset + GREATEST(tts.default_duration_days, 1) - 1)::int)
        + INTERVAL '16 hours',
    CASE
        WHEN sp.status = 'completed'
            THEN sp.start_date::timestamp
                + make_interval(days => tts.day_offset::int)
                + INTERVAL '7 hours'
        WHEN sp.status = 'on_hold'
             AND tts.sequence_order <= sp.completed_through
            THEN sp.start_date::timestamp
                + make_interval(days => tts.day_offset::int)
                + INTERVAL '7 hours'
        WHEN sp.status = 'active'
             AND tts.sequence_order <= sp.completed_through
            THEN sp.start_date::timestamp
                + make_interval(days => tts.day_offset::int)
                + INTERVAL '7 hours'
        WHEN sp.status = 'active'
             AND tts.sequence_order = sp.current_task_order
            THEN sp.start_date::timestamp
                + make_interval(days => tts.day_offset::int)
                + INTERVAL '7 hours'
        ELSE NULL
    END,
    CASE
        WHEN sp.status = 'completed'
            THEN sp.start_date::timestamp
                + make_interval(days => (tts.day_offset + GREATEST(tts.default_duration_days, 1) - 1)::int)
                + INTERVAL '15 hours'
        WHEN sp.status = 'on_hold'
             AND tts.sequence_order <= sp.completed_through
            THEN sp.start_date::timestamp
                + make_interval(days => (tts.day_offset + GREATEST(tts.default_duration_days, 1) - 1)::int)
                + INTERVAL '15 hours'
        WHEN sp.status = 'active'
             AND tts.sequence_order <= sp.completed_through
            THEN sp.start_date::timestamp
                + make_interval(days => (tts.day_offset + GREATEST(tts.default_duration_days, 1) - 1)::int)
                + INTERVAL '15 hours'
        ELSE NULL
    END
FROM projects p
JOIN seed_projects sp
  ON sp.project_name = p.name
JOIN project_templates pt
  ON pt.id = p.template_id
JOIN template_task_schedule tts
  ON tts.project_template_id = pt.id
WHERE pt.name = 'Residential Build'
AND NOT EXISTS (
    SELECT 1
    FROM tasks t
    WHERE t.project_id = p.id
      AND t.name = tts.name
);

-- ============================================================
-- 6. TASK ASSIGNMENTS
-- ============================================================

WITH task_assignment_map AS (
    SELECT *
    FROM (
        VALUES
            ('Permit Release & Survey Stake Lot',               'Derek Shaw',   'Brad Miller',  NULL),
            ('Site Clearing & Stormwater Controls',             'Brad Miller',  'Tony Alvarez', NULL),
            ('Construction Entrance & Temp Culvert',            'Logan Price',  'Brad Miller',  NULL),
            ('Pad Build, Compaction & Survey Hub',              'Brad Miller',  'Derek Shaw',   NULL),
            ('Footings / Slab Prep',                            'Mike Turner',  'Carlos Vega',   NULL),
            ('Underground Plumbing',                            'Ryan Scott',   'Ethan Cole',    NULL),
            ('Underground Electrical / Ufer',                   'Tyler Brooks', 'Blake Young',   NULL),
            ('Inspection - Slab',                               'Mike Turner',  'Ryan Scott',    'Tyler Brooks'),
            ('Pour Monolithic Slab',                            'Mike Turner',  'Eric Nolan',    NULL),
            ('Block Walls & Openings',                          'Carlos Vega',  'Eric Nolan',    NULL),
            ('Tie Beam, Rebar & Beam Pour',                     'Carlos Vega',  'Eric Nolan',    'Mike Turner'),
            ('Framing Materials Delivery',                      'Luke Foster',  'Nathan Doyle',  NULL),
            ('Framing & Roof Sheathing',                        'Nathan Doyle', 'Mason Reed',    NULL),
            ('Inspection - Sheathing / Roof Sheathing',         'Nathan Doyle', 'Jack Carter',   NULL),
            ('Dry-In (Roof, Windows, Doors)',                   'Jack Carter',  'Owen Price',    'Caleb Stone'),
            ('Rough Plumbing',                                  'Ryan Scott',   'Ethan Cole',    NULL),
            ('Rough Electrical',                                'Tyler Brooks', 'Blake Young',   NULL),
            ('Rough HVAC',                                      'Noah Bennett', 'Aiden Hayes',   NULL),
            ('Septic / Utility / Well Prep',                    'Connor Wells', 'Xavier Ford',   'Mitchell Green'),
            ('Inspection - MEP & Framing',                      'Ryan Scott',   'Tyler Brooks',  'Noah Bennett'),
            ('Insulation Install',                              'Jordan Bell',  NULL,            NULL),
            ('Inspection - Insulation',                         'Jordan Bell',  NULL,            NULL),
            ('Exterior Finish (Stucco / Siding / Soffit)',      'Oliver White', 'Caleb Stone',   NULL),
            ('Interior Finish (Trim, Cabinets, Flooring, Paint)','Dylan Ward',  'Levi Ross',     'Isaac Perry'),
            ('Final MEP Install & Finals',                      'Ryan Scott',   'Tyler Brooks',  'Noah Bennett'),
            ('Inspection - CO / Public Works Final / Handover', 'Samuel King',  'Xavier Ford',   'Cooper West')
    ) AS v(task_name, lead_contact_name, support_contact_name, supplier_contact_name)
)
INSERT INTO task_assignments (task_id, contact_id, role, notes)
SELECT
    t.id,
    c.id,
    src.role::assignment_role,
    src.notes
FROM tasks t
JOIN task_assignment_map map
  ON map.task_name = t.name
JOIN LATERAL (
    VALUES
        (map.lead_contact_name, 'lead', 'Primary trade assigned for this task.'),
        (map.support_contact_name, 'support', 'Support trade assigned for coordination and capacity.'),
        (map.supplier_contact_name, 'supplier', 'Supply-focused or specialty support assignment for this task.')
) AS src(contact_name, role, notes)
  ON src.contact_name IS NOT NULL
JOIN contacts c
  ON c.name = src.contact_name
WHERE NOT EXISTS (
    SELECT 1
    FROM task_assignments ta
    WHERE ta.task_id = t.id
      AND ta.contact_id = c.id
);

COMMIT;