import fs from 'fs';
import path from 'path';
import { RuntimeConfigSchema, type RuntimeConfig, type RuntimeConfigInput } from './schema';

const DEFAULT_CONFIG_FILE = 'secdev.config.json';

export class ConfigLoader {
  private config: RuntimeConfig;

  constructor(input?: RuntimeConfigInput) {
    this.config = RuntimeConfigSchema.parse(input ?? {});
  }

  static fromFile(filePath: string): ConfigLoader {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const input: RuntimeConfigInput = JSON.parse(raw);
    return new ConfigLoader(input);
  }

  static fromProjectRoot(rootPath: string): ConfigLoader {
    const configFile = path.join(rootPath, DEFAULT_CONFIG_FILE);
    if (fs.existsSync(configFile)) {
      return ConfigLoader.fromFile(configFile);
    }
    return new ConfigLoader({ rootPath });
  }

  static defaults(): ConfigLoader {
    return new ConfigLoader();
  }

  get(): RuntimeConfig {
    return this.config;
  }

  validate(): { valid: boolean; errors: string[] } {
    const result = RuntimeConfigSchema.safeParse(this.config);
    if (result.success) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }
}

export { RuntimeConfigSchema, type RuntimeConfig, type RuntimeConfigInput };
