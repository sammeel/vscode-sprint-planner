import * as vsc from "vscode";
import * as Constants from "../constants";
import { ISessionStore } from "../store";
import { AzureClient, TaskInfo, UserStoryInfo } from "../utils/azure-client";
import { Task, WorkItem } from "../models/task";
import { Logger } from "../utils/logger";
import { Configuration } from "../utils/config";
import { WorkItemInfo } from "../models/azure-client/workItems";
import { LockableCommand } from "./lockableCommand";

export abstract class PublishBase extends LockableCommand {
  constructor(protected sessionStore: ISessionStore, protected client: AzureClient, protected logger: Logger, protected config: Configuration, protected prefix: string) {
    super();
  }

  protected abstract getWorkItem(lines: string[], currentLine: number): WorkItem | undefined;
  protected abstract createWorkItem(title: string, iterationPath: string): Promise<WorkItemInfo>;
  protected abstract getWorkItemInfo(workItem: WorkItem | WorkItemInfo): Promise<UserStoryInfo | undefined>;

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

        const workItem = this.getWorkItem(lines, currentLine);
        if (!workItem) {
          return console.log(`Cannot find work item on line ${currentLine}`);
        }

        this.validateWorkItem(workItem);

        progress.report({ increment: 10, message: "Publishing..." });

        let createUserStory = !workItem.id;
        let userStoryInfo: UserStoryInfo | undefined;

        if (createUserStory) {
          const iteration = await this.sessionStore.determineIteration();
          const workItemResult = await this.createWorkItem(workItem.title, iteration.path);
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
        this.showSummary(userStoryInfo.id, workItem.tasks);

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

  private showSummary(usId: number, tasks: Task[]) {
    const updatedTasks = tasks.filter((x) => !!x.id).length;
    const createdTasks = tasks.length - updatedTasks;

    vsc.window.showInformationMessage(`Published ${tasks.length} tasks for ${this.prefix}}#${usId} (${createdTasks} created, ${updatedTasks} updated)`);
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
