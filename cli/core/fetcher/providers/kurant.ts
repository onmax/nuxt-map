import type { FetcherResult, LocationSource } from '../src/types'
import { fetcher } from '../src'
import { getAuthClient } from '../src/database'
import { Provider } from '~/types/crypto-map'

const PROVIDER = Provider.Kurant

export async function fetchKurant(): Promise<FetcherResult> {
  const supabaseClient = await getAuthClient()
  // const locations = await getLocations(useRuntimeConfig().providersSources[PROVIDER])
  const locations: LocationSource[] = []
  const res = await fetcher(locations, PROVIDER, supabaseClient)
  return res
}

// interface KurantCSV {
//   'Country': string
//   'City': string
//   'Location Name': string
//   'Address': string
//   'Open hours': string
// }

// interface KurantLocation extends Pick<LocationSource, 'name' | 'address' | 'sells' | 'id' | 'accepts'> {
//   country: string
//   city: string
//   openHours: string
// }

// async function getLocations(content: string) {
//   const csv = parse(content, { output: 'objects' }) as unknown as KurantCSV[]

//   const randomId = () => Math.random().toString(36).substring(7)

//   const locationsSellingLbtc = ['Forchheimergasse 30A/4/5, Wien, 1230, Austria', 'Griesgasse 10, 8020 Graz, Austria']
//   function getSells(c: KurantCSV) {
//     if (locationsSellingLbtc.includes(c.Address))
//       return [Currency.BTC, Currency.LBTC]
//     return [Currency.BTC, Currency.ETH, Currency.LTC]
//   }

//   return csv.map<KurantLocation>(c => ({
//     name: c['Location Name'],
//     address: c.Address,
//     country: c.Country,
//     city: c.City,
//     openHours: c['Open hours'],
//     sells: getSells(c),
//     id: `${c['Location Name']}-${randomId()}`,
//     accepts: [],
//   }))
// }
