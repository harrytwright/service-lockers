import express, { Handler } from 'express'
import { BadRequest } from '@hndlr/errors'
import { isCuid } from '@paralleldrive/cuid2'

export type BaseParams = {}

export type Validator<P extends BaseParams> = (
  key: keyof P,
  value: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => true | Error

export function validateOptionsParams<P extends BaseParams>(
  ...keys: (keyof P)[]
): Handler {
  return validateOptionsParamsWithCustomValidator(validator, ...keys)
}

/**
 * Allow for custom validations to be added, where CUID and not the base for each
 * path parameter
 * */
export function validateOptionsParamsWithCustomValidator<P extends BaseParams>(
  validator: Validator<P>,
  ...keys: (keyof P)[]
) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    for (const key of keys) {
      const value = (req.params as P)[key]

      const validate = validator(key, value, req, res, next)
      if (validate instanceof Error) return next(validate)
    }

    return next()
  }
}

function validator<P extends BaseParams>(
  key: keyof P,
  value: any
): true | Error {
  return (
    isCuid((<any>value).toString()) ||
    new BadRequest(`Invalid ${key.toString()} type, must be uuid`)
  )
}
