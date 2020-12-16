import { promises } from "fs";
import * as Constants from "../constants";
import { Session } from "inspector";
import * as vsc from "vscode";
import { AzureWorkItemInfoResult, WorkItemInfo } from "../models/azure-client/workItems";
var expect = require("expect.js") as (target?: any) => Expect.Root;
import { SessionStore } from "../store";
import { AzureClient, IAzureClient, IterationInfo, TaskInfo, UserStoryIdentifier } from "../utils/azure-client";
import { Configuration } from "../utils/config";
import { Logger } from "../utils/logger";
import { ITextProcessor, TextProcessor } from "../utils/textProcessor";
import { IVsCodeTextEditorService, VsCodeTextEditorService } from "../vsCodeTextEditorService";
import * as sinon from "sinon";

describe("Given SessionStore", function () {
  let store: SessionStore;
  let azureClient: IAzureClient;
  let config: Configuration;
  let textProcessor: ITextProcessor;
  let vsCodeTextEditorService: IVsCodeTextEditorService;

  beforeEach(() => {
    azureClient = {
      getIterationsInfo: () => Promise.resolve([]),
      getCurrentIterationInfo: () => Promise.resolve(<IterationInfo>{}),
      getIterationWorkItems: (iterationId: string) => Promise.resolve([]),
      getActivityTypes: () => Promise.resolve([]),
      GetWorkItemInfos: (userStoryIds: number[]) => Promise.resolve(<AzureWorkItemInfoResult>{}),
      getMaxTaskStackRank: (taskIds: number[]) => Promise.resolve(-1),
      createWorkItem: (title: string, iterationPath: string, workItemType: string) => Promise.resolve(<WorkItemInfo>{}),
      createOrUpdateTask: (task: TaskInfo) => Promise.resolve(-1),
    };

    const logger = new Logger();

    config = new Configuration(logger);

    textProcessor = {
      getWorkItemLineIndices: (allLines: string[], prefixes: Constants.IPrefix[]) => [],
      getIteration: (allLines: string[], currentLine: number) => undefined,
      getWorkItemInfo: (allLines: string[], currentLine: number, prefixes: Constants.IPrefix[]) => undefined,

      // TODO: remove
      getUserStoryLineIndices: (allLines: string[]) => undefined,
      getUserStory: (allLines: string[], currentLine: number) => undefined,
      getBugLineIndices: (allLines: string[]) => [],
      getBug: (allLines: string[], currentLine: number) => undefined,
    };

    vsCodeTextEditorService = {
      hasActiveEditor: () => true,
      getEditorText: () => undefined,
    };

    store = new SessionStore(azureClient, config, logger, textProcessor, vsCodeTextEditorService);
  });

  describe("determineIteration", function () {
    it("should return the azure client current iteration when editorText is undefined", async () => {
      const iterationInfo: IterationInfo = {
        id: "1",
        name: "my name",
        path: "my/path",
      };

      azureClient.getCurrentIterationInfo = () => Promise.resolve(iterationInfo);

      const azureClientSpy = sinon.spy(azureClient, "getCurrentIterationInfo");

      vsCodeTextEditorService.getEditorText = () => undefined;

      const result = await store.determineIteration();

      expect(azureClientSpy.calledOnce).to.be(true);
      expect(result).to.be(iterationInfo);
    });

    it("should call the azure client only once to get the curren iteration when called multiple times", async () => {
        const iterationInfo: IterationInfo = {
          id: "1",
          name: "my name",
          path: "my/path",
        };
  
        azureClient.getCurrentIterationInfo = () => Promise.resolve(iterationInfo);
  
        const azureClientSpy = sinon.spy(azureClient, "getCurrentIterationInfo");
  
        vsCodeTextEditorService.getEditorText = () => undefined;
  
        const result = await store.determineIteration();
        const result2 = await store.determineIteration();
  
        expect(azureClientSpy.calledOnce).to.be(true);
        expect(result).to.be(iterationInfo);
        expect(result).to.be(result2);
      });
  });
});
// 	describe('determineIteration', function() {
// 		it("when calling should set the correct iteration", function () {
//             const lines = ""

// 			expect(results).to.be.eql([0, 1, 2, 4, 7]);
// 		});

// 		it('when calling getUserStory for existing US', () => {
// 			const lines = `US#13 - User Story Title (just informational)
// Development:
// - Discussion of the idea, 1h [#101]
// - Create metrics for User Story, 4h [#102]
// 	Description of the task, leading whitespaces will be trimmed
// 	It can be multiline as well, emojis more than welcome 👌😎
// - New sample task
// Testing:
// - Integration tests, 2h [#103]
// - UI tests, 4h [#104]
// - small task, 0.5h [#105]
// - even smaller one, 3m`.split("\n");

// 			const results = TextProcessor.getUserStory(lines, 0);

// 			expect(results).to.be.ok();
// 			expect(results!.title).to.be('User Story Title (just informational)');
// 			expect(results!.id).to.be(13);
// 			expect(results!.line).to.be(0);
// 			expect(results!.tasks).to.have.length(7);
// 			expect(results!.tasks[0]).to.be.eql({
// 				activity: 'Development',
// 				description: [],
// 				estimation: 1,
// 				title: 'Discussion of the idea',
// 				line: 2,
// 				id: 101
// 			});

// 			expect(results!.tasks[1]).to.be.eql({
// 				estimation: 4,
// 				title: 'Create metrics for User Story',
// 				description:
// 					['Description of the task, leading whitespaces will be trimmed',
// 						'It can be multiline as well, emojis more than welcome 👌😎'],
// 				activity: 'Development',
// 				line: 3,
// 				id: 102
// 			});
// 			expect(results!.tasks[2]).to.be.eql({
// 				title: 'New sample task',
// 				description: [],
// 				activity: 'Development',
// 				line: 6
// 			});
// 			expect(results!.tasks[3]).to.be.eql({
// 				estimation: 2,
// 				title: 'Integration tests',
// 				description: [],
// 				activity: 'Testing',
// 				line: 8,
// 				id: 103
// 			});
// 			expect(results!.tasks[4]).to.be.eql({
// 				estimation: 4,
// 				title: 'UI tests',
// 				description: [],
// 				activity: 'Testing',
// 				line: 9,
// 				id: 104
// 			});
// 			expect(results!.tasks[5]).to.be.eql({
// 				estimation: 0.5,
// 				title: 'small task',
// 				description: [],
// 				activity: 'Testing',
// 				line: 10,
// 				id: 105
// 			});
// 			expect(results!.tasks[6]).to.be.eql({
// 				estimation: 0.05,
// 				title: 'even smaller one',
// 				description: [],
// 				activity: 'Testing',
// 				line: 11
// 			});
// 		});

// 		it('when calling getUserStory for new US', () => {
// 			const lines = `US#new - New User Story
// Development:
// - Discussion of the idea, 1h
// - Create metrics for User Story, 4h
// 	Description of the task, leading whitespaces will be trimmed
// 	It can be multiline as well, emojis more than welcome 👌😎
// - New sample task`.split("\n");

// 			const results = TextProcessor.getUserStory(lines, 0);

// 			expect(results).to.be.ok();
// 			expect(results!.title).to.be('New User Story');
// 			expect(results!.id).to.be.equal(undefined);
// 			expect(results!.tasks.length).to.be.equal(3);
// 		});
// 	});

// 	describe('Bug', function() {
// 		it("when calling getBugLineIndices", function () {
// 			const results = TextProcessor.getBugLineIndices(lines);

// 			expect(results).to.be.eql([5, 9, 10]);
// 		});

// 		it('when calling getBug for existing US', () => {
// 			const lines = `BUG#13 - Bug title (just informational)
// Development:
// - Discussion of the idea, 1h [#101]
// - Create metrics for Bug, 4h [#102]
// 	Description of the task, leading whitespaces will be trimmed
// 	It can be multiline as well, emojis more than welcome 👌😎
// - New sample task
// Testing:
// - Integration tests, 2h [#103]
// - UI tests, 4h [#104]
// - small task, 0.5h [#105]
// - even smaller one, 3m`.split("\n");

// 			const results = TextProcessor.getBug(lines, 0);

// 			expect(results).to.be.ok();
// 			expect(results!.title).to.be('Bug title (just informational)');
// 			expect(results!.id).to.be(13);
// 			expect(results!.line).to.be(0);
// 			expect(results!.tasks).to.have.length(7);
// 			expect(results!.tasks[0]).to.be.eql({
// 				activity: 'Development',
// 				description: [],
// 				estimation: 1,
// 				title: 'Discussion of the idea',
// 				line: 2,
// 				id: 101
// 			});

// 			expect(results!.tasks[1]).to.be.eql({
// 				estimation: 4,
// 				title: 'Create metrics for Bug',
// 				description:
// 					['Description of the task, leading whitespaces will be trimmed',
// 						'It can be multiline as well, emojis more than welcome 👌😎'],
// 				activity: 'Development',
// 				line: 3,
// 				id: 102
// 			});
// 			expect(results!.tasks[2]).to.be.eql({
// 				title: 'New sample task',
// 				description: [],
// 				activity: 'Development',
// 				line: 6
// 			});
// 			expect(results!.tasks[3]).to.be.eql({
// 				estimation: 2,
// 				title: 'Integration tests',
// 				description: [],
// 				activity: 'Testing',
// 				line: 8,
// 				id: 103
// 			});
// 			expect(results!.tasks[4]).to.be.eql({
// 				estimation: 4,
// 				title: 'UI tests',
// 				description: [],
// 				activity: 'Testing',
// 				line: 9,
// 				id: 104
// 			});
// 			expect(results!.tasks[5]).to.be.eql({
// 				estimation: 0.5,
// 				title: 'small task',
// 				description: [],
// 				activity: 'Testing',
// 				line: 10,
// 				id: 105
// 			});
// 			expect(results!.tasks[6]).to.be.eql({
// 				estimation: 0.05,
// 				title: 'even smaller one',
// 				description: [],
// 				activity: 'Testing',
// 				line: 11
// 			});
// 		});

// 		it('when calling getBug for new Bug', () => {
// 			const lines = `BUG#new - New Bug
// Development:
// - Discussion of the idea, 1h
// - Create metrics for Bug, 4h
// 	Description of the task, leading whitespaces will be trimmed
// 	It can be multiline as well, emojis more than welcome 👌😎
// - New sample task`.split("\n");

// 			const results = TextProcessor.getBug(lines, 0);

// 			expect(results).to.be.ok();
// 			expect(results!.title).to.be('New Bug');
// 			expect(results!.id).to.be.equal(undefined);
// 			expect(results!.tasks.length).to.be.equal(3);
// 		});
// 	})
// });
