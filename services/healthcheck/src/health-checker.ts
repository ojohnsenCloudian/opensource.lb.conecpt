import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { Logger } from './utils/logger';

export class HealthChecker {
  private logger = new Logger('HealthChecker');

  async checkHttp(
    useHttps: boolean,
    host: string,
    port: number,
    path: string,
    timeout: number,
    expectedStatus: number
  ): Promise<{ status: 'success' | 'failed' | 'timeout'; statusCode?: number; message?: string }> {
    return new Promise((resolve) => {
      const protocol = useHttps ? https : http;
      const options = {
        hostname: host,
        port,
        path,
        method: 'GET',
        timeout,
        headers: {
          'User-Agent': 'LB-HealthCheck/1.0',
        },
        rejectUnauthorized: false, // Allow self-signed certificates
      };

      const req = protocol.request(options, (res) => {
        // Consume response body
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode === expectedStatus) {
            resolve({ status: 'success', statusCode: res.statusCode });
          } else {
            resolve({
              status: 'failed',
              statusCode: res.statusCode,
              message: `Expected status ${expectedStatus}, got ${res.statusCode}`,
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          status: 'failed',
          message: error.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'timeout',
          message: 'Request timeout',
        });
      });

      req.end();
    });
  }

  async checkTcp(
    host: string,
    port: number,
    timeout: number
  ): Promise<{ status: 'success' | 'failed' | 'timeout'; message?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve({ status: 'success' });
      });

      socket.on('error', (error) => {
        socket.destroy();
        resolve({
          status: 'failed',
          message: error.message,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          status: 'timeout',
          message: 'Connection timeout',
        });
      });

      socket.connect(port, host);
    });
  }
}

