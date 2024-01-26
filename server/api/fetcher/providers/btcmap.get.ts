import type { BasicLocation } from '../lib/types'
import { filterCurrencies, toUtf8 } from '../lib/util'
import { Currency, Provider } from '~/types/crypto-map'

export default defineEventHandler(async () => {
  const locations = await getLocations('https://static.btcmap.org/api/v2/elements.json')
  return $fetch('/api/fetcher/match-placeid', {
    method: 'post',
    query: { provider: Provider.BtcMap },
    body: locations,
  })
})

export interface BtcMapLocation extends BasicLocation {
  category: string
  facebook: string
  instagram: string
  accepts: Currency[]
  sells: Currency[]
  image: string

  street?: string
  city?: string
  postcode?: string
  country?: string
  streetNumber?: string
  region?: string
}

async function getLocations(url: string): Promise<BtcMapLocation[]> {
  const data = await fetch(url).then(d => d.json())

  const cryptos = ['XBT', 'XMR', 'ERC20', 'ETH', 'XRP', 'Tether', 'BCH', 'LTC', 'USDT', 'BNB', 'DASH', 'NEM', 'DOGE', 'TRX', 'XBR', 'XMB', 'doge_coin', 'bitcoin', 'ZEC', 'BTG', 'dot', 'link', 'ADA', 'BTC', 'DAI', 'UBQ', 'IOTA', 'XNO', 'XLM', 'LBTC'].map(c => `currency:${c}`)
  const symbols = {
    bitcoin: 'BTC',
    doge_coin: 'DOGE',
    dot: 'DOT',
    link: 'LINK',
  }

  // @ts-expect-error type too long
  return data.map((item) => {
    const osmJson = item.osm_json
    const tags = osmJson.tags || {}

    // Filter and map currencies, checking if the value is 'yes'
    const currencies = Object.keys(tags)
      .filter(key => cryptos.includes(key) && tags[key] === 'yes')
      .map(currency => currency.split(':')[1])
      .filter(currency => cryptos.includes(currency))
      .map(currency => currency in symbols ? symbols[currency as keyof typeof symbols] : currency)

    const street = toUtf8(tags['addr:street'] || tags['addr:street:name'] || tags['addr:street:it'] || tags['addr:street:de'] || tags['addr:street:fr'] || tags['addr:street:ar'] || '')
    const city = toUtf8(tags['addr:city'] || tags['addr:village'] || tags['addr:town'] || tags['addr:city:it'] || tags['addr:city:de'] || tags['addr:city:en'] || tags['addr:city:ur'] || tags['addr:city:ar'] || tags['addr:city:fr'] || tags['addr:city:ru'] || tags['addr:city:el'] || '')
    const postcode = toUtf8(tags['addr:postcode'] || tags['addr:postal_district'] || '')
    const country = toUtf8(tags['addr:country'] || '')
    const streetNumber = toUtf8(tags['addr:streetnumber'] || tags['addr:housenumber'] || tags['addr:block_number'] || tags['addr:door'] || tags['addr:unit'] || tags['addr:unit_number'] || tags['addr:nostreet'] || '')
    const region = toUtf8(tags['addr:state'] || tags['addr:province'] || tags['addr:region'] || tags['addr:county'] || tags['addr:municipality'] || tags['addr:district'] || tags['addr:district:ar'] || '')

    const fullAddress = `${streetNumber} ${street}, ${postcode} ${city}, ${country}`.trim()
      .replace(/\s{2,}/g, ' ')
      .replace(/,\s?$/, '')

    const address = toUtf8(tags['addr:full'] || tags['addr:full:en'] || fullAddress)

    const name = toUtf8(tags.name || tags['addr:place'] || tags['addr:place:it'] || tags['addr:place:de'])

    const categoryMapping: { [key: string]: string } = {
      atm: 'cash',
      bar: 'restaurant_bar',
      cafe: 'food_drinks',
      hotel: 'hotel_lodging',
      other: 'miscellaneous',
      pub: 'restaurant_bar',
      restaurant: 'restaurant_bar',
    }

    return {
      id: item.id,
      category: toUtf8(categoryMapping[item.tags.category] || 'miscellaneous'),
      lat: osmJson.lat || osmJson.geometry?.[0].lat,
      lng: osmJson.lon || osmJson.geometry?.[0].lon,
      name,
      facebook: tags.facebook,
      instagram: tags.instagram,
      accepts: filterCurrencies(currencies),
      sells: tags.amenity === 'atm' ? [Currency.BTC] : [], // There are no ATMs that sell other currencies
      image: tags.image,
      street,
      city,
      postcode,
      country,
      streetNumber,
      region,
      address,
    } satisfies BtcMapLocation
  })
}
