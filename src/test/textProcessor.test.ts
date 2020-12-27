/* eslint-disable @typescript-eslint/no-non-null-assertion */
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
var expect = require('expect.js') as (target?: any) => Expect.Root;
import * as Constants from '../constants';
import { IterationTextInput } from '../models/textProcessor';
import { TextProcessor } from '../utils/textProcessor';

describe("Given TextProcessor", function () {
	let textProcessor: TextProcessor;
	let prefixes: Constants.IPrefix[];

	beforeEach(() => {
		textProcessor = new TextProcessor();
		prefixes = [Constants.UserStoryAgile, Constants.Bug];
	})

	describe("getWorkItemLineIndices", () => {
		it("when calling without lines", () => {
			const lines: string[] = [];

			const results = textProcessor.getWorkItemLineIndices(lines, prefixes);

			expect(results).to.be.eql([]);
		});

		it("when calling with prefixes that are not configured", () => {
			const lines: string[] = `NOT#1 not configured hash
SU#1 other not configured hash`.split("\n");

			const results = textProcessor.getWorkItemLineIndices(lines, prefixes);

			expect(results).to.be.eql([]);
		});

		it("Should only map to known prefixes", () => {
			const lines: string[] = `NOT#1 not configured hash
US#1 - known user story hash
US#new - known user story hash
SU#1 - other not configured hash
BUG#1 - known bug hash
BUG#new - known bug hash`.split("\n");

			const results = textProcessor.getWorkItemLineIndices(lines, prefixes);

			expect(results).to.be.eql([1, 2, 4, 5]);
		});
	});

	describe("getIteration", () => {
		it("when calling without lines", () => {
			const lines: string[] = [];

			const results = textProcessor.getIteration(lines, -1);

			expect(results).to.be.eql(undefined);
		});

		it("when calling without iteration prefix", () => {
			const lines: string[] = `US#1 - not configured hash
BUG#1 - other not configured hash`.split("\n");

			const results = textProcessor.getIteration(lines, 1);

			expect(results).to.be.eql(undefined);
		});

		it("when calling with iteration prefix not on the first line of the file", () => {
			const lines: string[] = `US#1 - not configured hash
IT#d22d6b81-79d4-43c8-8160-ff44077aa244 - Iteration 1 - (project\Iteration 1)
BUG#1 - other not configured hash`.split("\n");

			const result = textProcessor.getIteration(lines, 2);

			expect(result).not.to.eql(undefined);
			expect(result?.id).to.eql("d22d6b81-79d4-43c8-8160-ff44077aa244");
			expect(result?.line).to.eql(1);
		});

		it("when calling with iteration prefix not on the first line of the file and cursor before iteration", () => {
			const lines: string[] = `US#1 not configured hash
US#2 - not configured hash
IT#d22d6b81-79d4-43c8-8160-ff44077aa244 - Iteration 1 - (project\Iteration 1)
BUG#1 - other not configured hash`.split("\n");

			const result = textProcessor.getIteration(lines, 1);

			expect(result).to.eql(undefined);			
		});

		it("When calling with iteration on the first line of the file", () => {
			const lines: string[] = `IT#d22d6b81-79d4-43c8-8160-ff44077aa244 - Iteration 1 - (project\Iteration 1)
US#1 - not configured hash
BUG#1 - other not configured hash`.split("\n");

			const result = textProcessor.getIteration(lines, 2);

			expect(result).not.to.eql(undefined);
			expect(result?.id).to.eql("d22d6b81-79d4-43c8-8160-ff44077aa244");
			expect(result?.line).to.eql(0);
		});
	});

	describe("getWorkItemInfo", () => {
		it("when calling without lines", () => {
			const lines: string[] = [];

			const results = textProcessor.getWorkItemInfo(lines, -1, prefixes);

			expect(results).to.be.eql(undefined);
		});

		it("when calling with a single line", () => {
			const lines: string[] = `US#1 - my user story`.split("\n");

			const results = textProcessor.getWorkItemInfo(lines, 0, prefixes);

			expect(results).not.to.be.eql(undefined);
			expect(results?.id).to.eql(1);
			expect(results?.line).to.eql(0);
			expect(results?.prefix).to.equal(Constants.UserStoryAgile);
			expect(results?.tasks).to.eql([]);
			expect(results?.title).to.eql("my user story");
		});

		it("when calling with multiple lines and having the cursor on the 2nd item", () => {
			const lines: string[] = `US#1 - my user story
BUG#2 - my bug`.split("\n");

			const result = textProcessor.getWorkItemInfo(lines, 1, prefixes);

			expect(result).not.to.be.eql(undefined);
			expect(result?.id).to.eql(2);
			expect(result?.line).to.eql(1);
			expect(result?.prefix).to.equal(Constants.Bug);
			expect(result?.tasks).to.eql([]);
			expect(result?.title).to.eql("my bug");
		});

		it("when calling with a single line with activities and tasks and cursor somewhere in the middle", () => {
			const lines = `BUG#13 - Bug title (just informational)
Development:
- Discussion of the idea, 1h [#101]
- Create metrics for Bug, 4h [#102]
	Description of the task, leading whitespaces will be trimmed
	It can be multiline as well, emojis more than welcome 👌😎
- New sample task
Testing:
- Integration tests, 2h [#103]
- UI tests, 4h [#104]
- small task, 0.5h [#105]
- even smaller one, 3m`.split("\n")

			const result = textProcessor.getWorkItemInfo(lines, 7, prefixes);

			expect(result).not.to.be.eql(undefined);
			expect(result?.id).to.eql(13);
			expect(result?.line).to.eql(0);
			expect(result?.prefix).to.equal(Constants.Bug);
			expect(result?.tasks.length).to.eql(7);
			expect(result?.title).to.eql("Bug title (just informational)");

			expect(result!.tasks[0]).to.be.eql({
				activity: 'Development',
				description: [],
				estimation: 1,
				title: 'Discussion of the idea',
				line: 2,
				id: 101
			});

			expect(result!.tasks[1]).to.be.eql({
				estimation: 4,
				title: 'Create metrics for Bug',
				description:
					['Description of the task, leading whitespaces will be trimmed',
						'It can be multiline as well, emojis more than welcome 👌😎'],
				activity: 'Development',
				line: 3,
				id: 102
			});
			expect(result!.tasks[2]).to.be.eql({
				title: 'New sample task',
				description: [],
				activity: 'Development',
				line: 6
			});
			expect(result!.tasks[3]).to.be.eql({
				estimation: 2,
				title: 'Integration tests',
				description: [],
				activity: 'Testing',
				line: 8,
				id: 103
			});
			expect(result!.tasks[4]).to.be.eql({
				estimation: 4,
				title: 'UI tests',
				description: [],
				activity: 'Testing',
				line: 9,
				id: 104
			});
			expect(result!.tasks[5]).to.be.eql({
				estimation: 0.5,
				title: 'small task',
				description: [],
				activity: 'Testing',
				line: 10,
				id: 105
			});
			expect(result!.tasks[6]).to.be.eql({
				estimation: 0.05,
				title: 'even smaller one',
				description: [],
				activity: 'Testing',
				line: 11
			});
		});		

		it('when calling for new US', () => {
			const lines = `US#new - New User Story
Development:
- Discussion of the idea, 1h
- Create metrics for User Story, 4h
	Description of the task, leading whitespaces will be trimmed
	It can be multiline as well, emojis more than welcome 👌😎
- New sample task`.split("\n");

			const results = textProcessor.getWorkItemInfo(lines, 0, prefixes);

			expect(results).to.be.ok();
			expect(results!.title).to.be('New User Story');
			expect(results!.id).to.be.equal(undefined);
			expect(results!.tasks.length).to.be.equal(3);
		});

		it('when calling for new BUG', () => {
			const lines = `BUG#new - New Bug
Development:
- Discussion of the idea, 1h
- Create metrics for User Story, 4h
	Description of the task, leading whitespaces will be trimmed
	It can be multiline as well, emojis more than welcome 👌😎
- New sample task`.split("\n");

			const results = textProcessor.getWorkItemInfo(lines, 0, prefixes);

			expect(results).to.be.ok();
			expect(results!.title).to.be('New Bug');
			expect(results!.id).to.be.equal(undefined);
			expect(results!.tasks.length).to.be.equal(3);
		});
	});
});