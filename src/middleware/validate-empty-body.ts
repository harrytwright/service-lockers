import { BadRequest } from '@hndlr/errors'
import express from 'express'

export function validateEmptyBody() {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // For an annoying reason bodyParser sets body as {} when it's passed an empty body
    if (!req.headers['content-type'] && Object.keys(req.body).length === 0) {
      return next(new BadRequest('Body should be a JSON object'))
    }

    return next()
  }
}
