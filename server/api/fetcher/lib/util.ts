import { Currency } from '~/types/crypto-map'

export function toUtf8(str: string) {
  return decodeURIComponent(encodeURIComponent(str))
}

const supportedCurrencies = Object.values(Currency)
export function filterCurrencies(currencies: string[]): Currency[] {
  return supportedCurrencies.filter(c => currencies.includes(c.toLocaleUpperCase()))
}
