#!/usr/bin/env zx

import 'zx/globals'

import minimist from 'minimist'
import fs from 'fs/promises'

const usage = `
Run our test suite

  \`$ ${chalk.green('scripts/test.mjs')} [options]\`
  
Options:
  -h,--help       Print this help message
  -v,--verbose    Set verbose mode
  -w,--watch      Run in jest watch mode
  -c,--coverage   Run with coverage enabled
  -d,--database   Set the database URL
  --reset-only    Reset the database and generate interface files
  --generate      Generate the interface files, defaults to true
  --docker        Run the docker tests (will cancel --watch & --coverage)
  --key           Set the JWT private key
  --pubkey        Set the JWT public key
  --zipkin        Set the zipkin URL
  --port          Set the testing port
  --api-key       Set the auth token generation API key
  --debug         Set debug option (sets NODE_DEBUG & DEBUG)
`

// Handle the arguments
const args = minimist(process.argv, {
  string: ['database', 'zipkin', 'key', 'pubkey', 'auth-api-key', 'port'],
  boolean: [
    'help',
    'verbose',
    'watch',
    'coverage',
    'reset-only',
    'generate',
    'docker',
    'debug',
  ],
  alias: {
    help: 'h',
    verbose: 'v',
    watch: 'w',
    coverage: 'c',
    database: 'd',
  },
  default: {
    generate: true,
    coverage: true,
  },
})

if (args.help) {
  echo`${usage}`
  process.exit(1)
}

$.verbose = args.verbose

echo`=> Checking for dependencies`

let node
try {
  echo`==> node`
  node = await $`which node`.quiet()

  if (args.verbose) {
    echo`'node' found @ ${node}`
    echo`'node' ${await $`${node} --version`.quiet()}`
  }
} catch (err) {
  echo`err: The test suite cannot be ran without node'`
  echo`err: install node first, and then try again`
  echo``

  process.exit(1)
}

let npx
try {
  echo`==> npx`
  npx = await $`which npx`.quiet()

  if (args.verbose) {
    echo`'npx' found @ ${npx}`
    echo`'npx' v${await $`${npx} --version`.quiet()}`
  }
} catch (err) {
  echo`err: The test suite cannot be ran without npx'`
  echo`err: install npx first, and then try again`
  echo``

  process.exit(1)
}

const isDocker = args.docker

const tmpdir = path.join(
  os.tmpdir(),
  require('@paralleldrive/cuid2').createId(),
  'jwt'
)

echo`=> Generating environment`

await $`mkdir -p ${tmpdir}`

let env = {}

if (!isDocker) {
  env['PORT'] = args.port || 3000
}

if (args.zipkin) {
  env['ZIPKIN'] = args.zipkin
}

if (args['api-key']) {
  env['TOKEN_API_KEY'] = args['api-key']
}

try {
  process.env.FORCE_COLOR = '1'

  if (!isDocker) {
    echo`==> Creating database schema`
    await $`${npx} cross-env ${convertEnvToFlags({
      DATABASE_URL: args.database,
      NODE_ENV: 'test',
    })} prisma db push --force-reset`

    echo`==> Seeding database`
    await $`${npx} cross-env ${convertEnvToFlags({
      ...env,
      DATABASE_URL: args.database,
      NODE_ENV: 'test',
    })} prisma db seed`
  }

  if (args.generate) {
    echo`==> Generate interface files from \`kysely\` type`
    await $`${node} ${path.resolve(process.cwd(), './scripts/generate')}`
  }

  let auth = {}
  if (!isDocker) {
    auth = {
      AUTH_PUBLIC_KEY: args.pubkey,
      TEST_JWT_PRIVATE_KEY: args.key,
    }

    let validateKeys = false

    if (!args.key && !args.pubkey) {
      echo`==> Generating RSA Keypair`

      await $`openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out ${path.join(tmpdir, 'private.key')}`
      await $`openssl rsa -pubout -in ${path.join(tmpdir, 'private.key')} -out ${path.join(tmpdir, 'public.key')}`

      auth['TEST_JWT_PRIVATE_KEY'] = path.join(tmpdir, 'private.key')
      auth['AUTH_PUBLIC_KEY'] = path.join(tmpdir, 'public.key')

      validateKeys = true
    } else if (!args.key) {
      echo`Please note that tests may fail when not passed a private key`
    } else if (args.key && !args.pubkey) {
      // Generate the public key if we just get a private key
      const base64regex =
        /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/

      const isFile = await checkFileExists(args.key)
      const isBase64 = !isFile && base64regex.test(args.key)

      if (isFile) {
        await $`openssl rsa -pubout -in ${path.relative(process.cwd(), args.key)} -out ${path.join(tmpdir, 'public.key')}`
        auth['AUTH_PUBLIC_KEY'] = path.join(tmpdir, 'public.key')
      } else if (isBase64) {
        await $`echo ${args.key}`
          .pipe($`base64 --decode`)
          .pipe($`openssl rsa -pubout -out ${path.join(tmpdir, 'public.key')}`)

        auth['AUTH_PUBLIC_KEY'] = path.join(tmpdir, 'public.key')
      }

      validateKeys = true
    }
  }

  if (!args['reset-only']) {
    echo`=> Starting test suite`
    const jestArgs = ['--runInBand', '--detectOpenHandles']

    if (args.coverage && !isDocker) jestArgs.push('--coverage')

    if (args.watch && !isDocker) jestArgs.push('--watch')

    if (isDocker) {
      jestArgs.push(
        '--testNamePattern=^Docker',
        '--testRegex=\\.lanelink\\/.*\\.spec\\.ts'
      )
    } else {
      jestArgs.push('--testPathIgnorePatterns=\\.lanelink\\/.*\\.spec\\.ts')
    }

    const logging = {}
    if (args.debug) {
      logging['DEBUG'] = 'testing-suite'
      logging['NODE_DEBUG'] = 'testing-suite'
    }

    await $`${convertEnvToFlags(logging)} ${npx} cross-env ${convertEnvToFlags({ ...env, DATABASE_URL: args.database, NODE_ENV: 'test' })} ${convertEnvToFlags(auth)} jest ${jestArgs}`

    process.env.FORCE_COLOR = '0'
  }
} catch (err) {
  if (err instanceof Error) console.error(err.message)
  if (err instanceof ProcessOutput && !$.verbose) console.log(err.stderr)

  echo`${usage}`
  process.exit(err.exitCode || 1)
}

function convertEnvToFlags(env) {
  return Object.entries(env).map(([key, value]) => `${key}=${value}`)
}

function checkFileExists(file) {
  return fs
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false)
}
