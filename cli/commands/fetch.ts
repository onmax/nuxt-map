import { defineCommand } from 'citty'
import { createConsola } from 'consola'
import { fetchLocationsFromProvider } from '@/cli/core/fetcher/providers'
import 'dotenv/config'
import { Provider } from '@/types/crypto-map'
import { getAuthClient, sanitizeProviderName } from '@/cli/core/database'
import { uploadUnprocessedLocations } from '@/cli/core/storage'
import { dateToStr } from '@/cli/core/storage/date'

export default defineCommand({
  meta: {
    name: 'fetch',
    description: 'Fetches data from different sources',
  },
  args: {
    provider: {
      type: 'string',
      description: `The provider to fetch data from. Available providers: ${Object.values(Provider).join(', ')}`,
      required: true,
    },
    batchSize: {
      type: 'string',
      description: 'The size of the batch to process',
      default: '100',
    },
    debug: {
      type: 'boolean',
      description: 'Enable debug mode',
      default: false,
    },
    offset: {
      type: 'string',
      description: 'The offset to start from. This is the last batch that was processed. For example, if the previous run was interrupted at batch 5, set the offset to 4.',
      default: '0',
    },
    ts: {
      type: 'string',
      description: 'In Supabase, the timestamp to use for the root path. If not provided, the current timestamp is used.',
      default: '',
    },
  },
  async run(ctx) {
    const { debug, provider, batchSize: batchSizeStr, offset: offsetStr } = ctx.args as { debug: boolean, provider: Provider, batchSize: string, offset: string, ts: string }

    const batchSize = Number.parseInt(batchSizeStr, 10)
    const offset = Number.parseInt(offsetStr, 10)
    if (Number.isNaN(batchSize || offset)) {
      console.error(`Invalid batch size: ${batchSizeStr} or offset: ${offsetStr}`)
      return
    }

    const consola = createConsola({ level: debug ? 5 : 3 })
    consola.withTag('fetch')
    consola.info(`Fetching data for ${provider}`)

    // Check if the provider is valid
    if (!Object.values(Provider).includes(provider as Provider)) {
      consola.error(`Invalid provider: ${provider}. Make sure it's one of ${Object.values(Provider).join(', ')}`)
      return
    }

    const supabase = await getAuthClient()
    consola.debug('Supabase Client authenticated')

    const locations = await fetchLocationsFromProvider(provider)
    consola.info(`Fetched ${locations.length} locations for ${provider}`)
    if (locations.length === 0) {
      consola.warn('No locations found.')
      return
    }
    consola.debug(`The first element of the list looks like ${JSON.stringify(locations.at(0), null, 2)}`)

    const ts = dateToStr(new Date())
    const path = `${sanitizeProviderName(provider)}/fetched/`
    const promises = await uploadUnprocessedLocations(supabase, { locations, path, name: ts })
    if (promises.some(({ status }) => status === 'rejected')) {
      consola.error('Error uploading some files to Supabase')
      consola.error(promises)
      return
    }
    consola.success('All data uploaded to Supabase Storage.')
  },
})
