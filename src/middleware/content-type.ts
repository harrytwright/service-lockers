import express from 'express'
import { UnsupportedMediaType } from '@hndlr/errors/src'

export function contentType(type: string) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (req.headers['content-type'] !== type) {
      return next(
        new UnsupportedMediaType(
          'Content must be ' + type + ' not ' + req.headers['content-type']
        )
      )
    }

    return next()
  }
}
