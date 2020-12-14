import * as vsc from "vscode";
import * as Constants from "../constants";
import { WorkItemInfo } from "../models/azure-client/workItems";
import { WorkItemWithPrefix, WorkItem, Task } from "../models/task";
import { PrefixService } from "../prefix-service";
import { ISessionStore } from "../store";
import { AzureClient, UserStoryInfo, TaskInfo } from "../utils/azure-client";
import { Configuration } from "../utils/config";
import { Logger } from "../utils/logger";
import { UserStoryInfoMapper } from "../utils/mappers";
import { TextProcessor } from "../utils/textProcessor";
import { LockableCommand } from "./lockableCommand";

export class PublishCommand extends LockableCommand {
  constructor(
    protected sessionStore: ISessionStore,
    protected client: AzureClient,
    protected logger: Logger,
    protected config: Configuration,
    protected prefixService: PrefixService
  ) {
    super();
  }

  protected async createWorkItem(title: string, iterationPath: string, prefix: Constants.IPrefix): Promise<WorkItemInfo> {
    return await this.client.createWorkItem(title, iterationPath, prefix.workItemType);
  }

  protected async getWorkItemInfo(workItem: WorkItemWithPrefix | WorkItemInfo): Promise<UserStoryInfo | undefined> {
    if (this.isWorkItem(workItem)) {
      await this.sessionStore.ensureHasItemsOfWorkItemType(workItem.prefix);

      const userStoryInfo = this.sessionStore.workItems!.find((x) => x.id === workItem.id);

      if (!userStoryInfo) {
        console.log(`${workItem.prefix.prefix}${workItem.id} is not present in session cache, is the ID correct?`);
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

  async publish(line?: number) {
    const editor = vsc.window.activeTextEditor;
    if (!editor) {
      return;
    }
    if (!this.lock()) {
      return;
    }

    await vsc.window.withProgress({ location: vsc.ProgressLocation.Notification }, async (progress) => {
      try {
        let currentLine = line !== undefined ? line : editor.selection.active.line;
        const lines = editor.document.getText().split(Constants.NewLineRegex);

        const workItem = TextProcessor.getWorkItemInfo(lines, currentLine, this.prefixService.getPrefixes());
        if (!workItem) {
          return console.log(`Cannot find work item on that line`);
        }

        this.validateWorkItem(workItem);

        progress.report({ increment: 10, message: "Publishing..." });

        let createUserStory = !workItem.id;
        let userStoryInfo: UserStoryInfo | undefined;

        if (createUserStory) {
          const iteration = await this.sessionStore.determineIteration();
          const workItemResult = await this.client.createWorkItem(workItem.title, iteration.path, workItem.prefix.workItemType);
          userStoryInfo = await this.getWorkItemInfo(workItemResult);
        } else {
          userStoryInfo = await this.getWorkItemInfo(workItem);
        }

        progress.report({ increment: 50 });

        if (!userStoryInfo) {
          return;
        }

        const vsoTaskIds = userStoryInfo.taskUrls.map(this.extractTaskId).filter((x) => x) as number[];
        const maxStackRank = await this.client.getMaxTaskStackRank(vsoTaskIds);
        let firstFreeStackRank = maxStackRank + 1;

        progress.report({ increment: 10 });

        const requests = workItem.tasks.map((t) => this.buildTaskInfo(t, userStoryInfo!, t.id ? undefined : firstFreeStackRank++));

        let taskIds = await Promise.all(requests.map((r) => this.client.createOrUpdateTask(r)));

        progress.report({ increment: 30 });

        await this.updateEditor(editor, workItem, taskIds, createUserStory ? userStoryInfo.id : undefined);
        this.showSummary(userStoryInfo.id, workItem.tasks, workItem.prefix);

        return Promise.resolve();
      } catch (err) {
        if (err) {
          vsc.window.showErrorMessage(err.message);
          this.logger.log(err);
          return Promise.reject();
        }
      }
    });

    this.unlock();
  }

  private showSummary(usId: number, tasks: Task[], prefix: Constants.IPrefix) {
    const updatedTasks = tasks.filter((x) => !!x.id).length;
    const createdTasks = tasks.length - updatedTasks;

    vsc.window.showInformationMessage(
      `Published ${tasks.length} tasks for ${prefix.prefix}${usId} (${createdTasks} created, ${updatedTasks} updated)`
    );
  }

  private validateWorkItem(workItem: WorkItem) {
    let createUserStory = !workItem.id;

    const taskIds = workItem.tasks.filter((t) => t.id).map((t) => t.id!.toString());
    if (createUserStory && taskIds.length > 0) {
      throw new Error(`Tasks cannot have IDs when creating Work Item (#${taskIds.join(", #")})`);
    }

    const occurences = taskIds.reduce((acc, id) => {
      acc[id] = acc[id] || 0;
      acc[id]++;
      return acc;
    }, {} as { [key: string]: number });

    const duplicateIds = Object.entries(occurences)
      .filter((x) => <number>x[1] > 1)
      .map((x) => "#" + x[0]);
    if (duplicateIds.length > 0) {
      throw new Error(`Duplicate tasks found: ${duplicateIds.join(", ")}`);
    }
  }

  private async updateEditor(editor: vsc.TextEditor, workItem: WorkItem, taskIds: number[], createdUserStoryId?: number) {
    await editor.edit((edit: vsc.TextEditorEdit) => {
      if (createdUserStoryId) {
        // Format of the line: US#new - <title>
        const newIdx = 3;
        const startPos = new vsc.Position(workItem.line, newIdx);
        edit.replace(new vsc.Range(startPos, startPos.translate(undefined, "new".length)), createdUserStoryId.toString());
      }

      for (let i = 0; i < workItem.tasks.length; i++) {
        if (typeof taskIds[i] === "number") {
          const task = workItem.tasks[i];
          const taskIsUpdated = task.id === taskIds[i];
          if (!taskIsUpdated) {
            const lineLength = editor.document.lineAt(task.line).text.length;
            edit.insert(new vsc.Position(task.line, lineLength), ` [#${taskIds[i]}]`);
          }
        }
      }
    });
  }

  private extractTaskId(url: string): number | null {
    const m = Constants.WorkItemIdFromUrl.exec(url);
    return m && parseInt(m[1]);
  }

  private buildTaskInfo(task: Task, userStory: UserStoryInfo, stackRank?: number): TaskInfo {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      areaPath: userStory.areaPath,
      teamProject: userStory.teamProject,
      iterationPath: userStory.iterationPath,
      activity: task.activity || this.config.defaultActivity!,
      estimation: task.estimation,
      userStoryUrl: userStory.url,
      stackRank: stackRank,
    };
  }
}
