/**
 * This is a work-in-progress file, and should only be changed if you're on the team
 * */

import { describe } from '@jest/globals'

import { handleFlow, WorkFlows } from '../jest/testing-suite'

import { menus_scope } from '../src/modules/auth/scopes/menus'

describe('Docker', () => {
  const workflow: WorkFlows = <WorkFlows>require('../.lanelink/workflow.json')

  describe('readinessCheck', function () {
    handleFlow(workflow['readinessCheck']!, 'http://localhost:3000', {})
  })
})
