import Ajv, { ValidateFunction } from 'ajv'
import express from 'express'
import { UnprocessableEntity } from '@hndlr/errors'

const ajv = new Ajv()

type Schemas = string

export function validateBody(schema: Schemas & string) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const validator = compile(schema)
    const validated = validator(req.body)

    if (validated) {
      return next()
    } else {
      const errors = validator.errors!.map((el) =>
        Object.assign(new Error(el.message), { meta: el })
      )
      return next(new UnprocessableEntity('Failed to validator body', errors))
    }
  }
}

function compile(schema: Schemas & string): ValidateFunction {
  switch (schema) {
    default:
      throw new Error('No JSON Schema')
  }
}
