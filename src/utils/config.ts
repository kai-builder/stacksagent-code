import { promises as fs } from 'fs';
import { dirname } from 'path';
import { Config } from '../types/index.js';
import { DEFAULT_CONFIG, DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_PATH } from './constants.js';

export class ConfigManager {
  private config: Config;
  private configPath: string;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath;
    this.config = { ...DEFAULT_CONFIG };
  }

  async load(): Promise<Config> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const loaded = JSON.parse(data);
      this.config = { ...DEFAULT_CONFIG, ...loaded };
      return this.config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Config doesn't exist, create with defaults
        await this.save();
        return this.config;
      }
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }

  async save(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  get(): Config {
    return this.config;
  }

  update(partial: Partial<Config>): void {
    this.config = { ...this.config, ...partial };
  }

  async ensureConfigDir(): Promise<void> {
    await fs.mkdir(DEFAULT_CONFIG_DIR, { recursive: true });
  }
}

export const configManager = new ConfigManager();
