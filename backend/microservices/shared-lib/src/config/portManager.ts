import { findFreePort, findMultipleFreePorts, PortConfig, ServicePorts } from '../utils/portFinder';
import * as fs from 'fs';
import * as path from 'path';

export class PortManager {
  private static instance: PortManager;
  private portConfig: ServicePorts = {};
  private configFile: string;

  private constructor() {
    this.configFile = path.join(process.cwd(), '.port-config.json');
    this.loadPortConfig();
  }

  public static getInstance(): PortManager {
    if (!PortManager.instance) {
      PortManager.instance = new PortManager();
    }
    return PortManager.instance;
  }

  /**
   * Initialize ports for all services
   */
  public async initializePorts(): Promise<ServicePorts> {
    const portConfigs: PortConfig[] = [
      { service: 'frontend', startPort: 3000 },
      { service: 'api-gateway', startPort: 8000 },
      { service: 'auth-service', startPort: 3001 },
      { service: 'property-service', startPort: 3002 },
      { service: 'user-service', startPort: 3003 },
      { service: 'notification-service', startPort: 3004 },
      { service: 'file-service', startPort: 3005 }
    ];

    try {
      this.portConfig = await findMultipleFreePorts(portConfigs);
      this.savePortConfig();
      return this.portConfig;
    } catch (error) {
      console.error('Failed to initialize ports:', error);
      throw error;
    }
  }

  /**
   * Get port for a specific service
   */
  public getPort(serviceName: string): number | undefined {
    return this.portConfig[serviceName];
  }

  /**
   * Get all assigned ports
   */
  public getAllPorts(): ServicePorts {
    return { ...this.portConfig };
  }

  /**
   * Find a free port for a specific service
   */
  public async findPortForService(serviceName: string, startPort: number = 3000): Promise<number> {
    const usedPorts = Object.values(this.portConfig);
    let port = startPort;

    // Skip already used ports
    while (usedPorts.includes(port)) {
      port++;
    }

    const freePort = await findFreePort(port);
    this.portConfig[serviceName] = freePort;
    this.savePortConfig();
    return freePort;
  }

  /**
   * Load port configuration from file
   */
  private loadPortConfig(): void {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        this.portConfig = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load port config:', error);
    }
  }

  /**
   * Save port configuration to file
   */
  private savePortConfig(): void {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.portConfig, null, 2));
    } catch (error) {
      console.warn('Failed to save port config:', error);
    }
  }

  /**
   * Clear port configuration
   */
  public clearPortConfig(): void {
    this.portConfig = {};
    if (fs.existsSync(this.configFile)) {
      fs.unlinkSync(this.configFile);
    }
  }

  /**
   * Get service URL
   */
  public getServiceUrl(serviceName: string, path: string = ''): string {
    const port = this.getPort(serviceName);
    if (!port) {
      throw new Error(`Port not found for service: ${serviceName}`);
    }
    return `http://localhost:${port}${path}`;
  }

  /**
   * Display current port configuration
   */
  public displayPorts(): void {
    console.log('\n🚀 Service Port Configuration:');
    console.log('================================');
    
    Object.entries(this.portConfig).forEach(([service, port]) => {
      const serviceName = service.padEnd(20);
      const url = `http://localhost:${port}`;
      console.log(`   ${serviceName} ${url}`);
    });
    
    console.log('================================\n');
  }
}

