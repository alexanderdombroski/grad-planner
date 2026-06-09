// @ts-check
import { defineConfig, envField } from 'astro/config'
import node from '@astrojs/node'
import clerk from '@clerk/astro'

export default defineConfig({
	env: {
		schema: {
			POSTGRES_URI: envField.string({ context: 'server', access: 'secret' }),
		},
	},
	integrations: [clerk()],
	adapter: node({ mode: 'standalone' }),
	output: 'server',
})
