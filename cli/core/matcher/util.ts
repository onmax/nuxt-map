import { Currency } from '~/types/crypto-map'

export function toUtf8(str: string) {
  return decodeURIComponent(encodeURIComponent(str))
}

const supportedCurrencies = Object.values(Currency)
export function filterCurrencies(currencies: string[]): Currency[] {
  return supportedCurrencies.filter(c => currencies.includes(c.toLocaleUpperCase()))
}

export function partition<T>(arr: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const a: T[] = []
  const b: T[] = []
  for (const item of arr)
    (predicate(item) ? a : b).push(item)
  return [a, b]
}
