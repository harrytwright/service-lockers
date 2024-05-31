var retry = require('retry')

function isReadyYet(address, cb) {
  var op = retry.operation({
    retries: 5,
  })

  op.attempt((curr) => {
    // For the final check, run against the health pass to see if we can find the cause
    let uri = address + (curr > 5 ? '/health' : '/health/readiness')

    console.log(
      'readiness: %s to connect to %s',
      curr > 1 ? 'Failed' : 'Attempting',
      uri
    )

    console.log('readiness: current attempt #%s', curr)

    require('http')
      .get(uri, (res) => {
        let data = ''
        let passed = true

        res.on('data', (chunk) => {
          data += chunk.toString()
        })

        res.on('end', () => {
          const body = JSON.parse(data)

          console.log('readiness: Received %o', body)

          // Check for both health and readiness
          if (
            (typeof body === 'boolean' && body === true) ||
            (typeof body === 'object' && body.status === 'healthy')
          ) {
            return cb(passed ? null : op.mainError(), op)
          }

          passed = false
          const isActualResponse = typeof body === 'boolean'

          const error = new Error(
            isActualResponse
              ? "Received 'false' with 503 error"
              : body.error.message
          )
          if (op.retry(error)) return

          cb(passed ? null : op.mainError(), op)
        })
      })
      .once('error', (err) => {
        console.log('readiness: Received %o will retry', err.code)
        if (op.retry(err)) return

        cb(op.mainError(), op)
      })
  })
}

isReadyYet('http://localhost:3000', (err, op) => {
  if (err) {
    console.error(
      'readiness: Failed after %s attempts due to $o',
      op.attempts(),
      err.message
    )
    return process.exit(1)
  }

  console.log('readiness: Ready for connections')
  console.log('readiness: Took %s attempts', op.attempts())
  return process.exit(0)
})
