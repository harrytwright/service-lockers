// require('leaked-handles')

import path from 'path'
import fs from 'fs/promises'

const toDotNot = (
  input: Record<any, any>,
  parentKey?: string
): Record<string, any> =>
  Object.keys(input || {}).reduce((acc, key) => {
    const value = input[key]
    const outputKey = parentKey ? `${parentKey}_${key}` : `${key}`

    // NOTE: remove `&& (!Array.isArray(value) || value.length)` to exclude empty arrays from the output
    if (
      value &&
      typeof value === 'object' &&
      (!Array.isArray(value) || value.length)
    )
      return { ...acc, ...toDotNot(value, outputKey.toUpperCase()) }

    return {
      ...acc,
      [outputKey]: isNaN(parseInt(value)) ? value : parseInt(value),
    }
  }, {})

module.exports = async function () {
  require('dotenv').config({ debug: false, override: false })

  // Check if the file exists
  try {
    await fs.stat(path.join(process.cwd(), 'generated.ini'))
  } catch (err) {
    return
  }

  const ini = require('ini')
  process.env = {
    ...process.env,
    ...toDotNot(
      ini.parse(
        (
          await fs.readFile(path.join(process.cwd(), 'generated.ini'))
        ).toString()
      )
    ),
  }
}
