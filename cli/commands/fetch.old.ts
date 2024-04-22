import { defineCommand } from 'citty'
import { createConsola } from 'consola'
import { fetchLocationsFromProvider } from '~/cli/core/fetcher/providers'
import 'dotenv/config'
import { Provider } from '~/types/crypto-map'
import { getAuthClient, sanitizeProviderName, saveToDatabase } from '~/cli/core/database'
import { uploadLocations } from '~/cli/core/storage'
import { confirmBatchProcessing, getStats, processBatch } from '~/cli/core/matcher/'
import { dateToStr } from '~/cli/core/storage/date'
import type { LocationCandidates } from '~/cli/core/types'

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

    const allMatched: LocationCandidates[] = []
    const allUnmatched: LocationCandidates[] = []

    const ts = dateToStr(new Date())
    const rootPath = `${sanitizeProviderName(provider)}/${ts}`

    const batchesCount = Math.ceil(locations.length / batchSize)
    consola.info(`Matching ${locations.length} locations in ${batchesCount} batches of ${batchSize} locations each.`)

    let index = offset * batchSize
    let currentBatch = offset + 1

    if (offset > 0)
      consola.warn(`Skipping the first ${currentBatch} batches, which contain ${index} locations.`)

    try {
      while (index < locations.length) {
        const confirmed = await confirmBatchProcessing(consola, currentBatch, batchesCount)
        if (!confirmed)
          return

        const batch = locations.slice(index, index + batchSize)
        const { matched, unmatched } = await processBatch(batch)

        allMatched.push(...matched)
        allUnmatched.push(...unmatched)

        const stats = getStats({ matched, unmatched })
        consola.info(`Total: ${stats.total} |  ${stats.distribution.map(({ state, count, percentage }) => `${state}: ${count} (${percentage}%)`).join(' | ')}`)

        const path = `${rootPath}/part-${currentBatch}`

        await uploadLocations(supabase, { matched, unmatched, path })

        consola.success(`Batch uploaded to ${path} uploaded to Supabase.`)

        currentBatch++
        index += batchSize
      }
    }
    catch (err) {
      consola.error('Error while processing batch', JSON.stringify(err))
      consola.info(`But no worries, we have uploaded the data to Supabase in parts. You can continue from where you left off by running the command again setting an offset.`)
    }

    const stats = getStats({ matched: allMatched, unmatched: allUnmatched })
    const statsInline = stats.distribution.map(({ state, count, percentage }) => `${state}: ${count} (${percentage}%)`).join(' | ')
    consola.info(`Matching completed. Total: ${allMatched.length} matched | ${allUnmatched.length} unmatched. ${stats.total} total. ${statsInline}`)

    if (allMatched.length === 0 && allUnmatched.length === 0) {
      consola.warn('No locations found.')
      return
    }

    const path = `${rootPath}/all`
    const { matchedUrl, unmatchedUrl } = await uploadLocations(supabase, { matched: allMatched, unmatched: allUnmatched, path })
    consola.success('All data uploaded to Supabase Storage.')

    // TODO Handle error case
    await saveToDatabase(supabase, allMatched)
    consola.success('All matched data saved to Supabase Database.')

    consola.info(JSON.stringify({ matchedUrl, unmatchedUrl }, null, 2))
  },
})
