import clsTracer from 'cls-rtracer'
import { NextFunction, Request, Response } from 'express'

import type { TraceId } from 'zipkin'

export function trace(
  req: Request & { id?: string; _trace_id?: TraceId },
  res: Response,
  next: NextFunction
) {
  if (req._trace_id) {
    req.id = req._trace_id?.traceId
  } else {
    req.id = clsTracer.id() as string
  }

  return next()
}
