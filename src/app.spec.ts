import { describe } from '@jest/globals'

import { App } from './app'

import { handleFlow, WorkFlows } from '../jest/testing-suite'

describe('App', () => {
  const workflow: WorkFlows = <WorkFlows>require('../.lanelink/workflow.json')

  describe('readinessCheck', function () {
    handleFlow(workflow['readinessCheck']!, App, {
      jwt: createJWT(['*']),
    })
  })
})

function createJWT(permissions: string[]) {
  return {
    iss: 'self',
    sub: process.env['ADMIN'],
    exp: Math.floor(Date.now() / 1000) + 60 * 10,
    sessionHandle: require('uuid').v4(),
    refreshTokenHash1: require('uuid').v4(),
    'st-role': { v: ['admin'] },
    'st-perm': {
      v: permissions,
    },
  }
}
