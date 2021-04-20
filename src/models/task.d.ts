
// export interface Task {
// 	id?: number;
// 	title: string;
// 	estimation?: number;
// 	description?: string[];
// 	activity?: string;
// 	line: number;
// }

// export interface WorkItem {
// 	id?: number;
// 	title: string;
// 	tasks: Task[];
// 	line: number;
// }

// export interface WorkItemWithPrefix extends WorkItem {
// 	prefix: IPrefix;
// }


export interface Task {
	id?: number;
	title: string;
	estimation?: number;
	description?: string[];
	activity?: string;
	line: number;
    stackRank?: number;
}

export interface UserStory {
	line: number;
	id?: number;
	title: string;
    areaPath: string;
	tasks: Task[];
}