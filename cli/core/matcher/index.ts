import type { ConsolaInstance } from 'consola'
import { colorize } from 'consola/utils'
import { MatchState } from '../types'
import type { LocationCandidates, LocationSource } from '../types'
import { getCandidates } from '../fetcher/google-maps-api'
import { partition } from '../fetcher/util'
import { classifyByStringScore } from './string-score'
import { classifyByGeolocation } from './geo-score'

interface MatchingResult {
  matched: LocationCandidates[]
  unmatched: LocationCandidates[]
}

// function* processBatches(locations: LocationSource[], batchSize: number): Generator<LocationSource[], void, unknown> {
//   let index = 0
//   while (index < locations.length) {
//     yield locations.slice(index, index + batchSize)
//     index += batchSize
//   }
// }

// export function* match(locations: LocationSource[], batchSize: number): Generator<MatchingResult & { distribution: object }, void, unknown> {
//   let index = 0
//   let currentBatch = 0

//   while (index < locations.length) {
//     const batch = locations.slice(index, index + batchSize)
//     index += batchSize
//     currentBatch++

//     // consola.info(`Processing batch ${currentBatch}/${batchesCount}`)
//     const confirmed = yield // Yield control back to caller to await confirmation

//     if (!confirmed)
//       break

//     // consola.debug(`Processing batch ${currentBatch}/${batchesCount}`)
//     const batchResult = await processBatch(batch, consola) // Assume processBatch is defined elsewhere

//     const distribution = getStats(batchResult) // Assume getStats is defined elsewhere
//     // consola.info('Batch distribution:', distribution)

//     yield { matched: batchResult.matched, unmatched: batchResult.unmatched, distribution }
//   }
// }

// export async function match(locations: LocationSource[], { consola }: { consola: ConsolaInstance }): Promise<MatchingResult & { distribution: object }> {
//   const batchesCount = Number.parseFloat((locations.length / BATCH_SIZE).toFixed(0))
//   consola.info(`Matching ${locations.length} locations in ${batchesCount} batches of ${BATCH_SIZE} locations each.`)

//   const matched: LocationCandidates[] = []
//   const unmatched: LocationCandidates[] = []
//   const batchProcessor = processBatches(locations, BATCH_SIZE)
//   let batch = batchProcessor.next()
//   let currentBatch = 0

//   // We are using a try-catch block to catch any error that might occur while processing a batch.
//   // It is an expensive operation to fetch the data, so we want to save the fetched data in case of an error.
//   try {
//     while (!batch.done) {
//       consola.info(`Processing batch ${currentBatch}/${batchesCount}`)
//       const confirmed = await confirmBatchProcessing(consola)
//       if (!confirmed)
//         break

//       currentBatch++
//       consola.debug(`Processing batch ${currentBatch}/${batchesCount}`)
//       const batchResult = await processBatch(batch.value, { consola })

//       const distribution = getStats(batchResult)
//       consola.info('Batch distribution:', distribution)

//       batch = batchProcessor.next()
//       matched.push(...batchResult.matched)
//       unmatched.push(...batchResult.unmatched)
//     }
//   }
//   catch (e) {
//     consola.error('An error occurred while processing the batch. Do not worry, the fetched data will be saved. The error was:', e)
//   }

//   const distribution = getStats({ matched, unmatched })
//   return { matched, unmatched, distribution }
// }

export async function processBatch(locations: LocationSource[]): Promise<MatchingResult> {
  const candidates = await getCandidates(locations)
  const [withCandidates, noCandidates] = partition(candidates, c => c.state !== MatchState.NoCandidates)

  classifyByGeolocation(withCandidates)
  const [geoMatched, geoUnmatched] = partition(withCandidates, c => c.state === MatchState.GeoMatch)

  classifyByStringScore(geoUnmatched)
  const [stringMatched, stringUnmatched] = partition(geoUnmatched, c => c.state === MatchState.StringMatch)

  const unmatched = [...noCandidates, ...geoUnmatched, ...stringUnmatched] as LocationCandidates[]
  const matched = [...geoMatched, ...stringMatched] as LocationCandidates[]

  return { matched, unmatched }
}

export async function confirmBatchProcessing(consola: ConsolaInstance, batchIndex: number, totalBatches: number): Promise<boolean> {
  const answer = await consola.prompt(`Do you want to proceed with the next batch processing? (${batchIndex} / ${totalBatches})`, { options: ['Yes', 'No'] as const, type: 'select' })
  if (answer === 'No') {
    const answer2 = await consola.prompt(`${colorize('bgRed', 'Are you sure?')} ${colorize('gray', 'The data already fetched will be pushed to Supabase')}`, { options: ['Yes', 'No'] as const, type: 'select' })
    if (answer2 === 'Yes') {
      consola.warn(colorize('yellow', 'Batch processing canceled by the user.'))
      return false
    }
    return confirmBatchProcessing(consola, batchIndex, totalBatches)
  }
  return true
}

export function getStats({ matched, unmatched }: MatchingResult) {
  const states = matched.map(m => m.state).concat(unmatched.map(u => u.state))
  const distribution = [...new Set(states)].map((state) => {
    const count = states.filter(s => s === state).length
    return { state, count, percentage: p(count, states.length) }
  })
  return { total: states.length, distribution }
}

function p(n1: number, n2: number): string {
  return `${((n1 / n2) * 100).toFixed(2)}%`
}
