import * as vsc from 'vscode';
import * as Constants from '../constants';
import { TextProcessor } from '../utils/textProcessor';
import { ISessionStore } from '../store';
import { AzureClient, TaskInfo, UserStoryIdentifier, UserStoryInfo } from '../utils/azure-client';
import { Task, WorkItem } from '../models/task';
import { Logger } from '../utils/logger';
import { Configuration } from '../utils/config';
import { WorkItemInfo } from '../models/azure-client/workItems';
import { UserStoryInfoMapper } from '../utils/mappers';
import { LockableCommand } from './lockableCommand';
import { PublishBase } from './publish-base';

export class PublishUserStoryCommand extends PublishBase {
	constructor(
		sessionStore: ISessionStore,
		client: AzureClient,
		logger: Logger,
		config: Configuration) {
		super(sessionStore, client, logger, config, Constants.UserStoryPrefix);
	}

	protected getWorkItem(lines: string[], currentLine: number): WorkItem | undefined {
		return TextProcessor.getUserStory(lines, currentLine);
	}

	protected async createWorkItem(title: string, iterationPath: string): Promise<WorkItemInfo> {
		return await this.client.createUserStory(title, iterationPath);
	}

	protected async getWorkItemInfo(workItem: WorkItem | WorkItemInfo): Promise<UserStoryInfo | undefined> {
		if (this.isWorkItem(workItem)) {
			await this.sessionStore.ensureHasUserStories();

			const userStoryInfo = this.sessionStore.userStories!.find(x => x.id === workItem.id);

			if (!userStoryInfo) {
				console.log(`${this.prefix}${workItem.id} is not present in session cache, is the ID correct?`);
				return;
			}

			return userStoryInfo;
		} else {
			return UserStoryInfoMapper.fromWorkItemInfo(workItem);
		}
	}

	private isWorkItem(workItem: WorkItem | WorkItemInfo): workItem is WorkItem {
		return (workItem as WorkItem).line !== undefined;
	}
}
