import { S_IFMT } from 'constants';
import * as Constants from '../constants';
import { Task, WorkItem, WorkItemWithPrefix } from '../models/task';

export class TextProcessor {

	public static getWorkItemLineIndices(allLines: string[], prefixes: Constants.IPrefix[]): number[]{
		const results: number[] = [];

		for (let i = 0; i < allLines.length; i++) {
			if(this.getRegexMatches(prefixes, allLines[i])) {
				results.push(i);
			}
		}

		return results;
	}

	private static getRegexMatches(prefixes: Constants.IPrefix[], currentLine: string): boolean {
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
	public static getUserStoryLineIndices(allLines: string[]) {
		const results: number[] = [];

		for (let i = 0; i < allLines.length; i++) {
			if (Constants.UserStoryAgile.regex.test(allLines[i])) {
				results.push(i);
			}
		}

		return results;
	}

	public static getBugLineIndices(allLines: string[]) {
		const results: number[] = [];

		for (let i = 0; i < allLines.length; i++) {
			if (Constants.Bug.regex.test(allLines[i])) {
				results.push(i);
			}
		}

		return results;
	}

	public static getIteration(allLines: string[], currentLine: number) {
		const iterationInfo = TextProcessor.getIterationInfo(allLines, currentLine);
		if (!iterationInfo) {
			return;
		}

		return {
			line: iterationInfo[0],
			id: iterationInfo[1]
		};
	}

	private static getIterationInfo(lines: string[], currentLine: number) {
		for (; currentLine >= 0; currentLine--) {
			const id = TextProcessor.getIterationID(lines[currentLine]);
			if (id) {
				return [currentLine, id];
			}
		}
	}

	private static getIterationID(line: string) {
		console.log('Getting Iteration Id');
		const match = Constants.IterationRegex.exec(line);
		return match !== null && match[1];
	}

	public static getWorkItemInfo(allLines: string[], currentLine: number, prefixes: Constants.IPrefix[]): WorkItemWithPrefix | undefined {
		const locationInfo = this.findWorkItemInfoPrefixLine(allLines, currentLine, prefixes);
		if (!locationInfo) {
			return;
		}

		const tasks = TextProcessor.getWorkItemTasksInfo(allLines, locationInfo.line + 1, locationInfo.prefix);

		return <WorkItemWithPrefix>{
			line: locationInfo.line,
			prefix: locationInfo.prefix,
			id: locationInfo.id,
			title: locationInfo.title,
			tasks
		};
	}

	private static findWorkItemInfoPrefixLine(lines: string[], currentLine: number, prefixes: Constants.IPrefix[]) {
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
	public static getUserStory(allLines: string[], currentLine: number) {
		const userStoryInfo = TextProcessor.getUserStoryInfo(allLines, currentLine);
		if (!userStoryInfo) {
			return;
		}

		const tasks = TextProcessor.getTasksInfo(allLines, userStoryInfo.line + 1);

		return <WorkItem>{
			line: userStoryInfo.line,
			id: userStoryInfo.id,
			title: userStoryInfo.title,
			tasks
		};
	}

	// TODO: remove
	private static getUserStoryInfo(lines: string[], currentLine: number) {
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

	public static getBug(allLines: string[], currentLine: number) {
		const userStoryInfo = TextProcessor.getBugInfo(allLines, currentLine);
		if (!userStoryInfo) {
			return;
		}

		const tasks = TextProcessor.getTasksInfo(allLines, userStoryInfo.line + 1);

		return <WorkItem>{
			line: userStoryInfo.line,
			id: userStoryInfo.id,
			title: userStoryInfo.title,
			tasks
		};
	}

	private static getBugInfo(lines: string[], currentLine: number) {
		for (; currentLine >= 0; currentLine--) {
			const match = Constants.Bug.regex.exec(lines[currentLine]);

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

	private static getWorkItemTasksInfo(lines: string[], currentLine: number, prefix: Constants.IPrefix) {
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

			const tasks: Task[] = [];
			let description: string[] = [];
			let activity = undefined;

			let lineNo = firstTaskLine;

			const updateDescription = (description: string[]) => {
				if (tasks.length > 0) {
					tasks[tasks.length - 1].description = description;
				}
			};

			for (const line of taskLines) {
				if (this.isActivityLine(line)) {
					activity = line.substr(0, line.length - 1);
				} else if (this.isTaskDescriptionLine(line)) {
					description.push(line.trimLeft());
				} else {
					updateDescription(description);
					description = [];
					tasks.push(this.getTask(line, lineNo, activity));
				}
				lineNo++;
			}

			updateDescription(description);

			return tasks;
		}

		return [];
	}

	// TODO: remove
	private static getTasksInfo(lines: string[], currentLine: number) {
		const firstTaskLine = currentLine;
		let lastTaskLine = lines.length - 1;

		// find user story breaking pattern
		for (; currentLine < lines.length; currentLine++) {
			if (TextProcessor.isEndOfUserStory(lines[currentLine]) || TextProcessor.isEndOfBug(lines[currentLine])) {
				lastTaskLine = currentLine - 1;
				break;
			}
		}

		if (firstTaskLine <= lastTaskLine) {
			const taskLines = lines.slice(firstTaskLine, lastTaskLine + 1);

			const tasks: Task[] = [];
			let description: string[] = [];
			let activity = undefined;

			let lineNo = firstTaskLine;

			const updateDescription = (description: string[]) => {
				if (tasks.length > 0) {
					tasks[tasks.length - 1].description = description;
				}
			};

			for (const line of taskLines) {
				if (this.isActivityLine(line)) {
					activity = line.substr(0, line.length - 1);
				} else if (this.isTaskDescriptionLine(line)) {
					description.push(line.trimLeft());
				} else {
					updateDescription(description);
					description = [];
					tasks.push(this.getTask(line, lineNo, activity));
				}
				lineNo++;
			}

			updateDescription(description);

			return tasks;
		}

		return [];
	}

	private static getTask(taskTitle: string, lineNo: number, activity?: string): Task {
		const task = <Task>{};

		taskTitle = taskTitle.replace(Constants.TaskPrefixRegex, '');

		const match_id = taskTitle.match(Constants.TaskIdRegex);
		if (match_id !== null) {
			const id = match_id.groups!.id;

			task.id = parseInt(id);
			taskTitle = taskTitle.replace(match_id[0], '');
		}

		const match = taskTitle.match(Constants.TaskEstimationRegex);
		if (match !== null) {
			const est = match.groups!.estimation;
			if (est) {
				task.estimation = parseFloat(est);
			} else {
				const minutes = parseInt(match.groups!.estimation_m);
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
		let isEndOfUserStory = prefix.endRegex!.test(line) ||  prefix.regex.test(line);
		return isEndOfUserStory;
	}

	// TODO: remove
	private static isEndOfUserStory(line: string) {
		let isEndOfUserStory = Constants.UserStoryAgile.endRegex!.test(line) || Constants.UserStoryAgile.regex.test(line);
		return isEndOfUserStory;
	}

	// TODO: remove
	private static isEndOfBug(line: string) {
		let isEndOfUserStory = Constants.Bug.endRegex!.test(line) || Constants.Bug.regex.test(line);
		return isEndOfUserStory;
	}

	private static isActivityLine = (line: string) => Constants.ActivityTypeLine.test(line);
	private static isTaskDescriptionLine = (line: string) => Constants.TaskDescriptionRegex.test(line);
}

