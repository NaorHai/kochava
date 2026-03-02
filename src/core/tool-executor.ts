import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';
import { MCPTool, SkillDefinition } from './tool-discovery.js';

const execAsync = promisify(exec);

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

export class ToolExecutor {
  async executeSkill(skill: SkillDefinition, args: string): Promise<ToolExecutionResult> {
    try {
      logger.debug('Executing skill', { skill: skill.name, args });

      // Execute via Claude Code CLI if available
      const command = `claude --skill ${skill.name} ${args}`;

      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });

      return {
        success: true,
        output: stdout || stderr
      };
    } catch (error: any) {
      logger.debug('Skill execution failed', {
        skill: skill.name,
        error: error.message
      });

      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  async executeMCPTool(tool: MCPTool, params: Record<string, any>): Promise<ToolExecutionResult> {
    try {
      logger.debug('Executing MCP tool', { tool: tool.name, server: tool.server });

      // For common MCPs, use direct integrations
      switch (tool.server) {
        case 'slack':
          return await this.executeSlackTool(tool.name, params);

        case 'github':
          return await this.executeGitHubTool(tool.name, params);

        case 'confluence':
          return await this.executeConfluenceTool(tool.name, params);

        case 'gus-mcp':
          return await this.executeGUSTool(tool.name, params);

        default:
          return {
            success: false,
            output: '',
            error: `MCP server '${tool.server}' not supported yet`
          };
      }
    } catch (error: any) {
      logger.debug('MCP tool execution failed', {
        tool: tool.name,
        error: error.message
      });

      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  private async executeSlackTool(tool: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    // Use Slack CLI if available
    try {
      const query = params.query || params.q || '';
      const command = `slack search "${query}" --count 5`;

      const { stdout } = await execAsync(command, { timeout: 10000 });

      return {
        success: true,
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        output: 'Slack tool not available (requires Slack CLI setup)',
        error: 'Slack CLI not configured'
      };
    }
  }

  private async executeGitHubTool(tool: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    // Use GitHub CLI
    try {
      const query = params.q || params.query || '';
      const command = `gh search code "${query}" --limit 5`;

      const { stdout } = await execAsync(command, { timeout: 15000 });

      return {
        success: true,
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        output: 'GitHub tool not available (requires gh CLI)',
        error: 'GitHub CLI not configured'
      };
    }
  }

  private async executeConfluenceTool(tool: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    return {
      success: false,
      output: 'Confluence integration requires MCP server setup',
      error: 'Not implemented - use Claude for Confluence access'
    };
  }

  private async executeGUSTool(tool: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    return {
      success: false,
      output: 'GUS integration requires MCP server setup',
      error: 'Not implemented - use Claude for GUS access'
    };
  }

  parseToolCall(response: string): { tool: string; params: Record<string, any> } | null {
    // Parse "TOOL_USE: tool_name param1=value1 param2=value2"
    const match = response.match(/TOOL_USE:\s*(\w+)\s+(.+)/i);
    if (!match) return null;

    const [, toolName, paramsStr] = match;
    const params: Record<string, any> = {};

    // Parse key=value pairs
    const paramMatches = paramsStr.matchAll(/(\w+)=["']?([^"'\s]+)["']?/g);
    for (const paramMatch of paramMatches) {
      const [, key, value] = paramMatch;
      params[key] = value;
    }

    // Also check for quoted strings
    const quotedMatch = paramsStr.match(/["']([^"']+)["']/);
    if (quotedMatch && Object.keys(params).length === 0) {
      params.query = quotedMatch[1];
    }

    return { tool: toolName, params };
  }

  formatToolResult(tool: string, result: ToolExecutionResult): string {
    if (!result.success) {
      return `\n[Tool '${tool}' failed: ${result.error || 'Unknown error'}]\n`;
    }

    return `\n[Tool '${tool}' output:]\n${result.output}\n`;
  }
}
