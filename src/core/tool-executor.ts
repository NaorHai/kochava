import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';
import { MCPTool, SkillDefinition } from './tool-discovery.js';
import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  isSkillInstructions?: boolean;
}

export class ToolExecutor {
  async executeSkill(skill: SkillDefinition, args: string): Promise<ToolExecutionResult> {
    try {
      logger.debug('Executing skill', { skill: skill.name, args });

      // Read skill definition from .md file
      const skillContent = await this.readSkillDefinition(skill.name);

      if (skillContent) {
        // Parse skill metadata to determine execution method
        const metadata = this.parseSkillMetadata(skillContent);

        logger.debug('Parsed skill metadata', {
          skill: skill.name,
          hasAllowedTools: !!metadata.allowedTools,
          allowedTools: metadata.allowedTools
        });

        if (metadata.allowedTools?.includes('Bash')) {
          // Extract and execute bash commands directly
          const bashCommands = this.extractBashCommands(skillContent);

          logger.debug('Extracted bash commands', {
            skill: skill.name,
            commandCount: bashCommands.length
          });

          if (bashCommands.length > 0) {
            logger.debug('Executing bash commands from skill', {
              skill: skill.name,
              commandCount: bashCommands.length
            });

            return await this.executeBashCommands(bashCommands, skill.name);
          }
        }

        // For non-bash skills, return instructions for model to follow
        return {
          success: true,
          output: skillContent,
          isSkillInstructions: true
        };
      }

      // Skill definition not found
      return {
        success: false,
        output: '',
        error: `Skill '${skill.name}' definition not found`
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

  /**
   * Parse skill YAML frontmatter metadata
   */
  private parseSkillMetadata(content: string): { allowedTools?: string[] } {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return {};
    }

    const metadata: any = {};
    const lines = frontmatterMatch[1].split('\n');

    for (const line of lines) {
      if (line.includes('allowed-tools:')) {
        const toolsStr = line.split(':')[1]?.trim();
        metadata.allowedTools = toolsStr ? [toolsStr] : [];
      }
    }

    return metadata;
  }

  /**
   * Extract bash commands from markdown code blocks
   * Supports: ```bash, ```sh, ```shell
   */
  private extractBashCommands(content: string): string[] {
    const commands: string[] = [];
    const codeBlockRegex = /```(?:bash|sh|shell)\n([\s\S]*?)```/g;

    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const command = match[1].trim();
      if (command && !command.startsWith('#') && command.length > 0) {
        commands.push(command);
      }
    }

    return commands;
  }

  /**
   * Execute bash commands and return results
   */
  private async executeBashCommands(commands: string[], skillName: string): Promise<ToolExecutionResult> {
    const results: string[] = [];
    let hasError = false;

    for (const command of commands) {
      try {
        logger.debug('Executing bash command', {
          skill: skillName,
          command: command.substring(0, 100)
        });

        const { stdout, stderr } = await execAsync(command, {
          timeout: 30000, // 30 second timeout per command
          maxBuffer: 1024 * 1024 * 10,
          shell: '/bin/bash'
        });

        const output = (stdout || stderr).trim();
        if (output) {
          results.push(output);
        }
      } catch (error: any) {
        hasError = true;
        const errorMsg = error.stderr || error.message || 'Command execution failed';
        results.push(`Error: ${errorMsg}`);
        logger.debug('Bash command failed', {
          skill: skillName,
          error: errorMsg
        });
      }
    }

    const output = results.join('\n\n');

    return {
      success: !hasError,
      output: output || 'Command executed but produced no output'
    };
  }

  private async readSkillDefinition(skillName: string): Promise<string | null> {
    const possiblePaths = [
      // Try commands directory
      path.join(homedir(), '.claude', 'commands', `${skillName}.md`),
      // Try skills directory (Claude Code v0.9+)
      path.join(homedir(), '.claude', 'skills', skillName, 'skill.md'),
      // Try blueprints
      path.join(homedir(), '.claude', 'blueprints', 'sf-adlc', 'commands', `${skillName}.md`),
      // Try plugins
      path.join(homedir(), '.claude', 'plugins', skillName, 'SKILL.md'),
    ];

    for (const filePath of possiblePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        logger.debug('Found skill definition', { skill: skillName, path: filePath });
        return content;
      } catch (error) {
        // File doesn't exist, try next path
        continue;
      }
    }

    logger.debug('Skill definition file not found', { skill: skillName });
    return null;
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
    const match = response.match(/TOOL_USE:\s*([\w-]+)\s+(.+)/i);
    if (!match) return null;

    const [, toolName, paramsStr] = match;
    const params: Record<string, any> = {};

    // Parse key=value pairs
    const paramMatches = paramsStr.matchAll(/(\w+)=["']?([^"'\s]+)["']?/g);
    for (const paramMatch of paramMatches) {
      const [, key, value] = paramMatch;
      params[key] = value;
    }

    // If no key=value pairs, treat entire string as arguments
    if (Object.keys(params).length === 0) {
      params.args = paramsStr.trim();
    }

    // Also check for quoted strings
    const quotedMatch = paramsStr.match(/["']([^"']+)["']/);
    if (quotedMatch && !params.args) {
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
