import type { APIRoute } from 'astro'
import { saveTermSelection } from '../../../lib/planner-db'

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const { userId } = locals.auth()

	if (!userId) {
		return new Response('Unauthorized', { status: 401 })
	}

	const formData = await request.formData()
	const majorCode = String(formData.get('majorCode') ?? '').trim()
	const termLabel = String(formData.get('termLabel') ?? '').trim()
	const termOrder = Number(formData.get('termOrder'))
	const termYearValue = formData.get('termYear')
	const notes = String(formData.get('termNotes') ?? '').trim()
	const courseCodes = formData
		.getAll('courseCodes')
		.map((value) => String(value).trim())
		.filter(Boolean)

	if (!majorCode || !termLabel || Number.isNaN(termOrder)) {
		return new Response('Missing term data', { status: 400 })
	}

	const user = await locals.currentUser()
	if (!user) {
		return new Response('Unauthorized', { status: 401 })
	}

	const termYear = termYearValue ? Number(termYearValue) : null
	await saveTermSelection(user, {
		majorCode,
		termLabel,
		termOrder,
		termYear: Number.isNaN(termYear) ? null : termYear,
		notes,
		courseCodes,
	})

	return redirect(`/plan/classes?major=${encodeURIComponent(majorCode)}&saved=${encodeURIComponent(termLabel)}`, 303)
}
