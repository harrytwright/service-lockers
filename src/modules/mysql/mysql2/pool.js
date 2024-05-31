const { format, Pool, createPool, PoolConnection } = require('mysql2')
const { Annotation } = require('zipkin')
const PoolConfig = require('./config')
const log = require('@harrytwright/logger')

module.exports.createZipkinPool = function createZipkinPool(zipkin) {
  if (!zipkin.tracer) return createPool

  class ZipkinConnection extends PoolConnection {
    query(sql, values, callback) {
      const _this = this
      const tracer = zipkin.tracer

      var childId = tracer.createChildId()
      tracer.letId(childId, function () {
        tracer.recordServiceName(zipkin.localService)
        tracer.recordAnnotation(new Annotation.ClientSend())
        tracer.recordAnnotation(
          new Annotation.Message('sql ' + format(sql, values))
        )
        tracer.recordAnnotation(
          new Annotation.ServerAddr({
            serviceName: 'mysql',
            // host: addr,
            port: _this.config.port,
          })
        )

        tracer.recordRpc(`${getType(sql)} ${_this.config.database}`)

        tracer.recordBinary('values', JSON.stringify(values))
        tracer.recordBinary('debug', _this.config.debug || false)
        tracer.recordBinary('database', _this.config.database)
      })

      var promise = super.query(sql, values, callback)

      promise.on('end', function () {
        tracer.letId(childId, function () {
          tracer.recordAnnotation(new Annotation.ClientRecv())
        })
      })

      promise.on('error', function (error) {
        tracer.letId(childId, function () {
          tracer.recordBinary('error', error.toString())
          tracer.recordAnnotation(new Annotation.ClientRecv())
        })
      })

      return promise
    }
  }

  /* istanbul ignore next */
  class ZipkinPool extends Pool {
    getConnection(cb) {
      if (this._closed) {
        return process.nextTick(() => cb(new Error('Pool is closed.')))
      }
      let connection
      if (this._freeConnections.length > 0) {
        connection = this._freeConnections.pop()
        this.emit('acquire', connection)
        return process.nextTick(() => cb(null, connection))
      }
      if (
        this.config.connectionLimit === 0 ||
        this._allConnections.length < this.config.connectionLimit
      ) {
        connection = new ZipkinConnection(this, {
          config: this.config.connectionConfig,
        })
        this._allConnections.push(connection)
        return connection.connect((err) => {
          if (this._closed) {
            return cb(new Error('Pool is closed.'))
          }
          if (err) {
            return cb(err)
          }
          this.emit('connection', connection)
          this.emit('acquire', connection)
          return cb(null, connection)
        })
      }
      if (!this.config.waitForConnections) {
        return process.nextTick(() =>
          cb(new Error('No connections available.'))
        )
      }
      if (
        this.config.queueLimit &&
        this._connectionQueue.length >= this.config.queueLimit
      ) {
        return cb(new Error('Queue limit reached.'))
      }
      this.emit('enqueue')
      return this._connectionQueue.push(cb)
    }
  }

  log.notice('mysql2', {}, 'Creating Zipkin Mysql2 pool function')
  return function (config) {
    return new ZipkinPool({ config: new PoolConfig(config) })
  }
}

function getType(sql) {
  if (sql.includes('insert')) return 'insert'
  else if (sql.includes('delete')) return 'delete'
  else if (sql.includes('update')) return 'update'
  return 'select'
}
