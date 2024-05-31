import { registerMiddleware } from '@harrytwright/api/dist/core'

export const cors = registerMiddleware('cors', function () {
  const cors = require('cors')
  return cors({
    origin: this.config.get('cors') || '*',
    methods: 'GET,HEAD',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
})
