import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from './logger';
import { mgrPreference } from './mgrPreference';
import { ProjectConfig } from '../types/project';
import { Conversation } from '../types/agents';

export class ProjectManager {
  private currentProject?: ProjectConfig;
  private isConfigured: boolean = false;

  constructor() {
    // Subscribe to project configuration changes
    mgrPreference.subscribePath<ProjectConfig>('system.project', async (project) => {
      try {
        this.isConfigured = !!project?.path;
        if (this.isConfigured) {
          await this.handleProjectChange(project);
        } else {
          Logger.info('Project path not configured, auto-save features will be disabled');
        }
      } catch (err) {
        Logger.error('Failed to handle project change', err as Error);
        // Revert to previous path if we can't access the new one
        if (this.currentProject && this.currentProject.path !== project.path) {
          mgrPreference.set('system.project', {
            ...project,
            path: this.currentProject.path
          });
        }
      }
    });
  }

  /**
   * Check if project is configured
   */
  isProjectConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get the paths for the current project
   * @returns Project paths or null if not configured
   */
  getPaths(): { root: string; screenshots: string; conversations: string } | null {
    if (!this.isConfigured) {
      Logger.debug('Project not configured, paths not available');
      return null;
    }

    const project = mgrPreference.get<ProjectConfig>('system.project');
    return {
      root: project.path,
      screenshots: path.join(project.path, 'screenshots'),
      conversations: path.join(project.path, 'conversations')
    };
  }

  /**
   * Generate a path for a new screenshot
   * @param extension File extension (e.g., 'png', 'jpg')
   * @returns Path or null if project not configured
   */
  async createScreenshotPath(extension: string = 'png'): Promise<string | null> {
    const paths = this.getPaths();
    if (!paths) {
      Logger.info('Screenshot auto-save disabled: project not configured');
      return null;
    }

    const filename = `screenshot-${Date.now()}.${extension}`;
    return path.join(paths.screenshots, filename);
  }

  /**
   * Generate a path for a new conversation file
   * @param conversationId Optional conversation ID
   * @returns Path or null if project not configured
   */
  async createConversationPath(conversationId?: string): Promise<string | null> {
    const paths = this.getPaths();
    if (!paths) {
      Logger.info('Conversation auto-save disabled: project not configured');
      return null;
    }

    // Ensure filename has .json extension
    const filename = conversationId 
      ? `${conversationId}.json`
      : `conversation-${Date.now()}.json`;

    return path.join(paths.conversations, filename);
  }

  /**
   * Generate a path for a conversation file (synchronous version)
   * @param conversationId Optional conversation ID
   * @returns Path or null if project not configured
   */
  createConversationPathSync(conversationId?: string): string | null {
    const paths = this.getPaths();
    if (!paths) {
      Logger.info('Conversation auto-save disabled: project not configured');
      return null;
    }

    // Ensure filename has .json extension
    const filename = conversationId 
      ? `${conversationId}.json`
      : `conversation-${Date.now()}.json`;

    return path.join(paths.conversations, filename);
  }

  /**
   * Save a conversation to the project
   * @param conversation The conversation to save
   * @returns true if saved successfully, false if project not configured
   */
  async saveConversation(conversation: Conversation): Promise<boolean> {
    const conversationPath = await this.createConversationPath(conversation.id);
    if (!conversationPath) {
      Logger.info(`Skipping conversation save (${conversation.id}): project not configured`);
      return false;
    }

    try {
      await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
      Logger.log(`Saved conversation to ${conversationPath}`);
      return true;
    } catch (err) {
      Logger.error(`Failed to save conversation to ${conversationPath}`, err as Error);
      throw err;
    }
  }

  /**
   * Handle project configuration changes
   */
  private async handleProjectChange(project: ProjectConfig): Promise<void> {
    await this.ensureProjectStructure(project.path);
    this.currentProject = project;
  }

  /**
   * Ensure the project directory structure exists
   */
  private async ensureProjectStructure(projectPath: string): Promise<void> {
    const directories = [
      projectPath,
      path.join(projectPath, 'screenshots'),
      path.join(projectPath, 'conversations'),
      path.join(projectPath, '.shunshot')
    ];

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        try {
          await fs.mkdir(dir, { recursive: true });
          Logger.log(`Created directory: ${dir}`);
        } catch (err) {
          Logger.error(`Failed to create directory: ${dir}`, err as Error);
          throw err;
        }
      }
    }

    await this.updateMetadata(projectPath);
  }

  /**
   * Update project metadata
   */
  private async updateMetadata(projectPath: string): Promise<void> {
    const metadataPath = path.join(projectPath, '.shunshot', 'metadata.json');
    const metadata = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      directories: {
        screenshots: path.join(projectPath, 'screenshots'),
        conversations: path.join(projectPath, 'conversations')
      }
    };

    try {
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (err) {
      Logger.error('Failed to write project metadata', err as Error);
      throw err;
    }
  }
}

export const mgrProject = new ProjectManager();