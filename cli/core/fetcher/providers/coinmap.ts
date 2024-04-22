import type { LocationSource } from '~/cli/core/types'
import { Currency } from '~/types/crypto-map'

interface CoinmapLocation extends LocationSource {
  name: string
  created_on: number
  geolocation_degrees: string
  accepts: Currency[]
  coinmapCategory: string
}

interface CoinmapVenue {
  id: number
  lat: number
  lon: number
  category: string
  name: string
  created_on: number
  geolocation_degrees: string
  city: string
  country: string
  postcode: string
  email: string
  state: string
  phone: string
  updated_on: number
  website: string
  logo_url: string
  name_ascii: string
  facebook: string
  description: string
  street: string
  twitter: string
  src_id: string
  houseno: string
  instagram: string
  promoted_until: string
  premium_until: string
  atm_operator_name: string
  coins: string[]
  user: {
    userhash: string
  }
}

export async function getLocations(url: URL): Promise<CoinmapLocation[]> {
  const limit = 5000
  let offset = 0
  url.searchParams.set('limit', limit.toString())
  url.searchParams.set('offset', offset.toString())
  url.searchParams.set('mode', 'full')

  const data: CoinmapVenue[] = []
  let response: { venues: CoinmapVenue[] }
  do {
    response = await fetch(url).then(d => d.json())
    data.push(...response.venues)
    url.searchParams.set('offset', data.length.toString())
    offset += limit
  } while (response.venues.length === limit)

  return data.map((venue: CoinmapVenue) => {
    const id = venue.id
    const name = decodeURIComponent(encodeURI(venue.name))
    const lat = venue.lat
    const lng = venue.lon
    const coinmapCategory = decodeURIComponent(encodeURI(venue.category))
    const created_on = venue.created_on
    const geolocation_degrees = venue.geolocation_degrees
    const coins = venue.coins.map((c) => {
      if (c === 'USDC')
        return Currency.USDC_on_POLYGON
      if (c === 'LN')
        return Currency.LBTC
      return c as Currency
    })
    const accepts = venue.coins.length ? coins : [Currency.BTC]
    const sells = venue.category === 'atm' ? accepts : []
    const provider = `Coinmap${venue.atm_operator_name ? `/${venue.atm_operator_name}` : ''}`
    return { id, name, lat, lng, accepts, coinmapCategory, created_on, geolocation_degrees, provider, sells } satisfies CoinmapLocation
  })
}
