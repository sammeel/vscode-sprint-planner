import * as vsc from 'vscode';
import { NewLineRegex } from '../constants';
import { PrefixService } from '../prefix-service';
import { Configuration } from '../utils/config';
import { ITextProcessor, } from '../utils/textProcessor';

export class WorkItemLinkProvider implements vsc.DocumentLinkProvider {
    constructor(private config: Configuration, private textProcessor: ITextProcessor, private prefixService: PrefixService) {
    }

    provideDocumentLinks(document: vsc.TextDocument, _token: vsc.CancellationToken): vsc.ProviderResult<vsc.DocumentLink[]> {
        const lines = document.getText().split(NewLineRegex);
        const userStoryLines = this.textProcessor.getUserStoryLineIndices(lines);
        const userStories = userStoryLines.map((usLine: number) => this.textProcessor.getUserStory(lines, usLine)!);
        const userStoriesWithIds = userStories.filter((us: { id: string; }) => !!us.id);

        const links: vsc.DocumentLink[] = [];

        for (const us of userStoriesWithIds) {
            const numberOfDigits = us.id!.toString().length;
            // const range = new vsc.Range(us.line, 0, us.line, numberOfDigits + UserStoryPrefix.length);
            const range = new vsc.Range(us.line, 0, us.line, numberOfDigits + 2);

            links.push(new vsc.DocumentLink(range, this.buildWorkItemLink(us.id!)));

            const tasksWithIds = us.tasks.filter((t: { id: string; }) => !!t.id);

            for (const task of tasksWithIds) {
                const numberOfDigits = task.id!.toString().length;
                const lineLength = lines[task.line].length;
                // task id is formatted as [#123] at the end of the line
                const range = new vsc.Range(task.line, lineLength - numberOfDigits - '#]'.length, task.line, lineLength - ']'.length);

                links.push(new vsc.DocumentLink(range, this.buildWorkItemLink(task.id!)));
            }
        }

        return links;
    }

    private buildWorkItemLink(id: number) {
        const organization = this.config.organization!;
        const project = this.config.project!;

        return vsc.Uri.parse(`https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`);
    }
}
