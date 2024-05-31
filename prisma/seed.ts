import * as path from 'path'
import * as fs from 'fs/promises'

import * as ini from 'ini'
import { createId } from '@paralleldrive/cuid2'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main () {
  if (process.env['NODE_ENV'] !== 'test')
    return
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
