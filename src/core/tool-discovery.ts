import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';
import logger from '../utils/logger.js';

export interface SkillDefinition {
  name: string;
  description: string;
  argumentHint?: string;
  allowedTools?: string[];
}

export interface MCPTool {
  name: string;
  server: string;
  description?: string;
}

export interface ToolCatalog {
  skills: SkillDefinition[];
  mcpTools: MCPTool[];
  timestamp: number;
}

export class ToolDiscovery {
  private catalog?: ToolCatalog;
  private claudeDir: string;

  constructor() {
    this.claudeDir = path.join(homedir(), '.claude');
  }

  async discoverTools(): Promise<ToolCatalog> {
    // Return cached catalog if recent (< 5 minutes old)
    if (this.catalog && Date.now() - this.catalog.timestamp < 5 * 60 * 1000) {
      return this.catalog;
    }

    logger.debug('Discovering Claude Code skills and MCPs');

    const skills = await this.discoverSkills();
    const mcpTools = await this.discoverMCPs();

    this.catalog = {
      skills,
      mcpTools,
      timestamp: Date.now()
    };

    logger.debug('Tool discovery complete', {
      skills: skills.length,
      mcpTools: mcpTools.length
    });

    return this.catalog;
  }

  private async discoverSkills(): Promise<SkillDefinition[]> {
    const skills: SkillDefinition[] = [];

    try {
      // Check blueprint skills
      const blueprintPath = path.join(this.claudeDir, 'blueprints/sf-adlc/skills.json');
      const blueprintData = await fs.readFile(blueprintPath, 'utf-8');
      const blueprintSkills = JSON.parse(blueprintData);

      if (blueprintSkills.skills && Array.isArray(blueprintSkills.skills)) {
        for (const skill of blueprintSkills.skills) {
          if (skill.name && skill.description) {
            skills.push({
              name: skill.name,
              description: skill.description,
              argumentHint: this.extractArgumentHint(skill.content),
              allowedTools: this.extractAllowedTools(skill.content)
            });
          }
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.debug('Failed to discover skills', { error: error.message });
      }
    }

    return skills;
  }

  private async discoverMCPs(): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];

    try {
      // Check blueprint MCPs
      const mcpPath = path.join(this.claudeDir, 'blueprints/sf-adlc/mcp-servers.json');
      const mcpData = await fs.readFile(mcpPath, 'utf-8');
      const mcpConfig = JSON.parse(mcpData);

      if (mcpConfig['mcp-servers']) {
        for (const [serverName, serverConfig] of Object.entries(mcpConfig['mcp-servers'])) {
          const config = serverConfig as any;
          if (config.tools && Array.isArray(config.tools)) {
            for (const toolName of config.tools) {
              tools.push({
                name: toolName,
                server: serverName,
                description: this.getToolDescription(serverName, toolName)
              });
            }
          }
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.debug('Failed to discover MCPs', { error: error.message });
      }
    }

    return tools;
  }

  private extractArgumentHint(content: string): string | undefined {
    const match = content.match(/argument-hint:\s*(.+)/);
    return match ? match[1].trim() : undefined;
  }

  private extractAllowedTools(content: string): string[] | undefined {
    const match = content.match(/allowed-tools:\s*(.+)/);
    if (!match) return undefined;

    return match[1].split(',').map(t => t.trim());
  }

  private getToolDescription(server: string, tool: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      confluence: {
        confluence_searchContent: 'Search Confluence for documentation and pages',
        confluence_getContent: 'Get specific Confluence page content by ID',
        confluence_searchSpace: 'Search for Confluence spaces'
      },
      'gus-mcp': {
        query_gus_records: 'Query GUS work items using natural language'
      },
      github: {
        search_code: 'Search GitHub code repositories'
      },
      slack: {
        slack_search_public: 'Search public Slack channels and messages'
      },
      'claude-mem': {
        save_memory: 'Save information to long-term memory',
        search: 'Search saved memories'
      }
    };

    return descriptions[server]?.[tool] || `${server}: ${tool}`;
  }

  formatToolsForPrompt(catalog: ToolCatalog): string {
    let prompt = '\n\n# Available Tools\n\n';

    // Add skills
    if (catalog.skills.length > 0) {
      prompt += '## Skills (Workflows)\n\n';
      for (const skill of catalog.skills.slice(0, 10)) { // Limit to 10 most common
        prompt += `- **${skill.name}**: ${skill.description}\n`;
        if (skill.argumentHint) {
          prompt += `  Usage: /${skill.name} ${skill.argumentHint}\n`;
        }
      }
      prompt += '\n';
    }

    // Add MCP tools
    if (catalog.mcpTools.length > 0) {
      prompt += '## External Tools (MCPs)\n\n';

      // Group by server
      const byServer: Record<string, MCPTool[]> = {};
      for (const tool of catalog.mcpTools) {
        if (!byServer[tool.server]) byServer[tool.server] = [];
        byServer[tool.server].push(tool);
      }

      for (const [server, tools] of Object.entries(byServer)) {
        prompt += `### ${server}\n`;
        for (const tool of tools) {
          prompt += `- **${tool.name}**: ${tool.description}\n`;
        }
        prompt += '\n';
      }
    }

    prompt += `\n**Note**: To use a tool, respond with: TOOL_USE: <tool_name> <arguments>\n`;
    prompt += `Example: TOOL_USE: slack_search_public query="architecture decisions"\n\n`;

    return prompt;
  }
}
