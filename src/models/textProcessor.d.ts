import { IPrefix } from "../constants";

export class IterationTextInput {
  line: number;
  id: string;
}

export interface TaskTextInput {
	id?: number;
	title: string;
	estimation?: number;
	description?: string[];
	activity?: string;
	line: number;
}

export interface WorkItemTextInput {
	id?: number;
	title: string;
	tasks: TaskTextInput[];
    line: number;
    prefix: IPrefix;
}
