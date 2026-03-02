import { Ollama } from 'ollama';
import { ModelResponse, RouteTarget } from '../types/index.js';
import logger from '../utils/logger.js';
import { ToolDiscovery, ToolCatalog } from './tool-discovery.js';
import { ToolExecutor, ToolExecutionResult } from './tool-executor.js';
import { SkillTracker } from './skill-tracker.js';

export class LocalExecutor {
  private ollama: Ollama;
  private modelMap: Map<RouteTarget, string>;
  private toolDiscovery: ToolDiscovery;
  private toolExecutor: ToolExecutor;
  private toolsEnabled: boolean;
  private toolCatalog?: ToolCatalog;
  private skillTracker?: SkillTracker;

  constructor(
    codeModelName: string,
    compressModelName: string,
    enableTools: boolean = true
  ) {
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
    this.modelMap = new Map([
      ['local_code', codeModelName],
      ['local_compress', compressModelName]
    ]);
    this.toolDiscovery = new ToolDiscovery();
    this.toolExecutor = new ToolExecutor();
    this.toolsEnabled = enableTools;
  }

  async initialize(): Promise<void> {
    if (this.toolsEnabled) {
      try {
        this.toolCatalog = await this.toolDiscovery.discoverTools();
        logger.debug('Tools enabled for local execution', {
          skills: this.toolCatalog.skills.length,
          mcpTools: this.toolCatalog.mcpTools.length
        });
      } catch (error) {
        logger.debug('Tool discovery failed, continuing without tools', { error });
        this.toolsEnabled = false;
      }
    }
  }

  setSkillTracker(tracker: SkillTracker): void {
    this.skillTracker = tracker;
  }

  async execute(
    target: RouteTarget,
    prompt: string,
    context?: string,
    history?: string
  ): Promise<ModelResponse> {
    if (target === 'claude') {
      throw new Error('LocalExecutor cannot handle Claude routing');
    }

    const modelName = this.modelMap.get(target);
    if (!modelName) {
      throw new Error(`No model configured for target: ${target}`);
    }

    const startTime = Date.now();

    try {
      // Check if this is a direct skill invocation (e.g., "/budget", "/skill-name args")
      const directSkillResult = await this.tryDirectSkillExecution(prompt);
      if (directSkillResult) {
        logger.info('Direct skill execution completed', {
          prompt: prompt.split(' ')[0],
          latency: Date.now() - startTime
        });
        return {
          content: directSkillResult.output,
          model: `${modelName} (direct-skill)`,
          tokens: 0,
          latency: Date.now() - startTime
        };
      }

      // Build prompt with tool awareness and conversation history
      let fullPrompt = this.buildPromptWithTools(prompt, context, history);

      // Execute with tool loop (max 3 tool calls)
      let finalResponse = '';
      let totalTokens = 0;
      let iterationCount = 0;
      const maxIterations = 3;

      while (iterationCount < maxIterations) {
        iterationCount++;

        const response = await this.ollama.generate({
          model: modelName,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: target === 'local_code' ? 0.2 : 0.3,
            num_predict: target === 'local_code' ? 2048 : 1024, // Reduced for speed
            num_ctx: 4096, // Limit context window for performance
          }
        });

        totalTokens += response.eval_count || 0;
        const responseText = response.response;

        // Check if model wants to use a tool
        const toolCall = this.toolExecutor.parseToolCall(responseText);

        if (!toolCall || !this.toolsEnabled || !this.toolCatalog) {
          // No tool use, strip any TOOL_USE artifacts and return
          finalResponse = this.cleanToolArtifacts(responseText);
          break;
        }

        logger.debug('Tool call detected', { tool: toolCall.tool, params: toolCall.params });

        // Execute the tool
        const toolResult = await this.executeToolCall(toolCall.tool, toolCall.params);

        logger.debug('Tool executed', {
          tool: toolCall.tool,
          success: toolResult.success,
          outputLength: toolResult.output.length
        });

        // If tool execution failed and this is first iteration, just return cleaned response
        if (!toolResult.success && iterationCount === 1) {
          finalResponse = this.cleanToolArtifacts(responseText);
          break;
        }

        // Add tool result to context for next iteration
        const cleanResponse = this.cleanToolArtifacts(responseText);
        fullPrompt = `${fullPrompt}\n\nAssistant: ${cleanResponse}\n\n[Tool Result]: ${toolResult.output}\n\nPlease provide your final response based on the tool result:`;

        // If tool succeeded and we have output, that becomes our response
        if (toolResult.success && toolResult.output) {
          finalResponse = toolResult.output;
          break;
        }

        // If last iteration, include what we have
        if (iterationCount === maxIterations) {
          finalResponse = toolResult.success ? toolResult.output : this.cleanToolArtifacts(responseText);
          break;
        }
      }

      const latency = Date.now() - startTime;

      logger.debug('Local model executed', {
        model: modelName,
        target,
        latency,
        iterations: iterationCount,
        responseLength: finalResponse.length
      });

      return {
        content: finalResponse,
        model: modelName,
        tokens: totalTokens,
        latency
      };
    } catch (error) {
      logger.error('Local execution failed', { error, model: modelName });
      throw error;
    }
  }

  private buildPromptWithTools(prompt: string, context?: string, history?: string): string {
    let fullPrompt = '';

    // Only add tools if the prompt seems tool-related (optimization)
    const needsTools = this.promptNeedsTools(prompt);
    if (needsTools && this.toolsEnabled && this.toolCatalog) {
      const toolsSection = this.toolDiscovery.formatToolsForPrompt(this.toolCatalog);
      fullPrompt += toolsSection;
    }

    // Add conversation history for context continuity
    if (history) {
      fullPrompt += `\nConversation History:\n${history}\n`;
    }

    // Add context
    if (context) {
      fullPrompt += `\nContext:\n${context}\n`;
    }

    // Add user prompt
    fullPrompt += `\nTask:\n${prompt}\n`;

    return fullPrompt;
  }

  private async tryDirectSkillExecution(prompt: string): Promise<{ output: string } | null> {
    if (!this.toolsEnabled || !this.toolCatalog) {
      return null;
    }

    // Check if prompt is a direct skill invocation (e.g., "/budget", "/skill-name args")
    const trimmed = prompt.trim();
    if (!trimmed.startsWith('/')) {
      return null;
    }

    // Parse skill name and args
    const parts = trimmed.substring(1).split(/\s+/);
    const skillName = parts[0];
    const args = parts.slice(1).join(' ');

    // Find skill in catalog
    const skill = this.toolCatalog.skills.find(s => s.name === skillName);
    if (!skill) {
      // Skill not found, return helpful message
      logger.debug('Skill not found in catalog', { skillName });
      return {
        output: `Skill '/${skillName}' not found. Use '/' to see available skills, or try 'kochava --sessions' to list recent sessions.`
      };
    }

    logger.debug('Direct skill execution', { skill: skillName, args });

    // Execute the skill
    const result = await this.executeToolCall(skillName, { args });

    if (result.success) {
      // Track success
      if (this.skillTracker) {
        this.skillTracker.recordLocalSuccess(skillName);
      }
      return { output: result.output };
    }

    // Track failure
    if (this.skillTracker) {
      this.skillTracker.recordLocalFailure(skillName);
    }

    // Return error message
    return {
      output: result.error || `Failed to execute skill '/${skillName}'. The skill may not be properly configured.`
    };
  }

  private promptNeedsTools(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();

    // Check for tool-related keywords
    const toolKeywords = [
      'search', 'find', 'query', 'get', 'fetch', 'retrieve',
      'slack', 'github', 'confluence', 'gus', 'cuala',
      'w-', 'work item', 'pull request', 'pr', 'issue',
      'test', 'execute', 'run', 'memory', 'save', 'remember'
    ];

    // Don't include tools for direct skill invocations (handled separately)
    if (lowerPrompt.startsWith('/')) {
      return false;
    }

    // Check for tool keywords
    return toolKeywords.some(keyword => lowerPrompt.includes(keyword));
  }

  private cleanToolArtifacts(text: string): string {
    // Remove TOOL_USE lines and clean up
    return text
      .replace(/TOOL_USE:\s*\S+.*$/gm, '')
      .trim();
  }

  private async executeToolCall(tool: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    if (!this.toolCatalog) {
      return {
        success: false,
        output: '',
        error: 'Tools not available'
      };
    }

    // Check if it's a skill
    const skill = this.toolCatalog.skills.find(s => s.name === tool);
    if (skill) {
      const args = params.args || Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');

      const result = await this.toolExecutor.executeSkill(skill, args);

      // Track skill success/failure
      if (this.skillTracker) {
        if (result.success) {
          this.skillTracker.recordLocalSuccess(skill.name);
        } else {
          this.skillTracker.recordLocalFailure(skill.name);
        }
      }

      return result;
    }

    // Check if it's an MCP tool
    const mcpTool = this.toolCatalog.mcpTools.find(t => t.name === tool);
    if (mcpTool) {
      return await this.toolExecutor.executeMCPTool(mcpTool, params);
    }

    return {
      success: false,
      output: '',
      error: `Unknown tool: ${tool}`
    };
  }

  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const response = await this.ollama.list();
      return response.models.some(m => m.name === modelName);
    } catch (error) {
      logger.error('Failed to check model availability', { error, modelName });
      return false;
    }
  }

  async getToolCounts(): Promise<{ skills: number; mcps: number }> {
    if (!this.toolCatalog) {
      return { skills: 0, mcps: 0 };
    }

    return {
      skills: this.toolCatalog.skills.length,
      mcps: this.toolCatalog.mcpTools.length
    };
  }
}
