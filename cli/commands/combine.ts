import { defineCommand } from 'citty'
import { createConsola } from 'consola'
import 'dotenv/config'
import { getAuthClient } from '../core/database'
import { downloadLocations, uploadLocations } from '../core/storage'
import { dateToStr } from '../core/storage/date'

export default defineCommand({
  meta: {
    name: 'combine',
    description: 'Combines different sources of location data',
  },
  args: {
    paths: {
      type: 'string',
      description: 'The paths to combine. Separate them with a comma. For example: path1,path2,path3',
      required: true,
    },

  },
  async run(ctx) {
    const { paths } = ctx.args

    const pathsArray = paths.split(',')
    if (pathsArray.length < 2 && pathsArray.some(path => !path.endsWith('.csv'))) {
      console.error('You need to provide at least two paths')
      return
    }

    const consola = createConsola()
    consola.withTag('combine')
    consola.info(`Combining data from ${paths}`)

    const supabase = await getAuthClient()

    const locations = (await Promise.all(pathsArray.map(async path => downloadLocations(supabase, path)))).flat()

    const rootPath = pathsArray[0].split('/')[0]

    const path = `${rootPath}/combined-${dateToStr(new Date())}`
    await uploadLocations(supabase, { matched: locations, unmatched: [], path })
  },
})
