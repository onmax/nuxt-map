// The format of the names cannot have special characters. We remove the colons from the date
// replace only the last two - with colons
export const dateToStr = (date: Date): string => date.toISOString().replace(/:/g, '-')
export function strToDate(str: string): Date {
  const [y, mon, date, h, m, s, ms] = str.split(/\D+/).map(Number)
  return new Date(Date.UTC(y, mon - 1, date, h, m, s, ms))
}
