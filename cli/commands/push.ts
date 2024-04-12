import { defineCommand } from 'citty'
import { createConsola } from 'consola'
import 'dotenv/config'
import { getAuthClient, saveToDatabase } from '../core/database'
import { downloadLocations, uploadLocations } from '../core/storage'
import { dateToStr } from '../core/storage/date'
import { Provider } from '~/types/crypto-map'

export default defineCommand({
  meta: {
    name: 'push',
    description: 'Pushes data to the database',
  },
  args: {
    path: {
      type: 'string',
      description: 'The source of the data',
      required: true,
    },
    provider: {
      type: 'string',
      description: `The provider to fetch data from. Available providers: ${Object.values(Provider).join(', ')}`,
      required: true,
    },
  },
  async run(ctx) {
    const { path, provider } = ctx.args as { provider: Provider, path: string }

    const consola = createConsola()
    consola.withTag('combine')
    consola.info(`Pushing data from ${path} for ${provider}`)

    const supabase = await getAuthClient()
    const locations = await downloadLocations(supabase, path)

    const error = await saveToDatabase(supabase, locations, provider)
    if (error)
      consola.error(`Error saving data to the database: ${JSON.stringify(error)}`)
  },
})
