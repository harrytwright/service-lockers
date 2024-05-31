import express from 'express'

export type JSONResponse<X> = {
  data: X

  meta?: any
}

export type ServerResponse<
  X,
  L extends Record<string, any> = {},
> = express.Response<JSONResponse<X>, L>

export type ServerRequest<P, R, B = unknown> = express.Request<
  P,
  JSONResponse<R>,
  B
>

export type NextFunction = express.NextFunction
