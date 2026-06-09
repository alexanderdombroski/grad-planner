BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS majors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code text NOT NULL UNIQUE,
  subject_code text NOT NULL,
  course_number text NOT NULL,
  title text NOT NULL,
  credits smallint NOT NULL CHECK (credits > 0),
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_prerequisites (
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  minimum_grade text NOT NULL DEFAULT 'C',
  notes text NOT NULL DEFAULT '',
  PRIMARY KEY (course_id, prerequisite_course_id)
);

CREATE TABLE IF NOT EXISTS major_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  major_id uuid NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  requirement_group text NOT NULL,
  requirement_type text NOT NULL CHECK (requirement_type IN ('required', 'elective', 'support', 'general_education')),
  required_credits smallint,
  sort_order integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  UNIQUE (major_id, requirement_group)
);

CREATE TABLE IF NOT EXISTS major_requirement_courses (
  requirement_id uuid NOT NULL REFERENCES major_requirements(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  is_required boolean NOT NULL DEFAULT true,
  PRIMARY KEY (requirement_id, course_id)
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL UNIQUE,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  major_id uuid NOT NULL REFERENCES majors(id) ON DELETE RESTRICT,
  catalog_year text NOT NULL DEFAULT '2026-2027',
  target_graduation_term text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, major_id, catalog_year)
);

CREATE TABLE IF NOT EXISTS student_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES student_plans(id) ON DELETE CASCADE,
  term_label text NOT NULL,
  term_order integer NOT NULL,
  term_year integer,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'current', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, term_order),
  UNIQUE (plan_id, term_label)
);

CREATE TABLE IF NOT EXISTS student_term_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_term_id uuid NOT NULL REFERENCES student_terms(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'dropped')),
  grade text,
  planned_credits smallint NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_term_id, course_id)
);

INSERT INTO majors (code, name, description)
VALUES
  ('CS', 'Computer Science', 'Software, systems, algorithms, and computing theory.'),
  ('CYB', 'Cybersecurity', 'Network defense, secure systems, and digital forensics.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (course_code, subject_code, course_number, title, credits, description)
VALUES
  ('CS 101', 'CS', '101', 'Introduction to Programming', 4, 'Foundational programming concepts using a modern language.'),
  ('CS 110', 'CS', '110', 'Discrete Computing', 3, 'Logic, sets, proof techniques, and discrete structures for computing.'),
  ('CS 150', 'CS', '150', 'Computer Systems Fundamentals', 4, 'Introductory study of hardware, operating systems, and low-level software.'),
  ('CS 210', 'CS', '210', 'Data Structures', 4, 'Arrays, linked lists, stacks, queues, trees, and hash tables.'),
  ('CS 220', 'CS', '220', 'Object-Oriented Design', 4, 'Classes, abstraction, interfaces, inheritance, and design principles.'),
  ('CS 260', 'CS', '260', 'Database Systems', 3, 'Relational modeling, SQL, and application data design.'),
  ('CS 310', 'CS', '310', 'Algorithms', 4, 'Algorithm analysis, recursion, graphs, and dynamic programming.'),
  ('CS 320', 'CS', '320', 'Operating Systems', 4, 'Processes, threads, memory, and file systems.'),
  ('CS 330', 'CS', '330', 'Computer Architecture', 4, 'Instruction sets, pipelining, caches, and low-level performance.'),
  ('CS 340', 'CS', '340', 'Software Engineering', 3, 'Requirements, testing, teamwork, and delivery practices.'),
  ('CS 410', 'CS', '410', 'Senior Capstone', 4, 'A team-based capstone project for the computer science major.'),
  ('CYBR 200', 'CYBR', '200', 'Cybersecurity Fundamentals', 3, 'Security concepts, threats, controls, and risk management.'),
  ('CYBR 210', 'CYBR', '210', 'Network Defense', 4, 'Traffic analysis, segmentation, firewalls, and secure configuration.'),
  ('CYBR 310', 'CYBR', '310', 'Secure Systems', 4, 'Hardening, authentication, authorization, and secure administration.'),
  ('CYBR 330', 'CYBR', '330', 'Digital Forensics', 3, 'Evidence handling, incident response, and forensic investigation basics.'),
  ('NETW 220', 'NETW', '220', 'Network Administration', 4, 'Routing, switching, VLANs, and network operations.'),
  ('IT 240', 'IT', '240', 'Cloud Infrastructure', 3, 'Virtualization, cloud services, and infrastructure deployment.'),
  ('MATH 175', 'MATH', '175', 'Calculus I', 4, 'Limits, derivatives, and applications.'),
  ('MATH 221', 'MATH', '221', 'Calculus II', 4, 'Integration techniques, sequences, and series.'),
  ('MATH 230', 'MATH', '230', 'Discrete Mathematics', 3, 'Combinatorics, graph theory, and proof-based reasoning.'),
  ('STAT 240', 'STAT', '240', 'Statistics for Computing', 3, 'Probability, sampling, inference, and applied statistics.'),
  ('ENG 101', 'ENG', '101', 'College Composition I', 3, 'College-level academic writing and revision.'),
  ('ENG 102', 'ENG', '102', 'College Composition II', 3, 'Research-based writing and source integration.'),
  ('COMM 130', 'COMM', '130', 'Public Speaking', 3, 'Organization, delivery, and audience adaptation in oral presentations.'),
  ('HIST 110', 'HIST', '110', 'World Civilization', 3, 'Survey of major world civilizations and historical developments.'),
  ('PHYS 121', 'PHYS', '121', 'University Physics I', 4, 'Mechanics, motion, forces, and energy.')
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO course_prerequisites (course_id, prerequisite_course_id, minimum_grade, notes)
SELECT c.id, p.id, 'C', ''
FROM (
  VALUES
    ('CS 110', 'CS 101'),
    ('CS 150', 'CS 101'),
    ('CS 210', 'CS 110'),
    ('CS 220', 'CS 210'),
    ('CS 260', 'CS 210'),
    ('CS 310', 'CS 210'),
    ('CS 310', 'MATH 230'),
    ('CS 320', 'CS 150'),
    ('CS 320', 'CS 220'),
    ('CS 330', 'CS 150'),
    ('CS 330', 'MATH 175'),
    ('CS 340', 'CS 220'),
    ('CS 410', 'CS 310'),
    ('CS 410', 'CS 340'),
    ('CYBR 210', 'CYBR 200'),
    ('CYBR 210', 'CS 150'),
    ('CYBR 310', 'CYBR 210'),
    ('CYBR 310', 'CS 320'),
    ('CYBR 330', 'CYBR 210'),
    ('NETW 220', 'CS 150'),
    ('IT 240', 'NETW 220'),
    ('MATH 221', 'MATH 175'),
    ('MATH 230', 'MATH 175'),
    ('STAT 240', 'MATH 175')
) AS prereq(course_code, prerequisite_code)
JOIN courses c ON c.course_code = prereq.course_code
JOIN courses p ON p.course_code = prereq.prerequisite_code
ON CONFLICT (course_id, prerequisite_course_id) DO NOTHING;

INSERT INTO major_requirements (major_id, requirement_group, requirement_type, required_credits, sort_order, notes)
SELECT m.id, req.requirement_group, req.requirement_type, req.required_credits, req.sort_order, req.notes
FROM majors m
JOIN (
  VALUES
    ('CS', 'Core CS Courses', 'required', NULL::smallint, 10, 'Required core computer science courses.'),
    ('CS', 'Math Foundation', 'required', NULL::smallint, 20, 'Mathematics required for the major.'),
    ('CS', 'Communication and Writing', 'general_education', NULL::smallint, 30, 'Writing and communication support courses.'),
    ('CS', 'Science Support', 'support', NULL::smallint, 40, 'Laboratory science support course.'),
    ('CS', 'Upper-Level CS Electives', 'elective', 9::smallint, 50, 'Choose advanced computer science electives.'),
    ('CYB', 'Cyber Core', 'required', NULL::smallint, 10, 'Required cybersecurity core courses.'),
    ('CYB', 'Infrastructure Support', 'support', NULL::smallint, 20, 'Networking and cloud infrastructure support courses.'),
    ('CYB', 'Math and Statistics', 'required', NULL::smallint, 30, 'Mathematics and statistics for security analysis.'),
    ('CYB', 'Communication and Writing', 'general_education', NULL::smallint, 40, 'Writing and communication support courses.'),
    ('CYB', 'Security Electives', 'elective', 9::smallint, 50, 'Choose advanced security electives.')
) AS req(major_code, requirement_group, requirement_type, required_credits, sort_order, notes)
  ON req.major_code = m.code
ON CONFLICT (major_id, requirement_group) DO NOTHING;

INSERT INTO major_requirement_courses (requirement_id, course_id, is_required)
SELECT mr.id, c.id, true
FROM major_requirements mr
JOIN majors m ON m.id = mr.major_id
JOIN (
  VALUES
    ('CS', 'Core CS Courses', 'CS 101'),
    ('CS', 'Core CS Courses', 'CS 110'),
    ('CS', 'Core CS Courses', 'CS 150'),
    ('CS', 'Core CS Courses', 'CS 210'),
    ('CS', 'Core CS Courses', 'CS 220'),
    ('CS', 'Core CS Courses', 'CS 260'),
    ('CS', 'Core CS Courses', 'CS 310'),
    ('CS', 'Core CS Courses', 'CS 320'),
    ('CS', 'Core CS Courses', 'CS 330'),
    ('CS', 'Core CS Courses', 'CS 340'),
    ('CS', 'Core CS Courses', 'CS 410'),
    ('CS', 'Math Foundation', 'MATH 175'),
    ('CS', 'Math Foundation', 'MATH 221'),
    ('CS', 'Math Foundation', 'MATH 230'),
    ('CS', 'Math Foundation', 'STAT 240'),
    ('CS', 'Communication and Writing', 'ENG 101'),
    ('CS', 'Communication and Writing', 'ENG 102'),
    ('CS', 'Communication and Writing', 'COMM 130'),
    ('CS', 'Science Support', 'PHYS 121'),
    ('CYB', 'Cyber Core', 'CS 101'),
    ('CYB', 'Cyber Core', 'CS 150'),
    ('CYB', 'Cyber Core', 'CYBR 200'),
    ('CYB', 'Cyber Core', 'CYBR 210'),
    ('CYB', 'Cyber Core', 'CYBR 310'),
    ('CYB', 'Cyber Core', 'CYBR 330'),
    ('CYB', 'Infrastructure Support', 'NETW 220'),
    ('CYB', 'Infrastructure Support', 'IT 240'),
    ('CYB', 'Infrastructure Support', 'CS 320'),
    ('CYB', 'Math and Statistics', 'MATH 175'),
    ('CYB', 'Math and Statistics', 'STAT 240'),
    ('CYB', 'Communication and Writing', 'ENG 101'),
    ('CYB', 'Communication and Writing', 'ENG 102'),
    ('CYB', 'Communication and Writing', 'COMM 130')
) AS req_courses(major_code, requirement_group, course_code)
  ON req_courses.major_code = m.code
 AND req_courses.requirement_group = mr.requirement_group
JOIN courses c ON c.course_code = req_courses.course_code
ON CONFLICT (requirement_id, course_id) DO NOTHING;

COMMIT;
