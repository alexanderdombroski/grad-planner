import { Pool } from 'pg'
import { getSecret } from 'astro:env/server'

type ClerkUser = {
	id: string
	firstName?: string | null
	lastName?: string | null
	username?: string | null
	emailAddresses?: Array<{ emailAddress: string }>
}

type MajorPlanRow = {
	plan_id: string
	major_id: string
	major_code: string
	major_name: string
	catalog_year: string
	target_graduation_term: string
	status: string
	student_id: string
}

type TermCourseRow = {
	term_id: string
	term_label: string
	term_order: number
	term_year: number | null
	term_status: string
	term_notes: string | null
	course_id: string | null
	planned_credits: number | null
	course_notes: string | null
	course_code: string | null
	title: string | null
	credits: number | null
}

type MajorCourseRow = {
	requirement_id: string
	requirement_group: string
	requirement_type: string
	required_credits: number | null
	sort_order: number
	course_id: string
	course_code: string
	title: string
	credits: number
}

type MajorCourseGroup = {
	requirementId: string
	requirementGroup: string
	requirementType: string
	requiredCredits: number | null
	sortOrder: number
	courses: Array<{
		id: string
		code: string
		title: string
		credits: number
	}>
}

type StudentTerm = {
	id: string
	label: string
	order: number
	year: number | null
	status: string
	notes: string
	courses: Array<{
		id: string
		code: string
		title: string
		credits: number
		plannedCredits: number
		notes: string
	}>
}

type ActivePlanner = {
	studentId: string
	planId: string
	majorId: string
	majorCode: string
	majorName: string
	catalogYear: string
	targetGraduationTerm: string
	status: string
	terms: StudentTerm[]
}

const defaultTermTemplates = [
	{ label: 'Fall 2026', order: 1, year: 2026, status: 'current' },
	{ label: 'Spring 2027', order: 2, year: 2027, status: 'planned' },
	{ label: 'Summer 2027', order: 3, year: 2027, status: 'planned' },
	{ label: 'Fall 2027', order: 4, year: 2027, status: 'planned' },
] as const

let pool: Pool | null = null

function getPool() {
	const connectionString = getSecret('POSTGRES_URI')

	if (!connectionString) {
		throw new Error('POSTGRES_URI is not set.')
	}

	if (!pool) {
		pool = new Pool({ connectionString })
	}

	return pool
}

async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
	return getPool().query<T>(text, params)
}

function getDisplayName(user: ClerkUser) {
	return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Student'
}

function getEmail(user: ClerkUser) {
	return user.emailAddresses?.[0]?.emailAddress ?? null
}

export function getDefaultTermTemplates() {
	return [...defaultTermTemplates]
}

export async function ensureStudent(user: ClerkUser) {
	const displayName = getDisplayName(user)
	const email = getEmail(user)
	const result = await query<{ id: string }>(
		`
			INSERT INTO students (clerk_user_id, display_name, email)
			VALUES ($1, $2, $3)
			ON CONFLICT (clerk_user_id)
			DO UPDATE SET
				display_name = EXCLUDED.display_name,
				email = EXCLUDED.email
			RETURNING id
		`,
		[user.id, displayName, email],
	)

	return result.rows[0]
}

export async function getMajorByCode(majorCode: string) {
	const result = await query<{
		id: string
		code: string
		name: string
		description: string
	}>(
		`SELECT id, code, name, description
		 FROM majors
		 WHERE code = $1`,
		[majorCode],
	)

	return result.rows[0] ?? null
}

export async function getActivePlanner(userId: string): Promise<ActivePlanner | null> {
	const result = await query<MajorPlanRow>(
		`
			SELECT
				sp.id AS plan_id,
				sp.major_id,
				m.code AS major_code,
				m.name AS major_name,
				sp.catalog_year,
				sp.target_graduation_term,
				sp.status,
				s.id AS student_id
			FROM students s
			JOIN student_plans sp ON sp.student_id = s.id
			JOIN majors m ON m.id = sp.major_id
			WHERE s.clerk_user_id = $1
			  AND sp.status = 'active'
			ORDER BY sp.updated_at DESC
			LIMIT 1
		`,
		[userId],
	)

	const planner = result.rows[0]
	if (!planner) {
		return null
	}

	return {
		studentId: planner.student_id,
		planId: planner.plan_id,
		majorId: planner.major_id,
		majorCode: planner.major_code,
		majorName: planner.major_name,
		catalogYear: planner.catalog_year,
		targetGraduationTerm: planner.target_graduation_term,
		status: planner.status,
		terms: [],
	}
}

export async function getPlannerForUser(userId: string): Promise<ActivePlanner | null> {
	const planner = await getActivePlanner(userId)
	if (!planner) {
		return null
	}

	const termResult = await query<TermCourseRow>(
		`
			SELECT
				st.id AS term_id,
				st.term_label,
				st.term_order,
				st.term_year,
				st.status AS term_status,
				st.notes AS term_notes,
				stc.course_id,
				stc.planned_credits,
				stc.notes AS course_notes,
				c.course_code,
				c.title,
				c.credits
			FROM student_terms st
			LEFT JOIN student_term_courses stc ON stc.student_term_id = st.id
			LEFT JOIN courses c ON c.id = stc.course_id
			WHERE st.plan_id = $1
			ORDER BY st.term_order, c.course_code NULLS LAST
		`,
		[planner.planId],
	)

	const termMap = new Map<string, StudentTerm>()

	for (const row of termResult.rows) {
		if (!termMap.has(row.term_id)) {
			termMap.set(row.term_id, {
				id: row.term_id,
				label: row.term_label,
				order: row.term_order,
				year: row.term_year,
				status: row.term_status,
				notes: row.term_notes ?? '',
				courses: [],
			})
		}

		if (row.course_id && row.course_code && row.title && row.credits !== null) {
			termMap.get(row.term_id)?.courses.push({
				id: row.course_id,
				code: row.course_code,
				title: row.title,
				credits: row.credits,
				plannedCredits: row.planned_credits ?? row.credits,
				notes: row.course_notes ?? '',
			})
		}
	}

	return {
		...planner,
		terms: [...termMap.values()],
	}
}

export async function getMajorCourseGroups(majorCode: string): Promise<MajorCourseGroup[]> {
	const result = await query<MajorCourseRow>(
		`
			SELECT
				mr.id AS requirement_id,
				mr.requirement_group,
				mr.requirement_type,
				mr.required_credits,
				mr.sort_order,
				c.id AS course_id,
				c.course_code,
				c.title,
				c.credits
			FROM majors m
			JOIN major_requirements mr ON mr.major_id = m.id
			JOIN major_requirement_courses mrc ON mrc.requirement_id = mr.id
			JOIN courses c ON c.id = mrc.course_id
			WHERE m.code = $1
			  AND c.is_active = true
			ORDER BY mr.sort_order, c.course_code
		`,
		[majorCode],
	)

	const groups = new Map<string, MajorCourseGroup>()

	for (const row of result.rows) {
		if (!groups.has(row.requirement_id)) {
			groups.set(row.requirement_id, {
				requirementId: row.requirement_id,
				requirementGroup: row.requirement_group,
				requirementType: row.requirement_type,
				requiredCredits: row.required_credits,
				sortOrder: row.sort_order,
				courses: [],
			})
		}

		groups.get(row.requirement_id)?.courses.push({
			id: row.course_id,
			code: row.course_code,
			title: row.title,
			credits: row.credits,
		})
	}

	return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}

async function getMajorRequirementCourseIds(majorCode: string) {
	const result = await query<{ course_code: string }>(
		`
			SELECT c.course_code
			FROM majors m
			JOIN major_requirements mr ON mr.major_id = m.id
			JOIN major_requirement_courses mrc ON mrc.requirement_id = mr.id
			JOIN courses c ON c.id = mrc.course_id
			WHERE m.code = $1
		`,
		[majorCode],
	)

	return new Set(result.rows.map((row) => row.course_code))
}

async function archiveConflictingPlans(studentId: string, keepPlanId: string) {
	await query(
		`
			UPDATE student_plans
			SET status = 'archived',
				updated_at = now()
			WHERE student_id = $1
			  AND id <> $2
			  AND status = 'active'
		`,
		[studentId, keepPlanId],
	)
}

async function ensurePlan(studentId: string, majorId: string, majorCode: string) {
	const result = await query<{
		id: string
		student_id: string
		major_id: string
		catalog_year: string
		target_graduation_term: string
		status: string
	}>(
		`
			INSERT INTO student_plans (
				student_id,
				major_id,
				catalog_year,
				target_graduation_term,
				status
			)
			VALUES ($1, $2, '2026-2027', 'Fall 2027', 'active')
			ON CONFLICT (student_id, major_id, catalog_year)
			DO UPDATE SET
				target_graduation_term = EXCLUDED.target_graduation_term,
				status = 'active',
				updated_at = now()
			RETURNING id, student_id, major_id, catalog_year, target_graduation_term, status
		`,
		[studentId, majorId],
	)

	const plan = result.rows[0]
	await archiveConflictingPlans(studentId, plan.id)
	await ensureDefaultTerms(plan.id, majorCode)
	return plan
}

async function ensureDefaultTerms(planId: string, majorCode: string) {
	const templates = getDefaultTermTemplates()
	for (const template of templates) {
		await query(
			`
				INSERT INTO student_terms (plan_id, term_label, term_order, term_year, status)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (plan_id, term_order)
				DO UPDATE SET
					term_label = EXCLUDED.term_label,
					term_year = EXCLUDED.term_year,
					status = EXCLUDED.status
			`,
			[planId, template.label, template.order, template.year, template.status],
		)
	}

	return majorCode
}

export async function saveMajorSelection(user: ClerkUser, majorCode: string) {
	const major = await getMajorByCode(majorCode)
	if (!major) {
		throw new Error(`Unknown major code: ${majorCode}`)
	}

	const student = await ensureStudent(user)
	await ensurePlan(student.id, major.id, major.code)

	return {
		major,
		studentId: student.id,
	}
}

export async function saveTermSelection(user: ClerkUser, params: {
	majorCode: string
	termLabel: string
	termOrder: number
	termYear?: number | null
	notes?: string
	courseCodes: string[]
}) {
	const major = await getMajorByCode(params.majorCode)
	if (!major) {
		throw new Error(`Unknown major code: ${params.majorCode}`)
	}

	const student = await ensureStudent(user)
	const plan = await ensurePlan(student.id, major.id, major.code)
	const termResult = await query<{
		id: string
	}>(
		`
			INSERT INTO student_terms (plan_id, term_label, term_order, term_year, status, notes)
			VALUES ($1, $2, $3, $4, 'planned', COALESCE($5, ''))
			ON CONFLICT (plan_id, term_order)
			DO UPDATE SET
				term_label = EXCLUDED.term_label,
				term_year = EXCLUDED.term_year,
				notes = EXCLUDED.notes
			RETURNING id
		`,
		[plan.id, params.termLabel, params.termOrder, params.termYear ?? null, params.notes ?? ''],
	)

	const termId = termResult.rows[0].id
	const allowedCourses = await getMajorRequirementCourseIds(major.code)
	const uniqueCodes = [...new Set(params.courseCodes)].filter((courseCode) => allowedCourses.has(courseCode))

	await query(`DELETE FROM student_term_courses WHERE student_term_id = $1`, [termId])

	if (uniqueCodes.length > 0) {
		const courseResult = await query<{
			id: string
			course_code: string
			credits: number
		}>(
			`
				SELECT id, course_code, credits
				FROM courses
				WHERE course_code = ANY($1::text[])
				  AND is_active = true
			`,
			[uniqueCodes],
		)

		for (const course of courseResult.rows) {
			await query(
				`
					INSERT INTO student_term_courses (
						student_term_id,
						course_id,
						status,
						planned_credits,
						notes
					)
					VALUES ($1, $2, 'planned', $3, '')
					ON CONFLICT (student_term_id, course_id)
					DO UPDATE SET
						status = 'planned',
						planned_credits = EXCLUDED.planned_credits
				`,
				[termId, course.id, course.credits],
			)
		}
	}

	return {
		termId,
		planId: plan.id,
		majorCode: major.code,
	}
}

export async function getPlannerState(userId: string, fallbackMajorCode?: string | null) {
	const planner = await getPlannerForUser(userId)
	if (planner) {
		const groups = await getMajorCourseGroups(planner.majorCode)
		return {
			planner,
			majorCode: planner.majorCode,
			majorName: planner.majorName,
			groups,
		}
	}

	if (fallbackMajorCode) {
		const major = await getMajorByCode(fallbackMajorCode)
		if (major) {
			const groups = await getMajorCourseGroups(major.code)
			return {
				planner: null,
				majorCode: major.code,
				majorName: major.name,
				groups,
			}
		}
	}

	return {
		planner: null,
		majorCode: null,
		majorName: null,
		groups: [],
	}
}
