import { defineCommand, runMain } from 'citty'
import { commands } from './commands'

export const main = defineCommand({
  meta: {
    name: 'Crypto Map CLI',
    version: '1.0.0',
    description: 'A CLI to help with common tasks',
  },
  subCommands: commands,
})

runMain(main)
