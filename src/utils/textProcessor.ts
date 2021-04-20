import { S_IFMT } from 'constants';
import * as Constants from '../constants';
import { TaskTextInput, WorkItemTextInput } from '../models/textProcessor';
import { IterationTextInput } from '../models/textProcessor';

export interface ITextProcessor {
	getWorkItemLineIndices(allLines: string[], prefixes: Constants.IPrefix[]): number[];
	getIteration(allLines: string[], currentLine: number): IterationTextInput | undefined;
	getWorkItemInfo(allLines: string[], currentLine: number, prefixes: Constants.IPrefix[]): WorkItemTextInput | undefined

	// TODO: remove
	getUserStoryLineIndices(allLines: string[]): any;
	getUserStory(allLines: string[], currentLine: number): any;
	getBugLineIndices(allLines: string[]): number[];
	getBug(allLines: string[], currentLine: number): any;
}

export class TextProcessor implements ITextProcessor {

	public getWorkItemLineIndices(allLines: string[], prefixes: Constants.IPrefix[]): number[]{
		const results: number[] = [];

		for (let i = 0; i < allLines.length; i++) {
			if(this.getRegexMatches(prefixes, allLines[i])) {
				results.push(i);
			}
		}

		return results;
	}

	private getRegexMatches(prefixes: Constants.IPrefix[], currentLine: string): boolean {
		const matches = prefixes.map(prefix => {
			const match = prefix.regex.exec(currentLine);

			if (match == null) {
				return null;
			}

			return {
				prefix: prefix,
				match: match
			};
		})
		.filter(r => r != null);

		if (matches.length > 1) {
			console.error(`more than 1 prefix matched. Matched prefixes: ${prefixes.map(p => p.prefix).join(',')}`);
		}

		return matches.length === 1;
	}


	// TODO: remove
	public getUserStoryLineIndices(allLines: string[]) {
		const results: number[] = [];

		for (let i = 0; i < allLines.length; i++) {
			if (Constants.UserStoryAgile.regex.test(allLines[i])) {
				results.push(i);
			}
		}

		return results;
	}

	public getBugLineIndices(allLines: string[]): number[] {
		const results: number[] = [];

		for (let i = 0; i < allLines.length; i++) {
			if (Constants.Bug.regex.test(allLines[i])) {
				results.push(i);
			}
		}

		return results;
	}

	public getIteration(allLines: string[], currentLine: number): IterationTextInput | undefined {
		return this.getIterationInfo(allLines, currentLine);
	}

	private getIterationInfo(lines: string[], currentLine: number): IterationTextInput | undefined{
		for (; currentLine >= 0; currentLine--) {
			const id = this.getIterationID(lines[currentLine]);
			if (id) {
				return <IterationTextInput>{
					line: currentLine,
					id: id
				};
			}
		}
	}

	private getIterationID(line: string) {
		console.log('Getting Iteration Id');
		const match = Constants.IterationRegex.exec(line);
		return match !== null && match[1];
	}

	public getWorkItemInfo(allLines: string[], currentLine: number, prefixes: Constants.IPrefix[]): WorkItemTextInput | undefined {
		const locationInfo = this.findWorkItemInfoPrefixLine(allLines, currentLine, prefixes);
		if (!locationInfo) {
			return;
		}

		const tasks = this.getWorkItemTasksInfo(allLines, locationInfo.line + 1, locationInfo.prefix);

		return <WorkItemTextInput>{
			line: locationInfo.line,
			prefix: locationInfo.prefix,
			id: locationInfo.id,
			title: locationInfo.title,
			tasks
		};
	}

	private findWorkItemInfoPrefixLine(lines: string[], currentLine: number, prefixes: Constants.IPrefix[]) {
		for (; currentLine >= 0; currentLine--) {
			const matches = prefixes.map(prefix => {
				const match = prefix.regex.exec(lines[currentLine]);

				if (match == null) {
					return null;
				}

				return {
					prefix: prefix,
					match: match
				};
			})
			.filter(r => r != null);

			if (matches.length > 1) {
				return console.error(`more than 1 match found for line ${currentLine}`);
			} else if (matches.length === 0) {
				continue;
			}

			const match = matches[0];

			if (match !== null) {
				const { id, title } = match.match.groups!;

				return {
					line: currentLine,
					id: id === 'new' ? undefined : parseInt(id),
					prefix: match.prefix,
					title
				};
			}
		}
	}

	// TODO: remove
	public getUserStory(allLines: string[], currentLine: number) {
        const userStoryInfo = this.getUserStoryInfo(allLines, currentLine);
		if (!userStoryInfo) {
			return;
		}

        const areaIdx = TextProcessor.getAreasIndices(allLines, userStoryInfo.line).pop();
		const tasks = TextProcessor.getTasksInfo(allLines, userStoryInfo.line + 1);

		return <any>{
			line: userStoryInfo.line,
			id: userStoryInfo.id,
			title: userStoryInfo.title,
            areaPath: typeof areaIdx === "number" && TextProcessor.getAreaName(allLines, areaIdx),
			tasks
		};
	}

	// TODO: remove
	private getUserStoryInfo(lines: string[], currentLine: number) {
		for (; currentLine >= 0; currentLine--) {
			const match = Constants.UserStoryAgile.regex.exec(lines[currentLine]);

			if (match !== null) {
				const { id, title } = match.groups!;

				return {
					line: currentLine,
					id: id === 'new' ? undefined : parseInt(id),
					title
				};
			}
		}
	}

	// TODO: remove
	public getBug(allLines: string[], currentLine: number): any {
		const userStoryInfo = this.getBugInfo(allLines, currentLine);
		if (!userStoryInfo) {
			return;
		}

		const tasks = TextProcessor.getTasksInfo(allLines, userStoryInfo.line + 1);

		return <any>{
			line: userStoryInfo.line,
			id: userStoryInfo.id,
			title: userStoryInfo.title,
			tasks
		};
	}

	// TODO: remove
	private getBugInfo(lines: string[], currentLine: number) {
		for (; currentLine >= 0; currentLine--) {
			const match = Constants.Bug.regex.exec(lines[currentLine]);

			if (match?.groups) {
				const { id, title } = match.groups;

				return {
					line: currentLine,
					id: id === 'new' ? undefined : parseInt(id),
					title
				};
			}
		}
	}

    private getWorkItemTasksInfo(lines: string[], currentLine: number, prefix: Constants.IPrefix) {
		const firstTaskLine = currentLine;
		let lastTaskLine = lines.length - 1;

		// find work item breaking pattern
		for (; currentLine < lines.length; currentLine++) {
			if (TextProcessor.isEndOfWorkItem(lines[currentLine], prefix)) {
				lastTaskLine = currentLine - 1;
				break;
			}
		}

		if (firstTaskLine <= lastTaskLine) {
			const taskLines = lines.slice(firstTaskLine, lastTaskLine + 1);

			const tasks: TaskTextInput[] = [];
			let description: string[] = [];
			let activity = undefined;

			let lineNo = firstTaskLine;

			const updateDescription = (description: string[]) => {
				if (tasks.length > 0) {
					tasks[tasks.length - 1].description = description;
				}
			};

			for (const line of taskLines) {
				if (TextProcessor.isActivityLine(line)) {
					activity = line.substr(0, line.length - 1);
				} else if (TextProcessor.isTaskDescriptionLine(line)) {
					description.push(line.trimLeft());
				} else {
					updateDescription(description);
					description = [];
					tasks.push(
                        getTask(line, lineNo, activity));
				}
				lineNo++;
			}

			updateDescription(description);

			return tasks;
		}

		return [];
	}

    public static getAreasIndices(allLines: string[], userStoryLine?: number): number[] {
        const results: number[] = [];

		for (let i = 0; i < (userStoryLine || allLines.length); i++) {
			if (allLines[i].startsWith(Constants.AreaPrefix)) {
				results.push(i);
			}
		}

		return results;
	}

    public static getAreaName(allLines: string[], currentLine: number): string {
        return allLines[currentLine].substring(Constants.AreaPrefix.length);
    }

	private static getTasksInfo(lines: string[], currentLine: number) {
		const firstTaskLine = currentLine;
		let lastTaskLine = lines.length - 1;

		// find user story breaking pattern
		for (; currentLine < lines.length; currentLine++) {
			if (TextProcessor.isEndOfUserStory(lines[currentLine])) {
				lastTaskLine = currentLine - 1;
				break;
			}
		}

		if (firstTaskLine <= lastTaskLine) {
			const taskLines = lines.slice(firstTaskLine, lastTaskLine + 1);

			const tasks: TaskTextInput[] = [];
			let description: string[] = [];
			let activity = undefined;

			let lineNo = firstTaskLine;

			const updateDescription = (description: string[]) => {
				if (tasks.length > 0) {
					tasks[tasks.length - 1].description = description;
				}
			};

			for (const line of taskLines) {
				if (TextProcessor.isActivityLine(line)) {
					activity = line.substr(0, line.length - 1);
				} else if (this.isTaskDescriptionLine(line)) {
					description.push(line.trimLeft());
				} else {
					updateDescription(description);
					description = [];
					tasks.push(TextProcessor.getTask(line, lineNo, activity));
				}
				lineNo++;
			}

			updateDescription(description);

			return tasks;
		}

		return [];
	}

	private static getTask(taskTitle: string, lineNo: number, activity?: string): TaskTextInput {
		const task = <TaskTextInput>{};

		taskTitle = taskTitle.replace(Constants.TaskPrefixRegex, '');

		const matchId = taskTitle.match(Constants.TaskIdRegex);
		if (matchId?.groups) {
			const id = matchId.groups.id;

			task.id = parseInt(id);
			taskTitle = taskTitle.replace(matchId[0], '');
		}

		const match = taskTitle.match(Constants.TaskEstimationRegex);
		if (match?.groups) {
			const est = match.groups.estimation;
			if (est) {
				task.estimation = parseFloat(est);
			} else {
				const minutes = parseInt(match.groups.estimation_m);
				task.estimation = Math.floor(minutes / 60 * 100) / 100;
			}
			taskTitle = taskTitle.replace(match[0], '');
		}

		task.title = taskTitle;
		task.activity = activity;
		task.line = lineNo;

		return task;
	}

	private static isEndOfWorkItem(line: string, prefix: Constants.IPrefix) {
		const isEndOfUserStory = prefix.endRegex!.test(line) ||  prefix.regex.test(line);
		return isEndOfUserStory;
	}

    private static isEndOfUserStory(line: string) {
		const isEndOfUserStory = Constants.EndOfUserStoryRegex.test(line) || Constants.UserStoryRegex.test(line);
		return isEndOfUserStory;
	}

	private static isActivityLine = (line: string) => Constants.ActivityTypeLine.test(line);
	private static isTaskDescriptionLine = (line: string) => Constants.TaskDescriptionRegex.test(line);
}

