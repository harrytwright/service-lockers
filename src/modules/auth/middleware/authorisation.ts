import { Forbidden, Unauthorized } from '@hndlr/errors'

import {
  SessionRequest,
  ServerResponse,
  NextFunction,
} from '../../../types/json-response.type'
import { matcher } from '../../../utils/role-matcher'

// works like <resource>:<action>:<attribute>
// so for the average user it would be users:read:own which would allow them to read their own user details
export function authorisation(
  permission: string | string[],
  allowUnprotected: boolean = false,
  mustMatch: boolean = false
) {
  if (permission.length === 0)
    throw new SyntaxError('permission must have a length greater than 0')

  return (
    req: SessionRequest<any, any>,
    res: ServerResponse<any>,
    next: NextFunction
  ) => {
    if (!req.session && !allowUnprotected)
      return next(new Unauthorized(`${req.url} requires authentication`))

    if (
      (req.session &&
        matcher(permission, req.session.permissions, mustMatch)) ||
      allowUnprotected
    )
      return next()

    return next(new Forbidden('Current user has invalid permissions'))
  }
}
