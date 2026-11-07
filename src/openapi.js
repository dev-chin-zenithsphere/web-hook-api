const swaggerJsdoc = require('swagger-jsdoc');

const result = {
  type: 'object',
  required: ['eventId', 'weight', 'unit', 'result', 'receivedAt'],
  properties: {
    eventId: { type: 'string', format: 'uuid', description: 'Stable ID reused for webhook retries.' },
    weight: { type: 'number', description: 'Finite measured weight.' },
    unit: { type: 'string', example: 'g', description: 'Unit confirmed by the configured adapter.' },
    result: { type: 'string', enum: ['OK', 'NG'] },
    receivedAt: { type: 'string', format: 'date-time', description: 'Time the gateway PC received the completed result.' }
  }
};

function createOpenApiSpec() {
  return swaggerJsdoc({ definition: {
    openapi: '3.0.3',
    info: { title: 'Checkweigher TCP Gateway API', version: '1.0.0', description: 'REST API for normalized completed results. Shipped mock data is simulator-line-v1, not Anritsu data.' },
    servers: [{ url: '/', description: 'Current gateway host' }],
    components: {
      securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' } },
      schemas: {
        Result: result,
        Error: { type: 'object', properties: { error: { type: 'string' }, message: { type: 'string' } } },
        History: { type: 'object', properties: { total: { type: 'integer' }, offset: { type: 'integer' }, limit: { type: 'integer' }, items: { type: 'array', items: result } } }
      }
    },
    paths: {
      '/health': { get: { summary: 'Unauthenticated process liveness check', responses: { 200: { description: 'Process is running' } } } },
      '/ready': { get: { summary: 'Unauthenticated TCP readiness check', responses: { 200: { description: 'TCP transport is ready' }, 503: { description: 'TCP transport is not ready' } } } },
      '/api/status': { get: { summary: 'Gateway TCP and receiver status', security: [{ ApiKeyAuth: [] }], responses: { 200: { description: 'Current status' }, 401: { description: 'Missing or invalid API key' } } } },
      '/api/results/latest': { get: { summary: 'Latest completed result', security: [{ ApiKeyAuth: [] }], responses: { 200: { description: 'Latest completed result', content: { 'application/json': { schema: { $ref: '#/components/schemas/Result' } } } }, 404: { description: 'No completed result exists yet' } } } },
      '/api/results': { get: { summary: 'Completed result history held in memory', security: [{ ApiKeyAuth: [] }], parameters: [{ name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }], responses: { 200: { description: 'Paginated in-memory history', content: { 'application/json': { schema: { $ref: '#/components/schemas/History' } } } } } } }
    }
  }, apis: [] });
}
module.exports = { createOpenApiSpec };
