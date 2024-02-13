import type { LocationSource } from '../../lib/types'
import { Currency, Provider } from '~/types/crypto-map'

export default defineEventHandler(async () => {
  const locations = await getLocations('https://maps.bitcoinjungle.app/api/list')
  return $fetch('/api/fetcher/match-placeid', {
    method: 'post',
    query: { provider: Provider.BitcoinJungle },
    body: locations,
  })
})

export interface BitcoinJungleLocation extends LocationSource {
  phone?: string
  website?: string
  description?: string
  facebook?: string
  instagram?: string
  accepts: Currency[]
}

const categoryMapping = {
  'Cafe': 'food_drinks',
  'Car wash': 'cars_bikes',
  'Delivery': 'miscellaneous',
  'Desserts & Sweets': 'food_drinks',
  'Health & Wellness': 'health_beauty',
  'Hotel & Accomodations': 'hotel_lodging',
  'Nursery and Garden Center': 'miscellaneous',
  'Organic Products': 'food_drinks',
  'Restaurant': 'restaurant_bar',
  'Retail': 'shop',
  'Surfing': 'sports_fitness',
  'Tourism Activities': 'leisure_activities',
  'Transportation': 'miscellaneous',
}
async function getLocations(url: string): Promise<BitcoinJungleLocation[]> {
  const data = await fetch(url).then(d => d.json())

  // @ts-expect-error type too long
  return data.locations.map((loc) => {
    const website = loc.website?.startsWith('http') ? loc.website : `https://${loc.website}`
    const url = URL.canParse(website) ? new URL(website) : undefined
    const facebook = url?.hostname === 'www.facebook.com' ? url.href : undefined
    const instagram = url?.hostname === 'www.instagram.com' ? url.href : undefined
    return {
      id: loc.id,
      name: loc.name,
      lat: loc.coordinates.latitude,
      lng: loc.coordinates.longitude,
      phone: loc.phone || undefined,
      website: loc.website || undefined,
      description: loc.description || undefined,
      instagram,
      facebook,
      accepts: [Currency.LBTC],
      category: loc.categories
        .map(({ name: cat }: { name: keyof typeof categoryMapping }) => categoryMapping[cat] || 'miscellaneous')
        .reduce((acc: string, curr: any) => acc === 'miscellaneous' ? curr : acc, 'miscellaneous'),
    } satisfies BitcoinJungleLocation
  })
}
