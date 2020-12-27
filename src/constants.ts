export const LanguageId = 'planner';

export const NewLineRegex = /\r?\n/g;
export const ActivityTypeTriggerRegex = /^[a-z]*$/i;
export const SnippetTriggerRegex = /^[a-z]*$/i;
export const ActivityTypeLine = /^[a-z]+:$/i;

export const IterationPrefix = 'IT#';
export const IterationRegex = /^IT#([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})/i;

export interface IPrefix {
	prefix: string,
	regex: RegExp,
	endRegex?: RegExp,
	workItemType: string // the work item type name from azure devops
}

export const UserStoryAgile: IPrefix = {
	prefix: 'US#',
	workItemType: 'User Story',
	regex: /^US#(?<id>\d+|new)( - (?<title>.*))?/,
	endRegex: /^(---|\s*)$/	
}

export const UserStoryScrum: IPrefix = {
	prefix: 'US#',
	workItemType: 'Product Backlog Item',
	regex: /^US#(?<id>\d+|new)( - (?<title>.*))?/,
	endRegex: /^(---|\s*)$/	
}

export const Bug: IPrefix = {
	prefix: 'BUG#',
	workItemType: 'Bug',
	regex: /^BUG#(?<id>\d+|new)( - (?<title>.*))?/,
	endRegex: /^(---|\s*)$/
};

export const TaskPrefixRegex = /^\s*[-*]\s*/;
export const TaskEstimationRegex = /\s*[,-]\s*((?<estimation_m>\d+)m|(?<estimation>\d+(?:\.\d+)?)h?)/;
export const TaskIdRegex = /\s*\[#(?<id>\d+)\]$/;
export const TaskDescriptionRegex = /^\t/;
export const WorkItemIdFromUrl = /\/workItems\/(\d+)/;

export const Commands = {
	publish: 'sprintplanner.publish'
};
