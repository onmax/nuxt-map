import { env } from 'node:process'
import type { LocationSource } from '../src/types'
import { getLocations as getCoinmapLocations } from './coinmap'
import { Provider } from '~/types/crypto-map'

export function fetchLocationsFromProvider(provider: Provider): Promise<LocationSource[]> {
  const url = new URL(env[`PROVIDER_SOURCE_${provider.toLocaleUpperCase().replaceAll(' ', '_')}`]!)
  switch (provider) {
    case Provider.Coinmap: {
      return getCoinmapLocations(url)
    }
    default: throw new Error(`Provider ${provider} is not implemented yet`)
  }
}
