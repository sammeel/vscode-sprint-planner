import * as vsc from "vscode";
import { Commands, NewLineRegex } from "../constants";
import { ITextProcessor } from "../utils/textProcessor";
import { PrefixService } from "../prefix-service";
import { TaskTextInput } from "../models/textProcessor";

export class PublishCodeLensProvider implements vsc.CodeLensProvider {
  constructor(private prefixService: PrefixService, private textProcessor: ITextProcessor) {}

  provideCodeLenses(_document: vsc.TextDocument, _token: vsc.CancellationToken): vsc.ProviderResult<vsc.CodeLens[]> {
    const editor = vsc.window.activeTextEditor!;
    const lines = editor.document.getText().split(NewLineRegex);

    const prefixes = this.prefixService.getPrefixes();

    const lineIndices = this.textProcessor.getWorkItemLineIndices(lines, prefixes)    

    const workItemResults = lineIndices.map((line) => {
      const us = this.textProcessor.getWorkItemInfo(lines, line, prefixes)!;

      return new vsc.CodeLens(new vsc.Range(line, 0, line, lines[line].length), {
        title: `Publish to Azure DevOps, ${this.buildExtraInfo(us)}`,
        command: Commands.publish,
        arguments: [line],
      });
    });

    return workItemResults;
  }

  private buildExtraInfo({ tasks }: { tasks: TaskTextInput[] }) {
    const totalHours = tasks
      .filter((t) => t.estimation)
      .map((t) => t.estimation!)
      .reduce((sum, hours) => {
        sum += hours;
        return sum;
      }, 0);

    if (tasks.length === 0) {
      return "no tasks";
    }

    const tasksText = tasks.length === 1 ? "task" : "tasks";

    return `${tasks.length} ${tasksText} (${totalHours}h)`;
  }
}
