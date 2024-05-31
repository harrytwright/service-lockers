import {
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  AxiosInstance,
} from 'axios'
import { Instrumentation, TraceId } from 'zipkin'
import { register } from '@harrytwright/api/dist/core'

import { Zipkin } from '../index'

export type RequestConfig = AxiosRequestConfig & { traceId: TraceId }

export type RequestError = AxiosError & { config: RequestConfig }

@register('singleton')
export class Request {
  instrumentation?: Instrumentation.HttpClient

  constructor(private readonly zipkin: Zipkin) {}

  updateInterceptors(axios: AxiosInstance): AxiosInstance {
    if (!this.zipkin.tracer) return axios

    const instrumentation = new Instrumentation.HttpClient({
      remoteServiceName: axios.defaults.baseURL,
      tracer: this.zipkin.tracer,
    })

    axios.interceptors.request.use(
      // @ts-ignore
      this.zipkinRecordRequest.bind(
        Object.assign({}, this, { instrumentation })
      ),
      this.zipkinRecordError.bind(Object.assign({}, this, { instrumentation }))
    )

    axios.interceptors.response.use(
      // @ts-ignore
      this.zipkinRecordResponse.bind(
        Object.assign({}, this, { instrumentation })
      ),
      this.zipkinRecordError.bind(Object.assign({}, this, { instrumentation }))
    )

    return axios
  }

  zipkinRecordRequest(
    this: Request & { instrumentation?: Instrumentation.HttpClient },
    config: RequestConfig
  ): RequestConfig {
    if (!this.zipkin.tracer || !this.instrumentation) return config

    const tracer = this.zipkin.tracer
    return tracer.scoped(() => {
      const newConfig = this.instrumentation!.recordRequest(
        config,
        config.url || '/',
        config.method || 'GET'
      )
      newConfig.traceId = tracer.id
      return newConfig
    })
  }

  zipkinRecordResponse(
    res: AxiosResponse & { config: RequestConfig }
  ): AxiosResponse {
    if (!this.zipkin.tracer || !this.instrumentation) return res

    const tracer = this.zipkin.tracer
    return tracer.scoped(() => {
      this.instrumentation!.recordResponse(
        res.config.traceId,
        res.status.toString()
      )
      return res
    })
  }

  /* istanbul ignore next */
  zipkinRecordError(error: RequestError): Promise<unknown> {
    if (!this.zipkin.tracer || !this.instrumentation)
      return Promise.reject(error)

    const tracer = this.zipkin.tracer
    return tracer.scoped(() => {
      if (error.config) {
        const { traceId } = error.config
        if (error.response) {
          this.instrumentation!.recordResponse(
            traceId,
            error.response.status.toString()
          )
        } else {
          this.instrumentation!.recordError(traceId, error)
        }
      } // otherwise the error preceded the request interceptor
      return Promise.reject(error)
    })
  }
}
