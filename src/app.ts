import {
  http,
  useControllers,
  useMiddleware,
  BodyParser,
  NotFound,
  useErrorHandler,
} from '@harrytwright/api/dist/core'

import handler from './middleware/error-handler'
import { InfoController, HealthcheckController } from './controllers'

@http((config) => config.get('port'))
@useControllers(InfoController, HealthcheckController)
@useMiddleware(
  require('./middleware/morgan').morgan(require('@harrytwright/logger'))
)
@useMiddleware(
  require('./modules/auth/middleware/authentication').Authentication
)
@useMiddleware(require('./middleware/cors').cors)
@useMiddleware(require('./middleware/tracing').Tracing)
@useMiddleware(require('./middleware/trace').trace)
@BodyParser.json({ type: ['application/*+json', 'application/json'] })
@NotFound()
@useErrorHandler(handler)
export class App {}
