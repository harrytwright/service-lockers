import clsTracer from 'cls-rtracer'
import { createId } from '@paralleldrive/cuid2'
import zipkinTracer from 'zipkin-instrumentation-express'
import { registerMiddleware } from '@harrytwright/api/dist/core'

import { Zipkin } from '../telemetry/zipkin'

const idFactory = () => createId()

const defaultMiddleware = clsTracer.expressMiddleware({
  useHeader: true,
  headerName: 'X-SESSION-TOKEN',
  requestIdFactory: idFactory,
})

export const Tracing = registerMiddleware(
  'tracing',
  function (zipkin) {
    if (!zipkin.tracer) {
      return defaultMiddleware
    }

    return zipkinTracer.expressMiddleware({
      tracer: zipkin.tracer,
      port: this.config.get('port'),
    })
  },
  Zipkin
)
