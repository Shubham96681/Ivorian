import * as net from 'net';

export interface PortConfig {
  service: string;
  startPort: number;
  currentPort?: number;
}

export interface ServicePorts {
  [serviceName: string]: number;
}

/**
 * Find a free port starting from a given port number
 * @param startPort - The port number to start searching from
 * @param maxAttempts - Maximum number of ports to try (default: 100)
 * @returns Promise<number> - The first available port found
 */
export async function findFreePort(startPort: number = 3000, maxAttempts: number = 100): Promise<number> {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    const tryPort = (port: number): void => {
      // Create a temporary server to test if port is available
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => {
          resolve(port);
        });
        server.close();
      });

      server.on('error', () => {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error(`Could not find a free port after ${maxAttempts} attempts`));
          return;
        }
        currentPort++;
        tryPort(currentPort);
      });
    };

    tryPort(currentPort);
  });
}

/**
 * Check if a specific port is available
 * @param port - Port number to check
 * @returns Promise<boolean> - True if port is available, false otherwise
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Find multiple free ports for different services
 * @param portConfigs - Array of port configurations
 * @returns Promise<ServicePorts> - Object mapping service names to port numbers
 */
export async function findMultipleFreePorts(portConfigs: PortConfig[]): Promise<ServicePorts> {
  const servicePorts: ServicePorts = {};
  const usedPorts: Set<number> = new Set();

  for (const config of portConfigs) {
    let startPort = config.startPort;
    
    // Skip already used ports
    while (usedPorts.has(startPort)) {
      startPort++;
    }

    const freePort = await findFreePort(startPort);
    servicePorts[config.service] = freePort;
    usedPorts.add(freePort);
  }

  return servicePorts;
}

