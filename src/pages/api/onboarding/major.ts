import type { APIRoute } from 'astro'
import { saveMajorSelection } from '../../../lib/planner-db'

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const { userId } = locals.auth()

	if (!userId) {
		return new Response('Unauthorized', { status: 401 })
	}

	const formData = await request.formData()
	const majorCode = String(formData.get('majorCode') ?? '').trim()

	if (!majorCode) {
		return new Response('Missing major code', { status: 400 })
	}

	const user = await locals.currentUser()
	if (!user) {
		return new Response('Unauthorized', { status: 401 })
	}

	await saveMajorSelection(user, majorCode)

	return redirect(`/plan/classes?major=${encodeURIComponent(majorCode)}&saved=major`, 303)
}
