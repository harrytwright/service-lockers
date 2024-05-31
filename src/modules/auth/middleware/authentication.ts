import assert from 'assert'

import log from '@harrytwright/logger'
import { JwtPayload } from 'jsonwebtoken'
import { BadRequest } from '@hndlr/errors'
import { registerMiddleware } from '@harrytwright/api/dist/core'
import type { Handler, Request, Response, NextFunction } from 'express'

import { Auth } from '../auth.module'
import { Session } from '../interface/session.interface'
import { matcher } from '../../../utils/role-matcher'

export const Authentication = registerMiddleware(
  'auth',
  (auth): Handler => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check the auth header first, and then the cookie second
      const authz =
        checkAuthType(req.header('authorization'), 'Bearer') ||
        checkCookiesForSession(req.cookies, 'sAccessToken')

      if (authz !== undefined) {
        return auth.verify(
          <string>authz,
          (error, decoded: JwtPayload | string | undefined) => {
            if (error) {
              log.error('auth:middleware', error, 'Failed to verify JWT')
              return next(error)
            }

            if (decoded === undefined || typeof decoded === 'string') {
              return next(new BadRequest('Invalid JWT'))
            }

            const session: Session = {
              issuer: decoded.iss!,
              subject: decoded.sub!,
              expiration: new Date(decoded.exp! * 1000),
              session: decoded.sessionHandle,
              refreshToken: decoded.refreshTokenHash1,
              roles: (decoded['st-role'] || { v: [] }).v || [],
              permissions: (decoded['st-perm'] || { v: [] }).v || [],
              canAccess(this: Session, permission: string): boolean {
                return matcher(permission, this.permissions)
              },
            }

            // @ts-ignore
            req['session'] = session

            // console.log(session)
            next()
          }
        )
      }

      // This here is mainly used for authentication, don't do anything yet, just return, let the route
      // middleware do its job based on the roles
      next()
    }
  },
  Auth
)

function checkAuthType(
  header: string | undefined,
  matches: 'Bearer'
): string | undefined {
  if (header === undefined) return undefined

  const parts = header.split(' ')
  assert(parts.length === 2, 'Auth token more than 2 parts')
  assert(parts[0] === matches, `Auth token is not ${matches}`)

  return parts[1]
}

function checkCookiesForSession(
  cookies: Record<string, any> | undefined,
  matches: 'sAccessToken'
): string | undefined {
  if (cookies === undefined || !(matches in cookies)) return undefined

  return cookies[matches]
}
