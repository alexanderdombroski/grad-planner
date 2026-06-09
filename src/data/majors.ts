export const majors = [
	{
		code: 'CS',
		name: 'Computer Science',
		description: 'Software, systems, algorithms, and computing theory.',
		routeHint: 'Plan for required CS core courses, math, and capstone work.',
	},
	{
		code: 'CYB',
		name: 'Cybersecurity',
		description: 'Network defense, secure systems, and digital forensics.',
		routeHint: 'Plan for security core courses, network support, and electives.',
	},
] as const

export type Major = (typeof majors)[number]
