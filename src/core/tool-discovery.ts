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
    const discoveredServers = new Set<string>();

    // 1. Check Claude Code global settings
    try {
      const settingsPath = path.join(this.claudeDir, 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsData);

      if (settings.mcpServers) {
        for (const [serverName, serverConfig] of Object.entries(settings.mcpServers)) {
          const config = serverConfig as any;
          if (config.command) {
            discoveredServers.add(serverName);
            // Extract tools from server name patterns
            const toolsFromServer = this.inferToolsFromServer(serverName);
            for (const toolName of toolsFromServer) {
              tools.push({
                name: toolName,
                server: serverName,
                description: this.getToolDescription(serverName, toolName)
              });
            }
          }
        }
        logger.debug('Discovered MCPs from Claude Code settings', { servers: discoveredServers.size });
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.debug('Failed to discover MCPs from settings', { error: error.message });
      }
    }

    // 2. Check blueprint MCPs (if not already discovered)
    try {
      const mcpPath = path.join(this.claudeDir, 'blueprints/sf-adlc/mcp-servers.json');
      const mcpData = await fs.readFile(mcpPath, 'utf-8');
      const mcpConfig = JSON.parse(mcpData);

      if (mcpConfig['mcp-servers']) {
        for (const [serverName, serverConfig] of Object.entries(mcpConfig['mcp-servers'])) {
          const config = serverConfig as any;
          if (config.tools && Array.isArray(config.tools)) {
            for (const toolName of config.tools) {
              // Avoid duplicates
              const exists = tools.some(t => t.name === toolName && t.server === serverName);
              if (!exists) {
                tools.push({
                  name: toolName,
                  server: serverName,
                  description: this.getToolDescription(serverName, toolName)
                });
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.debug('Failed to discover blueprint MCPs', { error: error.message });
      }
    }

    return tools;
  }

  private inferToolsFromServer(serverName: string): string[] {
    // Map common MCP server names to their tools
    const serverToolMap: Record<string, string[]> = {
      'github': ['github_search_code', 'github_get_file', 'github_create_pr', 'github_list_issues'],
      'slack': ['slack_search_public', 'slack_send_message', 'slack_read_channel'],
      'confluence': ['confluence_searchContent', 'confluence_getContent', 'confluence_searchSpace'],
      'gus-mcp': ['query_gus_records'],
      'cuala': ['cuala_execute_scenario', 'cuala_generate_plan', 'cuala_get_status'],
      'claude-mem': ['search', 'timeline', 'get_observations', 'save_memory']
    };

    // Try exact match
    if (serverToolMap[serverName]) {
      return serverToolMap[serverName];
    }

    // Try partial match
    for (const [key, tools] of Object.entries(serverToolMap)) {
      if (serverName.includes(key) || key.includes(serverName)) {
        return tools;
      }
    }

    // Return generic tool name based on server
    return [`${serverName}_execute`];
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
        confluence_searchSpace: 'Search for Confluence spaces',
        confluence_createContent: 'Create new Confluence pages',
        confluence_updateContent: 'Update existing Confluence pages'
      },
      'gus-mcp': {
        query_gus_records: 'Query GUS work items using natural language'
      },
      github: {
        search_code: 'Search GitHub code repositories',
        github_get_file: 'Get file contents from GitHub',
        github_create_pr: 'Create pull request on GitHub',
        github_list_issues: 'List GitHub issues',
        github_search_code: 'Search code in GitHub repositories',
        mcp__github__get_file_contents: 'Get file contents from GitHub',
        mcp__github__create_pull_request: 'Create pull request',
        mcp__github__search_code: 'Search code in repositories'
      },
      slack: {
        slack_search_public: 'Search public Slack channels',
        slack_send_message: 'Send message to Slack channel',
        slack_read_channel: 'Read messages from Slack channel',
        slack_send_message_draft: 'Create draft message in Slack',
        mcp__slack__slack_search_public: 'Search public Slack channels',
        mcp__slack__slack_send_message: 'Send Slack message'
      },
      cuala: {
        cuala_execute_scenario: 'Execute browser automation scenario',
        cuala_generate_plan: 'Generate test execution plan',
        cuala_get_status: 'Get test execution status',
        mcp__cuala__cuala_execute_scenario: 'Execute browser automation'
      },
      'claude-mem': {
        search: 'Search memory for observations',
        timeline: 'Get context timeline around results',
        get_observations: 'Fetch full observation details',
        save_memory: 'Save manual memory/observation',
        mcp__claude_mem__search: 'Search memory',
        mcp__claude_mem__save_memory: 'Save to memory',
        mcp__claude_mem__timeline: 'Get context timeline',
        mcp__claude_mem__get_observations: 'Get observation details'
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
