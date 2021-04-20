import axios, { AxiosInstance, AxiosResponse } from "axios";
import * as vsc from "vscode";

import { IterationsResult } from "../models/azure-client/iterations";
import { IterationWorkItemsResult } from "../models/azure-client/iterationsWorkItems";
import {
    WorkItemInfo,
    WorkItemInfoResult,
} from "../models/azure-client/workItems";
import { FieldDefinition } from "../models/azure-client/fields";
import { Logger } from "./logger";
import { Stopwatch } from "./stopwatch";
import { Configuration } from "./config";
import { WorkItemRequestBuilder } from "./workItemRequestBuilder";
import { AreaDefinition } from "../models/azure-client/areas";
import { TaskInfoMapper } from "./mappers";

export interface IAzureClient {
    getIterationsInfo(): Promise<IterationInfo[]>;
    getCurrentIterationInfo(): Promise<IterationInfo>;
    getIterationWorkItems(iterationId: string): Promise<UserStoryIdentifier[]>;
    getActivityTypes(): Promise<string[]>;
    GetWorkItemInfos(userStoryIds: number[]): Promise<WorkItemInfoResult>;
    getMaxTaskStackRank(taskIds: number[]): Promise<number>;
    createWorkItem(
        title: string,
        iterationPath: string,
        workItemType: string
    ): Promise<WorkItemInfo>;
    createOrUpdateTask(task: TaskInfo): Promise<number>;
    getTasksInfo(taskIds: number[]): Promise<TaskInfo[]>;
    getProjectAreas(): Promise<string[]>;
}

export class AzureClient implements IAzureClient, vsc.Disposable {
    private _apiVersionPreview = {
        "api-version": "5.0-preview.1",
    };

    private client!: AxiosInstance;
    private teamClient!: AxiosInstance;
    private _eventHandler: vsc.Disposable;
    private _interceptors: number[] = [];

    constructor(
        private config: Configuration,
        private logger: Logger,
        private workItemRequestBuilder: WorkItemRequestBuilder
    ) {
        this.recreateClient();

        this._eventHandler = config.onDidChange((newConfig) => {
            this.config = newConfig;
            this.recreateClient();
        });
    }

    dispose(): void {
        this._eventHandler.dispose();
    }

    private recreateClient() {
        if (!this.config.isValid) {
            return;
        }

        if (this._interceptors.length > 0) {
            this._interceptors.forEach((id) => {
                this.client.interceptors.response.eject(id);
                this.teamClient.interceptors.response.eject(id);
            });
            this._interceptors = [];
        }

        const organization = encodeURIComponent(this.config.organization ?? "");
        const project = encodeURIComponent(this.config.project ?? "");
        const team = encodeURIComponent(this.config.team ?? "");

        const clientFactory = (baseUrl: string) => {
            const client = axios.create({
                baseURL: baseUrl,
                auth: {
                    username: "PAT",
                    password: this.config.token || "",
                },
                headers: {
                    Accept: "application/json; api-version=5.0",
                },
                validateStatus: (status) => status === 200,
            });

            if (this.config.debug) {
                const id = client.interceptors.response.use(
                    (res) => this.logRequest(res.request, res),
                    (err) =>
                        this.logRequest(
                            err.request,
                            Promise.reject(err),
                            err.response
                        )
                );
                this._interceptors.push(id);
            }

            return client;
        };

        this.client = clientFactory(
            `https://dev.azure.com/${organization}/${project}/_apis/`
        );
        this.teamClient = clientFactory(
            `https://dev.azure.com/${organization}/${project}/${team}/_apis/`
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private logRequest(
        request: any,
        returnValue: any,
        response?: AxiosResponse
    ) {
        console.log(`[DEBUG] ${request.method.toUpperCase()} ${request.path}`);
        if (response) {
            console.log(`[DEBUG] Response: ${JSON.stringify(response.data)}`);
        }
        return returnValue;
    }

    public async getIterationsInfo(): Promise<IterationInfo[]> {
        const finish = this.logger.perf("Getting iterations info...");
        const result = await this.teamClient.get<IterationsResult>(
            "/work/teamsettings/iterations"
        );
        finish();

        if (result.data.count > 0) {
            const iterations: IterationInfo[] = [];
            result.data.value.forEach((element) => {
                const iteration = <IterationInfo>{
                    id: element.id,
                    name: element.name,
                    path: element.path,
                };
                iterations.push(iteration);
            });

            return iterations;
        }

        throw new Error("Iterations not found");
    }

    public async getCurrentIterationInfo(): Promise<IterationInfo> {
        const finish = this.logger.perf("Getting current iteration info...");
        const result = await this.teamClient.get<IterationsResult>(
            "/work/teamsettings/iterations?$timeframe=current"
        );
        finish();

        if (result.data.count > 0) {
            const iteration = result.data.value[0];
            return <IterationInfo>{
                id: iteration.id,
                name: iteration.name,
                path: iteration.path,
            };
        }

        throw new Error("Current iteration not found");
    }

    public async getIterationWorkItems(
        iterationId: string
    ): Promise<UserStoryIdentifier[]> {
        const finish = this.logger.perf(
            "Getting user stories for iteration..."
        );
        const result = await this.teamClient.get<IterationWorkItemsResult>(
            `/work/teamsettings/iterations/${iterationId}/workitems`,
            {
                params: {
                    ...this._apiVersionPreview,
                },
            }
        );

        finish();

        return result.data.workItemRelations
            .filter((x) => x.rel === null)
            .map(
                (x) =>
                    <UserStoryIdentifier>{
                        id: x.target.id,
                        url: x.target.url,
                    }
            );
    }

    public async getActivityTypes(): Promise<string[]> {
        const finish = this.logger.perf("Getting activity types...");
        const result = await this.client.get<FieldDefinition>(
            `/wit/workitemtypes/Task/fields/Microsoft.VSTS.Common.Activity?$expand=All`
        );

        finish();

        return result.data.allowedValues;
    }

    public async getProjectAreas(): Promise<string[]> {
        const finish = this.logger.perf("Getting project areas...");
        const result = await this.client.get<AreaDefinition>(
            `/wit/classificationNodes/areas?$depth=10`
        );

        finish();

        return [
            result.data.name,
            ...getChildren(result.data.name, result.data.children),
        ];

        function getChildren(
            prefix: string,
            children: AreaDefinition[]
        ): string[] {
            return [
                ...(children || []).flatMap((x) => {
                    const name = `${prefix}\\${x.name}`;
                    return [name, ...getChildren(name, x.children)];
                }),
            ];
        }
    }

    public async GetWorkItemInfos(
        userStoryIds: number[]
    ): Promise<WorkItemInfoResult> {
        const finish = this.logger.perf("Getting work items info...");

        const params: WorkItemRequestParams = {
            ids: userStoryIds.join(","),
            $expand: "Relations",
        };

        const result = await this.client.get<WorkItemInfoResult>(
            "/wit/workitems",
            { params }
        );
        finish();

        return result.data;
    }

    public async getMaxTaskStackRank(taskIds: number[]): Promise<number> {
        if (taskIds.length === 0) {
            this.logger.log("No tasks in User Story -> Stack Rank = 0");
            return 0;
        }

        const finish = this.logger.perf("Getting max stack rank for tasks...");

        const params: WorkItemRequestParams = {
            ids: taskIds.join(","),
            fields: ["Microsoft.VSTS.Common.StackRank"].join(","),
        };

        const result = await this.client.get<WorkItemInfoResult>(
            "/wit/workitems",
            { params }
        );
        const stackRanks = result.data.value.map(
            (t) => t.fields["Microsoft.VSTS.Common.StackRank"]
        );

        finish();

        const max = stackRanks.reduce((acc, current) => {
            acc = Math.max(acc, current || 0);
            return acc;
        }, 0);

        this.logger.log(`Max Stack Rank: ${max}`);

        return max;
    }

    public createOrUpdateTask(task: TaskInfo): Promise<number> {
        const createNewTask = !task.id;

        const buildRequest = createNewTask
            ? this.workItemRequestBuilder.createTaskRequest
            : this.workItemRequestBuilder.updateTaskRequest;
        const request = buildRequest.call(this.workItemRequestBuilder, task);

        if (createNewTask) {
            this.logger.log(`Creating task: ${task.title}...`);
        } else {
            this.logger.log(`Updating task #${task.id}: ${task.title}...`);
        }

        const stopwatch = Stopwatch.startNew();

        const func = createNewTask ? this.client.post : this.client.patch;
        const url = createNewTask
            ? "/wit/workitems/$Task"
            : `/wit/workitems/${task.id}`;

        return func<WorkItemInfo>(url, request, {
            headers: {
                "Content-Type": "application/json-patch+json",
            },
        })
            .then((res) => {
                this.logger.log(
                    `#${res.data.id} Task '${task.title}' ${
                        createNewTask ? "created" : "updated"
                    } (${stopwatch.toString()})`
                );
                return res.data.id;
            })
            .catch((err) => {
                console.error(err);
                return Promise.reject(err);
            });
    }

    public createWorkItem(
        title: string,
        iterationPath: string,
        workItemType: string
    ): Promise<WorkItemInfo> {
        const request = this.workItemRequestBuilder.createUserStory(
            title,
            iterationPath
        );

        this.logger.log(`Creating Bug: ${title}...`);
        const stopwatch = Stopwatch.startNew();

        return this.client
            .post<WorkItemInfo>(`/wit/workitems/$${workItemType}`, request, {
                headers: {
                    "Content-Type": "application/json-patch+json",
                },
            })
            .then((res) => {
                this.logger.log(
                    `#${
                        res.data.id
                    } ${workItemType} '${title}' created (${stopwatch.toString()})`
                );
                return res.data;
            })
            .catch((err) => {
                console.error(err);
                return Promise.reject(err);
            });
    }

    public async getTasksInfo(taskIds: number[]): Promise<TaskInfo[]> {
        if (taskIds.length === 0) {
            this.logger.log("No tasks in User Story");
            return [];
        }

        const finish = this.logger.perf("Getting tasks info...");

        const params: WorkItemRequestParams = {
            ids: taskIds.join(","),
        };

        const result = await this.client.get<WorkItemInfoResult>(
            "/wit/workitems",
            { params }
        );
        finish();

        return result.data.value.map(TaskInfoMapper.fromWorkItemInfo);
    }
}

export interface IterationInfo {
    id: string;
    name: string;
    path: string;
}

export interface UserStoryIdentifier {
    id: number;
    url: string;
}

export interface UserStoryInfo {
    id: number;
    url: string;
    title: string;
    areaPath: string;
    teamProject: string;
    iterationPath: string;
    taskUrls: string[];
}

export interface TaskInfo {
    id?: number;
    title: string;
    description?: string[];
    areaPath: string;
    teamProject: string;
    iterationPath: string;
    activity: string;
    estimation?: number;
    userStoryUrl: string;
    stackRank?: number;
}

export interface WorkItemRequestParams {
    ids: string;
    $expand?: string;
    fields?: string;
}
