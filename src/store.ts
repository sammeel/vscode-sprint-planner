import * as vsc from "vscode";
import * as Constants from "./constants";
import {
    UserStoryInfo,
    IterationInfo,
    IAzureClient,
} from "./utils/azure-client";
import { Logger } from "./utils/logger";
import { Stopwatch } from "./utils/stopwatch";
import { Configuration } from "./utils/config";
import { ITextProcessor } from "./utils/textProcessor";
import { UserStoryInfoMapper } from "./utils/mappers";
import { VsCodeTextEditorService } from "./vsCodeTextEditorService";

const MissingUrlOrToken = "Missing URL or token in configuration";

export class SessionStore implements ISessionStore {
    private currentIteration?: IterationInfo;
    private customIteration?: IterationInfo;
    private fetchingActivityTypes = false;

    public activityTypes?: string[];
    public iterations?: IterationInfo[];
    public workItems?: UserStoryInfo[] = undefined;
    public areas?: string[];

    constructor(
        private azureClient: IAzureClient,
        private config: Configuration,
        private logger: Logger,
        private textProcessor: ITextProcessor,
        private vsCodeTextEditorService: VsCodeTextEditorService
    ) {}

    private async setCustomIteration(): Promise<void> {
        if (!this.vsCodeTextEditorService.hasActiveEditor()) {
            return;
        }

        const currentIteration = this.customIteration;

        const lines = this.vsCodeTextEditorService
            .getEditorText()
            ?.split(Constants.NewLineRegex);
        if (lines === undefined) {
            return;
        }

        const it = this.textProcessor.getIteration(lines, 0);
        if (!it) {
            this.customIteration = undefined;
            this.logger.log(
                "Iteration not specified - will default to @CurrentIteration"
            );
        } else {
            await this.ensureHasIterations();
            this.customIteration = this.iterations?.find((x) => x.id === it.id);
            if (this.customIteration) {
                this.logger.log(
                    `Iteration set to ${this.customIteration.path.toString()}`
                );
                vsc.window.setStatusBarMessage(
                    `Iteration set to ${this.customIteration.path.toString()}`,
                    2000
                );
            }
        }

        if (this.customIteration?.id !== currentIteration?.id) {
            // clear caching
            this.logger.log(`Clearing cache as the iteration has changed`);
            this.clearWorkItems();
        }
    }

    private clearWorkItems() {
        this.workItems = undefined;
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
            const total = Stopwatch.startNew();
            this.activityTypes = await this.azureClient.getActivityTypes();
            total.stop();

            this.logger.log(
                `Activity types fetched in ${total.toString()} (1 request)`
            );
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

        const total = Stopwatch.startNew();
        this.iterations = await this.azureClient.getIterationsInfo();
        total.stop();

        this.logger.log(
            `Iterations fetched in ${total.toString()} (1 request)`
        );
        vsc.window.setStatusBarMessage(
            `Iterations fetched in ${total.toString()} (1 request)`,
            2000
        );

        return Promise.resolve();
    }

    async ensureHasAreas(): Promise<void> {
        if (this.areas !== undefined) {
            return Promise.resolve();
        }

        if (!this.config.isValid) {
            return Promise.reject(MissingUrlOrToken);
        }

        const total = Stopwatch.startNew();
        this.areas = await this.azureClient.getProjectAreas();
        total.stop();

        vsc.window.setStatusBarMessage(`Areas fetched in ${total.toString()} (1 request)`, 2000);

        return Promise.resolve();
    }

    async ensureHasItemsOfWorkItemType(
        prefix: Constants.IPrefix
    ): Promise<void> {
        if (!this.config.isValid) {
            return Promise.reject(MissingUrlOrToken);
        }

        const total = Stopwatch.startNew();
        const iteration = await this.determineIteration();

        const workItemsIds = await this.azureClient.getIterationWorkItems(
            iteration.id
        );

        const result = await this.azureClient.GetWorkItemInfos(
            workItemsIds.map((x) => x.id)
        );

        if (workItemsIds.length === 0) {
            this.logger.log(`No user stories found in iteration`);
            return Promise.reject();
        }

        this.workItems = result.value
            .filter(
                (x) =>
                    x.fields["System.WorkItemType"] === prefix.workItemType
            )
            .map(UserStoryInfoMapper.fromWorkItemInfo);

        total.stop();

        this.logger.log(
            `User stories fetched in ${total.toString()} (3 requests)`
        );
        this.logger.log(
            `User stories fetched in ${total.toString()} (3 requests)`
        );
        vsc.window.setStatusBarMessage(
            `User stories fetched in ${total.toString()} (3 requests)`,
            2000
        );
    }

    public async determineIteration(): Promise<IterationInfo> {
        this.setCustomIteration();

        if (!this.customIteration) {
            this.currentIteration =
                this.currentIteration ||
                (await this.azureClient.getCurrentIterationInfo());
            this.logger.log(
                `Iteration defaulted to ${this.currentIteration.path.toString()}`
            );
            return this.currentIteration;
        } else {
            this.currentIteration = undefined;
            return this.customIteration;
        }
    }
}

export interface ISessionStore {
    readonly activityTypes?: string[];
    readonly iterations?: IterationInfo[];
    readonly workItems?: UserStoryInfo[];
    readonly areas?: string[];

    ensureHasActivityTypes(): Promise<void>;
    ensureHasIterations(): Promise<void>;
    ensureHasItemsOfWorkItemType(prefix: Constants.IPrefix): Promise<void>;
    ensureHasAreas(): Promise<void>;

    determineIteration(): Promise<IterationInfo>;
}
