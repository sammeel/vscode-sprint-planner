import * as vsc from "vscode";
import { Commands, NewLineRegex } from "../constants";
import { ITextProcessor } from "../utils/textProcessor";
import { PrefixService } from "../prefix-service";
import { TaskTextInput } from "../models/textProcessor";
import { notEmpty } from "../utils/typeCheck";

export class PublishCodeLensProvider implements vsc.CodeLensProvider {
    constructor(
        private prefixService: PrefixService,
        private textProcessor: ITextProcessor
    ) {}

    provideCodeLenses(
        _document: vsc.TextDocument,
        _token: vsc.CancellationToken
    ): vsc.ProviderResult<vsc.CodeLens[]> {
        const editor = vsc.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const lines = editor.document.getText().split(NewLineRegex);

        const prefixes = this.prefixService.getPrefixes();

        const lineIndices = this.textProcessor.getWorkItemLineIndices(
            lines,
            prefixes
        );

        const workItemResults = lineIndices.map((line) => {
            const us = this.textProcessor.getWorkItemInfo(
                lines,
                line,
                prefixes
            );

            return new vsc.CodeLens(
                new vsc.Range(line, 0, line, lines[line].length),
                {
                    title: `Publish to Azure DevOps, ${this.buildExtraInfo(
                        us?.tasks
                    )}`,
                    command: Commands.publish,
                    arguments: [line],
                }
            );
        });

        return workItemResults;
    }

    private buildExtraInfo(tasks: TaskTextInput[] | undefined) {
        if (!tasks || tasks.length === 0) {
            return "no tasks";
        }

        const totalHours = tasks
            .filter((t) => t.estimation)
            .map((t) => t.estimation)
            .filter(notEmpty)
            .reduce((sum, hours) => {
                sum += hours ?? 0;
                return sum;
            }, 0);

        if (tasks.length === 0) {
            return "no tasks";
        }

        const tasksText = tasks.length === 1 ? "task" : "tasks";

        return `${tasks.length} ${tasksText} (${totalHours}h)`;
    }
}
