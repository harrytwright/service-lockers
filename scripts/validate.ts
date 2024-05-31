/**
 * This using the TS-AST will validate each controller to make sure all the
 * routes w/ the correct path have been created
 * */

import { PathLike } from 'fs'
import path from 'path'
import fs from 'fs/promises'

import ts from 'typescript'
import log from '@harrytwright/logger'
import { bundle, createConfig } from '@redocly/openapi-core'

log.set('app', '@lanelink/scripts:validate')

export type ErrorStatus =
  | 'missing'
  | 'invalidFunctionName'
  | 'noOpenAPI'
  | 'incorrectMethod'

export type Status = 'valid' | ErrorStatus

export interface PathRoute {
  // the HTTP method
  method: string

  // The fn name
  fn: string
}

export interface PathRouteStatus extends PathRoute {
  controller?: string

  fullPath: string

  status: Status
}

async function main() {
  try {
    log.info('main', 'Parsing openapi.json')
    const ref = await parseOpenAPI(
      path.join(process.cwd(), './openapi/openapi.json')
    )

    log.verbose('main', 'Looking up all controllers')
    const files = (
      await fs.readdir(path.join(process.cwd(), './src/controllers'), {
        withFileTypes: true,
      })
    )
      .filter(
        (el) =>
          el.isFile() &&
          !/\.spec\.ts/.test(el.name) &&
          !/index\.ts/.test(el.name)
      )
      .map((el) => path.join(process.cwd(), './src/controllers', el.name))

    const tree: Map<string, Map<string, PathRoute[]>> = new Map([])
    for (const file of files) {
      log.verbose('main:parse', { file }, 'Generating AST for %o', file)
      await parse(file, tree)
    }

    const results = validate(tree, ref).filter((el) => el.status !== 'valid')

    if (results.length === 0) {
      log.info('main', 'Finished validation with 100% valid API')
      return 0
    }

    const groups = groupBy(results, 'status') as Record<
      ErrorStatus,
      PathRouteStatus[]
    >

    log.info('main', 'Finished validation with invalid API')
    for (const [key, statuses] of Object.entries(groups)) {
      console.log('Failed to due %s', key)
      for (const [route, el] of Object.entries(groupBy(statuses, 'fullPath'))) {
        const message = [`  ${route}`]
        message.push(...el.map((el) => `    ${el.method} - ${el.fn}`))
        console.log(message.join('\n'))
      }
    }

    return 1
  } catch (err) {
    console.error(err)
    throw err
  }
}

main()
  .then((exit) => {
    console.log('Completed with %s exit', exit)
    process.exit(exit)
  })
  .catch(() => {
    process.exit(1)
  })

async function parse(
  file: PathLike,
  tree: Map<string, Map<string, PathRoute[]>>
) {
  const program = ts.createProgram([file.toString()], {
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.CommonJS,
  })

  for (const sourceFile of program
    .getSourceFiles()
    .filter((el) => el.fileName === file)) {
    const classes = sourceFile.statements.filter(
      (el) => el.kind === ts.SyntaxKind.ClassDeclaration
    ) as ts.ClassDeclaration[]

    log.verbose('main:parse', 'Parsing %d classes', classes.length)
    for (const klass of classes) {
      // Set the '!' so it throws if it's unable to find a name
      const klassName = klass.name!.text

      if (!klass.modifiers || !isController(klass.modifiers)) {
        continue
      }

      // We know it's a controller now
      tree.set(klassName, new Map([]))
      const basePath = getRouting(klass.modifiers)

      for (const member of klass.members) {
        if (
          !ts.isMethodDeclaration(member) ||
          (member.body && member.body.statements.length === 0)
        )
          continue

        const routing = path
          .join(basePath || '/', getRouting(member.modifiers!) || '')
          .replace(/(?<!^)\/$/, '')

        if (!tree.get(klassName)!.has(routing)) {
          tree.get(klassName)!.set(routing, [])
        }

        // At the moment we only support these HTTP methods, this is mainly while testing
        const methodsRegex = /(?<method>get|post|patch|delete|put)[A-Z].*/

        const methodName = (
          (member as ts.MethodDeclaration).name as ts.Identifier
        ).escapedText.toString()
        const response = methodsRegex.exec(methodName)
        const method = response?.groups?.method.toUpperCase()

        // If it's not a valid function it wouldn't even get counted by `@harrytwright/api`
        // as I've knicked my own regex
        if (!method) {
          continue
        }

        tree.get(klassName)!.get(routing)!.push({
          method,
          fn: methodName,
        })
      }

      if (tree.get(klassName)!.size === 0) {
        log.warn(
          'main:parse',
          { class: klassName },
          'Unable to find any complete routes in %o',
          klassName
        )
      }
    }
  }
}

async function parseOpenAPI(file: PathLike): Promise<Map<string, PathRoute[]>> {
  const config = await createConfig({})
  const openapi = await bundle({
    ref: file.toString(),
    config,
    dereference: true,
  })

  const tree: Map<string, PathRoute[]> = new Map([])

  const { paths } = openapi.bundle.parsed

  if (!paths) {
    throw new Error('Unable to find paths in openapi file')
  }

  for (const [path, methods] of Object.entries(
    paths as Record<string, Record<string, any>>
  )) {
    const basePath = path.replaceAll(/{([\w-]+)}/g, (substring, p1) => `:${p1}`)
    if (!tree.has(basePath)) {
      tree.set(basePath, [])
    }

    for (const [key, method] of Object.entries(methods)) {
      switch (key) {
        case 'get':
        case 'post':
        case 'delete':
        case 'put':
        case 'patch':
          tree.get(basePath)!.push({
            method: key.toUpperCase(),
            fn: method.operationId,
          })
      }
    }
  }

  return tree
}

function isController(modifiers: ts.NodeArray<ts.ModifierLike>): boolean {
  for (const modifier of modifiers) {
    if (!ts.isDecorator(modifier) || !ts.isCallExpression(modifier.expression))
      break

    return (
      (modifier.expression.expression as ts.Identifier).escapedText ===
      'controller'
    )
  }
  return false
}

function getRouting(
  modifiers: ts.NodeArray<ts.ModifierLike>
): string | undefined {
  for (const modifier of modifiers) {
    if (!ts.isDecorator(modifier) || !ts.isCallExpression(modifier.expression))
      break

    switch ((modifier.expression.expression as ts.Identifier).escapedText) {
      case 'controller':
      case 'path':
        return (modifier.expression.arguments[0] as ts.StringLiteral).text
    }
  }

  return undefined
}

function validate(
  tree: Map<string, Map<string, PathRoute[]>>,
  ref: Map<string, PathRoute[]>
): Array<PathRouteStatus> {
  const results = new Array<PathRouteStatus>()
  const hasReferenced = new Map<string, PathRoute[]>([])

  const check = (
    path: string,
    routes: PathRoute[],
    controller: string
  ): PathRouteStatus[] => {
    const results: PathRouteStatus[] = []

    const reference = ref.get(path)

    // Can't find a reference for them
    if (!reference) {
      return routes.map((el) => ({
        ...el,
        status: 'noOpenAPI',
        controller,
        fullPath: path,
      }))
    }

    hasReferenced.set(path, [])

    for (const route of routes) {
      const validator = reference.findIndex(
        (el) => el.fn === route.fn || el.method === route.method
      )
      if (validator === -1) {
        // console.log(path, route, reference, 'Unable to find reference')
        continue
      }

      if (route.fn !== reference[validator].fn) {
        results.push({
          ...route,
          controller,
          fullPath: path,
          status: 'invalidFunctionName',
        })

        hasReferenced.get(path)?.push(reference[validator])

        continue
      } else if (route.method !== reference[validator].method) {
        results.push({
          ...route,
          controller,
          fullPath: path,
          status: 'incorrectMethod',
        })

        hasReferenced.get(path)?.push(reference[validator])
        continue
      }

      results.push({
        ...route,
        status: 'valid',
        fullPath: path,
        controller,
      })
      hasReferenced.get(path)?.push(reference[validator])
    }

    return results
  }

  for (const [controller, controllerTree] of tree) {
    for (const [path, routes] of controllerTree) {
      results.push(...check(path, routes, controller))
    }
  }

  results.push(...calcMissing(ref, hasReferenced))

  return results
}

function calcMissing(
  lhs: Map<string, PathRoute[]>,
  rhs: Map<string, PathRoute[]>
): Array<PathRouteStatus> {
  const results: PathRouteStatus[] = []
  for (const [key, routes] of lhs) {
    if (!rhs.has(key)) {
      results.push(
        ...routes.map(
          (el): PathRouteStatus => ({ ...el, status: 'missing', fullPath: key })
        )
      )
      continue
    }

    const has = rhs.get(key)!
    for (const route of routes) {
      if (has.findIndex((el) => deepEqual(el, route)) === -1) {
        results.push({ ...route, status: 'missing', fullPath: key })
      }
    }
  }

  return results
}

function deepEqual(x: any, y: any): boolean {
  return x && y && typeof x === 'object' && typeof y === 'object'
    ? Object.keys(x).length === Object.keys(y).length &&
        Object.keys(x).reduce(function (isEqual, key) {
          return isEqual && deepEqual(x[key], y[key])
        }, true)
    : x === y
}

function groupBy<T extends Record<string, any>>(
  arr: T[],
  property: keyof T
): Record<any, T[]> {
  return arr.reduce(
    function (prev, curr): Record<any, T[]> {
      if (!prev[curr[property]]) {
        prev[curr[property]] = []
      }
      prev[curr[property]].push(curr)
      return prev
    },
    {} as Record<any, T[]>
  )
}
