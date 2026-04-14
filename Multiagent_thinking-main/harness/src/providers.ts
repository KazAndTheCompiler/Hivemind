export interface ProviderConfig {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  timeout: number;
}

export interface ModelResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface ProviderAdapter {
  name: string;
  call(model: string, messages: Array<{ role: string; content: string }>, maxTokens?: number): Promise<ModelResponse>;
  validateConfig(config: ProviderConfig): boolean;
}

export function createOpenRouterAdapter(apiKey: string, defaultModel = 'z-ai/glm-4.5-air:free'): ProviderAdapter {
  return {
    name: 'openrouter',
    
    async call(model: string, messages: Array<{ role: string; content: string }>, maxTokens = 150): Promise<ModelResponse> {
      const actualModel = model === 'default' ? defaultModel : model;
      
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://claw-code.dev',
            'X-Title': 'Emission Harness',
          },
          body: JSON.stringify({
            model: actualModel,
            messages,
            max_tokens: maxTokens,
            temperature: 0.1,
          }),
        });
        
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          lastError = new Error(`Rate limited (429) - retry ${attempt + 1}`);
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
          content: data.choices?.[0]?.message?.content || '',
          usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: actualModel,
        };
      }
      
      throw lastError || new Error('Failed after 3 retries');
    },
    
    validateConfig(config: ProviderConfig): boolean {
      return !!config.apiKey;
    },
  };
}

export function createMockAdapter(): ProviderAdapter {
  return {
    name: 'mock',
    
    async call(model: string, messages: Array<{ role: string; content: string }>, maxTokens = 150): Promise<ModelResponse> {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const lastMessage = messages[messages.length - 1]?.content || '';
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      
      let content = '';
      
      const isProgressRequest = systemMessage.includes('interface Progress');
      const isAdrRequest = systemMessage.includes('interface ADRSchema');
      const isVerificationRequest = systemMessage.includes('interface VerificationSchema');
      
      if (isVerificationRequest) {
        content = `interface VerificationSchema {
  taskId: "task-1";
  verified: true;
  confidence: 0.9;
  findings: ["Canvas initialized", "Game loop running"];
  nextAction: "continue";
}`;
      } else if (isProgressRequest) {
        content = `interface Progress {
  taskId: "task-1";
  agent: "worker-1";
  phase: "implementation";
  done: ["Created index.html with canvas", "Added game state variables in snake.js"];
  blockers: [];
  touchedFiles: ["index.html", "snake.js"];
}`;
      } else if (isAdrRequest) {
        content = `interface ADRSchema {
  taskId: "task-1";
  agent: "worker-1";
  objective: "Build a snake game";
  ownedFiles: ["snake.js", "index.html"];
  emitFormat: "typescript_v1";
}`;
      } else {
        content = `interface Progress {
  taskId: "task-1";
  agent: "worker-1";
  phase: "implementation";
  done: ["Created snake game files"];
  blockers: [];
}`;
      }
      
      return {
        content,
        usage: { prompt_tokens: 50, completion_tokens: 80, total_tokens: 130 },
        model: 'mock',
      };
    },
    
    validateConfig(): boolean {
      return true;
    },
  };
}

export function getProviderFromEnv(): ProviderAdapter | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    return createOpenRouterAdapter(apiKey);
  }
  return null;
}

export class ProviderManager {
  private providers: Map<string, ProviderAdapter> = new Map();
  private defaultProvider: string = 'mock';
  
  register(name: string, adapter: ProviderAdapter): void {
    this.providers.set(name, adapter);
  }
  
  get(name: string): ProviderAdapter | undefined {
    return this.providers.get(name);
  }
  
  setDefault(name: string): void {
    if (this.providers.has(name)) {
      this.defaultProvider = name;
    }
  }
  
  getDefault(): ProviderAdapter {
    return this.providers.get(this.defaultProvider) || createMockAdapter();
  }
  
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}