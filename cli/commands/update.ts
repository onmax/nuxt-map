import { defineCommand } from 'citty'
import { createConsola } from 'consola'
import { fetchLocationsFromProvider } from '@/cli/core/fetcher/providers'
import 'dotenv/config'
import { Category, Provider } from '@/types/crypto-map'
import { getAuthClient, sanitizeProviderName } from '@/cli/core/database'
import { downloadLocations, downloadUnprocessedLocations } from '@/cli/core/storage'
import { Currency } from '~/types/crypto-map'

export default defineCommand({
  meta: {
    name: 'update',
    description: 'Updates data from fetched csv',
  },
  args: {
    provider: {
      type: 'string',
      description: `The provider to fetch data from. Available providers: ${Object.values(Provider).join(', ')}`,
      required: true,
    },
    debug: {
      type: 'boolean',
      description: 'Enable debug mode',
      default: false,
    },
    path: {
      type: 'string',
      description: 'The path to the csv file to update.',
      required: false,
    },
  },
  async run(ctx) {
    const { debug, provider, path } = ctx.args as { debug: boolean, provider: Provider, path: string }

    const consola = createConsola({ level: debug ? 5 : 3 })
    consola.withTag('update')
    consola.info(`Fetching data for ${provider}`)

    const supabase = await getAuthClient()
    const rootPath = `${sanitizeProviderName(provider)}`

    const locationsPath = path || `${rootPath}/combined/combined.csv`
    const locations = await downloadLocations(supabase, locationsPath)
    consola.info(`Fetched ${locations.length} locations from ${locationsPath}`)

    const fetchedPath = `${rootPath}/fetched/latest.csv`
    const fetched = await downloadUnprocessedLocations(supabase, fetchedPath)
    if (!fetched || fetched.length === 0) {
      consola.info('Fetched locations is empty. Nothing to update.')
      return
    }
    consola.info(`Fetched ${fetched.length} locations from ${fetchedPath}`)

    const newLocations = locations
      .filter(l => fetched.find(f => f.id === l.source.id))
      .map((l) => {
        const f = fetched.find(f => f.id === l.source.id)
        if (!f)
          return l
        const accepts = f.accepts.filter(c => c in Currency)
        const sells = f.sells?.filter(c => c in Currency)
        if (f.category as unknown === 'atm')
          l.source.category = Category.Cash
        const provider = f.provider
        return { ...l, source: { ...l.source, accepts, sells, provider } }
      })
    if (newLocations.length === 0) {
      consola.info('Nothing to update')
      return
    }
    consola.info(`Updated ${newLocations.length} locations`)
    consola.log(newLocations.find(l => l.source.category === Category.Cash))
  },
})
