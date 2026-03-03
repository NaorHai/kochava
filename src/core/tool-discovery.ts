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

    // Add built-in shell tool for bash command execution
    const builtInShellTool: SkillDefinition = {
      name: 'shell',
      description: 'Execute bash/shell commands directly (ls, cat, grep, find, etc.). Use for file operations, system commands, and terminal tasks.',
      argumentHint: 'command="bash command to execute"'
    };
    skills.unshift(builtInShellTool); // Add at front for high priority

    this.catalog = {
      skills,
      mcpTools,
      timestamp: Date.now()
    };

    logger.debug('Tool discovery complete', {
      skills: skills.length,
      mcpTools: mcpTools.length,
      builtInTools: 1
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
    // Map common MCP server names to their comprehensive tool sets
    const serverToolMap: Record<string, string[]> = {
      'github': [
        // Commit operations
        'mcp__github__list_commits', 'mcp__github__get_commit',
        // Branch operations
        'mcp__github__list_branches', 'mcp__github__create_branch',
        // Pull request operations
        'mcp__github__list_pull_requests', 'mcp__github__get_pull_request',
        'mcp__github__create_pull_request', 'mcp__github__update_pull_request',
        'mcp__github__merge_pull_request', 'mcp__github__get_pull_request_diff',
        'mcp__github__get_pull_request_files', 'mcp__github__get_pull_request_comments',
        // Issue operations
        'mcp__github__list_issues', 'mcp__github__get_issue', 'mcp__github__create_issue',
        'mcp__github__update_issue', 'mcp__github__add_issue_comment', 'mcp__github__get_issue_comments',
        // Code and file operations
        'mcp__github__search_code', 'mcp__github__get_file_contents',
        'mcp__github__create_or_update_file', 'mcp__github__push_files',
        // Repository operations
        'mcp__github__list_tags', 'mcp__github__get_tag', 'mcp__github__create_repository',
        'mcp__github__fork_repository', 'mcp__github__search_repositories',
        // Review operations
        'mcp__github__create_pending_pull_request_review', 'mcp__github__submit_pending_pull_request_review',
        'mcp__github__get_pull_request_reviews', 'mcp__github__request_copilot_review'
      ],
      'slack': [
        'mcp__slack__slack_search_public', 'mcp__slack__slack_send_message',
        'mcp__slack__slack_read_channel', 'mcp__slack__slack_read_thread',
        'mcp__slack__slack_send_message_draft', 'mcp__slack__slack_schedule_message',
        'mcp__slack__slack_search_channels', 'mcp__slack__slack_create_canvas',
        'mcp__slack__slack_read_canvas'
      ],
      'confluence': [
        'mcp__confluence__confluence_searchContent', 'mcp__confluence__confluence_getContent',
        'mcp__confluence__confluence_searchSpace', 'mcp__confluence__confluence_createContent',
        'mcp__confluence__confluence_updateContent'
      ],
      'gus-mcp': ['mcp__gus_mcp__query_gus_records'],
      'cuala': [
        'mcp__cuala__cuala_execute_scenario', 'mcp__cuala__cuala_execute_scenario_async',
        'mcp__cuala__cuala_generate_plan', 'mcp__cuala__cuala_execute_plan',
        'mcp__cuala__cuala_get_status', 'mcp__cuala__cuala_get_plan',
        'mcp__cuala__cuala_list_plans', 'mcp__cuala__cuala_update_plan'
      ],
      'claude-mem': [
        'mcp__claude_mem__search', 'mcp__claude_mem__timeline',
        'mcp__claude_mem__get_observations', 'mcp__claude_mem__save_memory'
      ]
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
    // Rich, query-aligned descriptions with natural language variations for semantic matching
    const descriptions: Record<string, Record<string, string>> = {
      github: {
        // Commit operations - natural variations for queries like "list my commits", "recent changes", "commit history"
        'mcp__github__list_commits': 'List commits, commit history, recent changes, code changes, what was committed, recent code updates, see commits, show commit log, git history, changes made, recent updates by author',
        'mcp__github__get_commit': 'Get commit details, view specific commit, show commit info, commit changes, what changed in commit, commit diff, inspect commit',

        // Branch operations
        'mcp__github__list_branches': 'List branches, show branches, all branches, branch names, what branches exist, available branches, git branches',
        'mcp__github__create_branch': 'Create new branch, make branch, start new branch, branch from, fork branch',

        // Pull request operations - variations for "my PRs", "open PRs", "pull requests", "code review"
        'mcp__github__list_pull_requests': 'List pull requests, show PRs, my pull requests, open PRs, merge requests, code reviews, pending reviews, list PRs, what pull requests, show merge requests',
        'mcp__github__get_pull_request': 'Get pull request details, view PR, show pull request, PR info, pull request status, check PR, inspect pull request',
        'mcp__github__create_pull_request': 'Create pull request, open PR, make pull request, new PR, submit PR, create code review',
        'mcp__github__update_pull_request': 'Update pull request, modify PR, change PR, edit pull request',
        'mcp__github__merge_pull_request': 'Merge pull request, merge PR, approve and merge, complete PR, land PR',
        'mcp__github__get_pull_request_diff': 'Get PR diff, pull request changes, what changed in PR, show PR diff, review changes',
        'mcp__github__get_pull_request_files': 'Get PR files, files changed in PR, what files in pull request, list PR files',
        'mcp__github__get_pull_request_comments': 'Get PR comments, pull request comments, review comments, PR discussion, feedback on PR',
        'mcp__github__get_pull_request_reviews': 'Get PR reviews, pull request reviews, review status, who reviewed, approval status',
        'mcp__github__request_copilot_review': 'Request Copilot review, get AI review, automated code review',
        'mcp__github__create_pending_pull_request_review': 'Create PR review, start code review, begin reviewing PR',
        'mcp__github__submit_pending_pull_request_review': 'Submit PR review, approve PR, request changes, complete review',

        // Issue operations - variations for "bugs", "tasks", "work items"
        'mcp__github__list_issues': 'List issues, show issues, open issues, bugs, tasks, work items, issue tracker, bug reports, list bugs',
        'mcp__github__get_issue': 'Get issue details, view issue, show issue, issue info, bug details, task details',
        'mcp__github__create_issue': 'Create issue, open issue, file bug, new task, report bug, create work item',
        'mcp__github__update_issue': 'Update issue, modify issue, change issue, edit issue, update bug',
        'mcp__github__add_issue_comment': 'Add issue comment, comment on issue, reply to issue, discuss issue',
        'mcp__github__get_issue_comments': 'Get issue comments, issue discussion, comments on issue, issue thread',
        'mcp__github__search_issues': 'Search issues, find issues, query issues, search bugs, find tasks',

        // Code and file operations
        'mcp__github__search_code': 'Search code, find code, search repository, code search, grep code, find in files, search codebase',
        'mcp__github__get_file_contents': 'Get file, read file, view file, file contents, show file, download file, fetch file',
        'mcp__github__create_or_update_file': 'Create or update file, edit file, modify file, write file, change file',
        'mcp__github__push_files': 'Push files, upload files, commit files, push changes, upload multiple files',
        'mcp__github__delete_file': 'Delete file, remove file, delete from repository',

        // Repository operations
        'mcp__github__list_tags': 'List tags, show tags, release tags, version tags, git tags',
        'mcp__github__get_tag': 'Get tag details, view tag, show tag, tag info, release info',
        'mcp__github__create_repository': 'Create repository, new repo, make repository, initialize repo',
        'mcp__github__fork_repository': 'Fork repository, fork repo, create fork, copy repository',
        'mcp__github__search_repositories': 'Search repositories, find repos, search projects, find repositories'
      },
      slack: {
        'mcp__slack__slack_search_public': 'Search Slack, find messages, search channels, search conversations, find in Slack, search team chat, query Slack, find discussions',
        'mcp__slack__slack_send_message': 'Send Slack message, post to Slack, message channel, send to Slack, write message, notify team',
        'mcp__slack__slack_read_channel': 'Read Slack channel, view channel messages, check channel, channel history, recent messages',
        'mcp__slack__slack_read_thread': 'Read thread, view thread, thread messages, conversation thread, reply thread',
        'mcp__slack__slack_send_message_draft': 'Draft Slack message, create draft, prepare message, save draft',
        'mcp__slack__slack_schedule_message': 'Schedule Slack message, send later, schedule post, delay message',
        'mcp__slack__slack_search_channels': 'Search channels, find channels, list channels, available channels, channel list',
        'mcp__slack__slack_create_canvas': 'Create Slack canvas, new canvas, make canvas document',
        'mcp__slack__slack_read_canvas': 'Read canvas, view canvas, get canvas content, canvas document'
      },
      confluence: {
        'mcp__confluence__confluence_searchContent': 'Search Confluence, find documentation, search docs, search pages, find wiki pages, search knowledge base',
        'mcp__confluence__confluence_getContent': 'Get Confluence page, read page, view documentation, get doc, fetch page content',
        'mcp__confluence__confluence_searchSpace': 'Search Confluence space, find space, list spaces, space search',
        'mcp__confluence__confluence_createContent': 'Create Confluence page, new doc, write documentation, create wiki page',
        'mcp__confluence__confluence_updateContent': 'Update Confluence page, edit doc, modify documentation, update page'
      },
      'gus-mcp': {
        'mcp__gus_mcp__query_gus_records': 'Query GUS, search work items, find GUS records, get work items, search tasks, find stories, query agile items, search backlog'
      },
      cuala: {
        'mcp__cuala__cuala_execute_scenario': 'Execute browser test, run automation, test scenario, browser automation, web test, UI test',
        'mcp__cuala__cuala_execute_scenario_async': 'Execute browser test async, run automation in background, async test',
        'mcp__cuala__cuala_generate_plan': 'Generate test plan, create test plan, plan test execution, dry run test',
        'mcp__cuala__cuala_execute_plan': 'Execute test plan, run test plan, execute planned tests',
        'mcp__cuala__cuala_get_status': 'Get test status, check test status, test execution status, test results',
        'mcp__cuala__cuala_get_plan': 'Get test plan, view plan, show plan details',
        'mcp__cuala__cuala_list_plans': 'List test plans, show all plans, available plans',
        'mcp__cuala__cuala_update_plan': 'Update test plan, modify plan, edit plan'
      },
      'claude-mem': {
        'mcp__claude_mem__search': 'Search memory, find observations, search history, query memory, recall information',
        'mcp__claude_mem__timeline': 'Get timeline, context timeline, temporal context, event sequence',
        'mcp__claude_mem__get_observations': 'Get observations, fetch details, observation details, memory details',
        'mcp__claude_mem__save_memory': 'Save to memory, remember this, store observation, record information, memorize'
      }
    };

    return descriptions[server]?.[tool] || `${server}: ${tool}`;
  }

  formatToolsForPrompt(catalog: ToolCatalog): string {
    let prompt = '\n# Available Tools (use ONLY if task requires them)\n\n';

    // Add top 5 most relevant skills
    if (catalog.skills.length > 0) {
      prompt += 'Skills: ';
      const topSkills = catalog.skills.slice(0, 5).map(s => s.name).join(', ');
      prompt += topSkills + '\n';
    }

    // Add MCP tools grouped by server
    if (catalog.mcpTools.length > 0) {
      const byServer: Record<string, string[]> = {};
      for (const tool of catalog.mcpTools) {
        if (!byServer[tool.server]) byServer[tool.server] = [];
        byServer[tool.server].push(tool.name);
      }

      prompt += 'MCPs: ';
      const serverList = Object.entries(byServer)
        .map(([server, tools]) => `${server}[${tools.slice(0, 3).join(',')}]`)
        .join(', ');
      prompt += serverList + '\n';
    }

    prompt += '\nTo use: TOOL_USE: <tool_name> <args>\nOnly use if task EXPLICITLY needs external data/action.\n\n';

    return prompt;
  }
}
