import * as vsc from 'vscode';
import * as Constants from './constants';
import { UserStoryInfo, AzureClient, IterationInfo } from './utils/azure-client';
import { Logger } from './utils/logger';
import { Stopwatch } from './utils/stopwatch';
import { Configuration } from './utils/config';
import { TextProcessor } from './utils/textProcessor';
import { WorkItem } from './models/task';
import { UserStoryInfoMapper } from './utils/mappers';

const MissingUrlOrToken = "Missing URL or token in configuration";

export class SessionStore implements ISessionStore {
	private currentIteration?: IterationInfo;
	private customIteration?: IterationInfo;
	private fetchingActivityTypes: boolean = false;

	public activityTypes?: string[];
	public iterations?: IterationInfo[];
	public userStories?: UserStoryInfo[] = undefined;
	public bugs?: UserStoryInfo[] = undefined;
	public workItems?: UserStoryInfo[] = undefined;

	constructor(private azureClient: AzureClient, private config: Configuration, private logger: Logger) {
	}

	private async setCustomIteration(): Promise<void> {
		const editor = vsc.window.activeTextEditor;

		if (editor) {
			const lines = editor.document.getText().split(Constants.NewLineRegex);
			const it = TextProcessor.getIteration(lines, 0);
			if (!it) {
				this.customIteration = undefined;
				this.logger.log('Iteration not specified - will default to @CurrentIteration');
			} else {
				this.customIteration = this.iterations!.find(x => x.id === it.id);
				if (!this.customIteration) { return Promise.resolve(); }

				this.logger.log(`Iteration set to ${this.customIteration.path.toString()}`);
				vsc.window.setStatusBarMessage(`Iteration set to ${this.customIteration.path.toString()}`, 2000);
			}
		}

		return Promise.resolve();
	}

	async ensureHasActivityTypes(): Promise<void> {
		if (this.activityTypes !== undefined) {
			return Promise.resolve();
		}

		if (!this.config.isValid) {
			return Promise.reject(MissingUrlOrToken);
		}

		if (this.fetchingActivityTypes) {
			return Promise.reject();
		}

		this.fetchingActivityTypes = true;

		try {
			let total = Stopwatch.startNew();
			this.activityTypes = await this.azureClient.getActivityTypes();
			total.stop();

			this.logger.log(`Activity types fetched in ${total.toString()} (1 request)`);
		} catch (err) {
			this.fetchingActivityTypes = false;
			return Promise.reject(err);
		}

		this.fetchingActivityTypes = false;
		return Promise.resolve();
	}

	async ensureHasIterations(): Promise<void> {
		if (this.iterations !== undefined) {
			return Promise.resolve();
		}

		if (!this.config.isValid) {
			return Promise.reject(MissingUrlOrToken);
		}

		let total = Stopwatch.startNew();
		this.iterations = await this.azureClient.getIterationsInfo();
		total.stop();

		this.logger.log(`Iterations fetched in ${total.toString()} (1 request)`);
		vsc.window.setStatusBarMessage(`Iterations fetched in ${total.toString()} (1 request)`, 2000);

		return Promise.resolve();
	}

	async ensureHasUserStories(): Promise<void> {
		if (!this.config.isValid) {
			return Promise.reject(MissingUrlOrToken);
		}

		let total = Stopwatch.startNew();
		let iteration = await this.determineIteration();

		const workItemsIds = await this.azureClient.getIterationWorkItems(iteration.id);

		if (workItemsIds.length === 0) {
			this.logger.log(`No user stories found in iteration`);
			return Promise.reject();
		}

		this.userStories = await this.azureClient.getUserStoryInfo(workItemsIds.map(x => x.id));
		this.bugs = await this.azureClient.getBugInfo(workItemsIds.map(x => x.id));
		total.stop();

		this.logger.log(`User stories fetched in ${total.toString()} (3 requests)`);
		vsc.window.setStatusBarMessage(`User stories fetched in ${total.toString()} (3 requests)`, 2000);

		return Promise.resolve();
	}

	async ensureHasItemsOfWorkItemType(prefix: Constants.IPrefix): Promise<void> {
		if (!this.config.isValid) {
			return Promise.reject(MissingUrlOrToken);
		}

		let total = Stopwatch.startNew();
		let iteration = await this.determineIteration();

		const workItemsIds = await this.azureClient.getIterationWorkItems(iteration.id);

		const result = await this.azureClient.GetWorkItemInfos(workItemsIds.map(x => x.id));

		this.workItems = result.value
			.filter(x => x.fields["System.WorkItemType"] === prefix.workItemType)
			.map(UserStoryInfoMapper.fromWorkItemInfo);
	}

	async ensureHasBugs(): Promise<void> {
		if (!this.config.isValid) {
			return Promise.reject(MissingUrlOrToken);
		}

		let total = Stopwatch.startNew();
		let iteration = await this.determineIteration();

		const workItemsIds = await this.azureClient.getIterationWorkItems(iteration.id);

		if (workItemsIds.length === 0) {
			this.logger.log(`No bugs found in iteration`);
			return Promise.reject();
		}

		this.bugs = await this.azureClient.getBugInfo(workItemsIds.map(x => x.id));
		total.stop();

		this.logger.log(`Bugs fetched in ${total.toString()} (3 requests)`);
		vsc.window.setStatusBarMessage(`Bugs fetched in ${total.toString()} (3 requests)`, 2000);

		return Promise.resolve();
	}

	public async determineIteration() {
		this.setCustomIteration();

		if (!this.customIteration) {
			this.currentIteration = this.currentIteration || await this.azureClient.getCurrentIterationInfo();
			this.logger.log(`Iteration defaulted to ${this.currentIteration.path.toString()}`);
			return this.currentIteration;
		}
		else {
			this.currentIteration = undefined;
			return this.customIteration;
		}
	}
}

export interface ISessionStore {
	readonly activityTypes?: string[];
	readonly iterations?: IterationInfo[];
	readonly userStories?: UserStoryInfo[];
	readonly bugs?: UserStoryInfo[];
	readonly workItems?: UserStoryInfo[];

	ensureHasActivityTypes(): Promise<void>;
	ensureHasIterations(): Promise<void>;
	ensureHasUserStories(): Promise<void>;
	ensureHasBugs(): Promise<void>;
	ensureHasItemsOfWorkItemType(prefix: Constants.IPrefix): Promise<void>;

	determineIteration(): Promise<IterationInfo>;
}
