import erred from '@hndlr/erred'
// import {
//   CheckViolationError, DataError, DBError,
//   ForeignKeyViolationError,
//   NotFoundError,
//   NotNullViolationError,
//   UniqueViolationError,
//   ValidationError
// } from "objection";
import {
  BadRequest,
  Conflict,
  Gone,
  NotFound,
  UnprocessableEntity,
  UnprocessableEntityError,
} from '@hndlr/errors'

const handler = erred({
  default500: true,
})

handler.use(function (error: Error & Record<string, any>, req) {
  if (!error.code) {
    return undefined
  }

  switch (error.code) {
    case 'ER_DUP_ENTRY':
    case 'ER_DUP_ENTRY_WITH_KEY_NAME':
      const CONSTRAINT_REGEX = /Duplicate entry '(.+)' for key '(.+)'/
      const constraintMatch = CONSTRAINT_REGEX.exec(error.sqlMessage)

      if (!constraintMatch) return undefined

      const constraintParts = constraintMatch[2].split('.')
      const table = constraintParts[0],
        constraint = constraintParts[1]

      const message = `The resource you are trying to ${
        req.method.toLowerCase() === 'post' ? 'create' : 'update'
      } conflicts with an existing resource.`
      const reason = `The ${table} failed to pass '${constraint}'`

      return Object.assign(new Conflict(message), {
        meta: { reason, sql: error.sqlMessage },
      })
  }

  return undefined
  // if (error instanceof ValidationError) {
  //   const errors = []
  //   for (const [key, reasons] of Object.entries(error.data) as [string, any[]][]) {
  //     errors.push(...reasons.map((el: any) => Object.assign(new Error(el.message), { property: key, name: error.name })))
  //   }
  //
  //   return new UnprocessableEntity('Validation failed', errors)
  // } else if (error instanceof NotFoundError) {
  //   const messageGenerator = (data: Record<string, any>) =>
  //     `Unable to find item that matches (${Object.entries(data).map(([key, value]) => `\`${key}=${value}\``).join(', ')})`
  //   return new NotFound(messageGenerator(error.data))
  // } else if (error instanceof UniqueViolationError) {
  //   const message = `The resource you are trying to ${req.method.toLowerCase() === 'post' ? 'create' : 'update'} conflicts with an existing resource.`
  //   const reason = `An ${error.table} with the same [${error.columns.join(', ')}] already exists`
  //
  //   return Object.assign(new Conflict(message), { meta: { reason, columns: error.columns } })
  // } else if (error instanceof ForeignKeyViolationError) {
  //   return new Gone(error.message)
  // } else if (error instanceof NotNullViolationError || error instanceof CheckViolationError || error instanceof DataError) {
  //   return new BadRequest(error.message)
  // } else if (error instanceof DBError) {
  //   return new UnprocessableEntity(error.message, [error])
  // }
})

export default handler
