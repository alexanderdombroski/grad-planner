import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const contentDir = path.join(projectRoot, 'src', 'content', 'courses')

if (!process.env.POSTGRES_URI) {
  throw new Error('Set POSTGRES_URI before running sync-courses.')
}

type CourseRow = {
  slug: string
  courseCode: string
  subjectCode: string
  courseNumber: string
  title: string
  credits: number
  description: string
  isActive: boolean
  prerequisites: Array<{
    courseCode: string
    title: string
    minimumGrade: string
    notes: string
  }>
  majorRequirements: Array<{
    majorCode: string
    majorName: string
    requirementGroup: string
    requirementType: 'required' | 'elective' | 'support' | 'general_education'
    isRequired: boolean
  }>
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URI,
})

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

async function main() {
  await mkdir(contentDir, { recursive: true })

  const existingFiles = await readdir(contentDir)
  await Promise.all(
    existingFiles
      .filter((file) => file.endsWith('.json'))
      .map((file) => rm(path.join(contentDir, file))),
  )

  const result = await pool.query<CourseRow>(`
    SELECT
      trim(both '-' from regexp_replace(lower(c.course_code), '[^a-z0-9]+', '-', 'g')) AS slug,
      c.course_code AS "courseCode",
      c.subject_code AS "subjectCode",
      c.course_number AS "courseNumber",
      c.title,
      c.credits,
      c.description,
      c.is_active AS "isActive",
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'courseCode', p.course_code,
            'title', p.title,
            'minimumGrade', cp.minimum_grade,
            'notes', cp.notes
          )
          ORDER BY p.course_code
        )
        FROM course_prerequisites cp
        JOIN courses p ON p.id = cp.prerequisite_course_id
        WHERE cp.course_id = c.id
      ), '[]'::jsonb) AS prerequisites,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'majorCode', m.code,
            'majorName', m.name,
            'requirementGroup', mr.requirement_group,
            'requirementType', mr.requirement_type,
            'isRequired', mrc.is_required
          )
          ORDER BY m.code, mr.sort_order, mr.requirement_group
        )
        FROM major_requirement_courses mrc
        JOIN major_requirements mr ON mr.id = mrc.requirement_id
        JOIN majors m ON m.id = mr.major_id
        WHERE mrc.course_id = c.id
      ), '[]'::jsonb) AS "majorRequirements"
    FROM courses c
    ORDER BY c.course_code;
  `)

  const courses = result.rows

  await Promise.all(
    courses.map(async (course) => {
      const filePath = path.join(contentDir, `${slugify(course.slug || course.courseCode)}.json`)
      await writeFile(filePath, `${JSON.stringify(course, null, 2)}\n`)
    }),
  )
}

try {
  await main()
} finally {
  await pool.end()
}
