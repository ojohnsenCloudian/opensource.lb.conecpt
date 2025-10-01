import * as http from 'http';
import * as https from 'https';
import { LoadBalancerConfig } from './config-manager';
import { BackendPool } from './backend-pool';
import { StatsCollector } from './stats-collector';
import { Logger } from './utils/logger';

export class RequestHandler {
  private logger = new Logger('RequestHandler');
  private agentOptions = {
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 100,
    maxFreeSockets: 10,
  };
  private httpAgent = new http.Agent(this.agentOptions);
  private httpsAgent = new https.Agent(this.agentOptions);

  constructor(
    private config: LoadBalancerConfig,
    private backendPool: BackendPool,
    private statsCollector: StatsCollector
  ) {}

  async handle(clientReq: http.IncomingMessage, clientRes: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    const clientIp = this.getClientIp(clientReq);

    try {
      // Select backend server
      const backend = this.backendPool.selectBackend(clientIp);

      if (!backend) {
        this.logger.warn('No backend available for request');
        clientRes.writeHead(503, { 'Content-Type': 'text/plain' });
        clientRes.end('Service Unavailable: No healthy backends');
        this.statsCollector.recordRequest(503, Date.now() - startTime, 0, 0);
        return;
      }

      this.logger.debug(`Routing request to backend: ${backend.name} (${backend.host}:${backend.port})`);

      // Track connection
      this.backendPool.incrementConnections(backend.id);

      // Prepare backend request options
      const backendReqOptions: http.RequestOptions = {
        hostname: backend.host,
        port: backend.port,
        path: clientReq.url,
        method: clientReq.method,
        headers: this.prepareHeaders(clientReq, clientIp),
        agent: this.httpAgent,
        timeout: this.config.connectionTimeout,
      };

      // Make request to backend
      const backendReq = http.request(backendReqOptions, (backendRes) => {
        // Forward response headers
        clientRes.writeHead(backendRes.statusCode || 200, backendRes.headers);

        let bytesReceived = 0;

        // Stream response body
        backendRes.on('data', (chunk) => {
          bytesReceived += chunk.length;
          clientRes.write(chunk);
        });

        backendRes.on('end', () => {
          clientRes.end();
          const duration = Date.now() - startTime;
          const bytesSent = parseInt(clientReq.headers['content-length'] || '0');

          this.statsCollector.recordRequest(
            backendRes.statusCode || 200,
            duration,
            bytesSent,
            bytesReceived
          );
          this.statsCollector.recordBackendRequest(
            backend.id,
            backendRes.statusCode || 200,
            duration,
            bytesSent,
            bytesReceived
          );

          this.backendPool.decrementConnections(backend.id);
        });
      });

      // Handle backend request errors
      backendReq.on('error', (error) => {
        this.logger.error(`Backend request error (${backend.name}):`, error);

        if (!clientRes.headersSent) {
          clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
          clientRes.end('Bad Gateway: Backend error');
        } else {
          clientRes.end();
        }

        const duration = Date.now() - startTime;
        this.statsCollector.recordRequest(502, duration, 0, 0);
        this.backendPool.decrementConnections(backend.id);
      });

      // Handle backend request timeout
      backendReq.on('timeout', () => {
        this.logger.warn(`Backend request timeout (${backend.name})`);
        backendReq.destroy();

        if (!clientRes.headersSent) {
          clientRes.writeHead(504, { 'Content-Type': 'text/plain' });
          clientRes.end('Gateway Timeout');
        }

        const duration = Date.now() - startTime;
        this.statsCollector.recordRequest(504, duration, 0, 0);
        this.backendPool.decrementConnections(backend.id);
      });

      // Forward client request body
      clientReq.pipe(backendReq);

      // Handle client disconnection
      clientReq.on('aborted', () => {
        backendReq.destroy();
        this.backendPool.decrementConnections(backend.id);
      });
    } catch (error) {
      this.logger.error('Request handling error:', error);

      if (!clientRes.headersSent) {
        clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
        clientRes.end('Internal Server Error');
      }

      const duration = Date.now() - startTime;
      this.statsCollector.recordRequest(500, duration, 0, 0);
    }
  }

  private getClientIp(req: http.IncomingMessage): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      return ips.split(',')[0].trim();
    }

    return req.socket.remoteAddress || '';
  }

  private prepareHeaders(
    clientReq: http.IncomingMessage,
    clientIp: string
  ): http.OutgoingHttpHeaders {
    const headers = { ...clientReq.headers };

    // Add X-Forwarded headers
    headers['x-forwarded-for'] = clientIp;
    headers['x-forwarded-proto'] = this.config.protocol;
    headers['x-real-ip'] = clientIp;

    // Remove hop-by-hop headers
    delete headers['connection'];
    delete headers['keep-alive'];
    delete headers['transfer-encoding'];
    delete headers['upgrade'];

    return headers;
  }
}

