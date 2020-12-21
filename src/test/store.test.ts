import * as Constants from "../constants";
import { AzureWorkItemInfoResult, WorkItemInfo } from "../models/azure-client/workItems";
var expect = require("expect.js") as (target?: any) => Expect.Root;
import { SessionStore } from "../store";
import { IAzureClient, IterationInfo, TaskInfo } from "../utils/azure-client";
import { Configuration } from "../utils/config";
import { Logger } from "../utils/logger";
import { ITextProcessor } from "../utils/textProcessor";
import { IVsCodeTextEditorService } from "../vsCodeTextEditorService";
import * as sinon from "sinon";
import { IterationTextInput } from "../models/textProcessor";

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
      getIterationWorkItems: () => Promise.resolve([]),
      getActivityTypes: () => Promise.resolve([]),
      GetWorkItemInfos: () => Promise.resolve(<AzureWorkItemInfoResult>{}),
      getMaxTaskStackRank: () => Promise.resolve(-1),
      createWorkItem: () => Promise.resolve(<WorkItemInfo>{}),
      createOrUpdateTask: () => Promise.resolve(-1),
    };

    const logger = new Logger();

    config = new Configuration(logger);

    textProcessor = {
      getWorkItemLineIndices: () => [],
      getIteration: () => undefined,
      getWorkItemInfo: () => undefined,

      // TODO: remove
      getUserStoryLineIndices: () => undefined,
      getUserStory: () => undefined,
      getBugLineIndices: () => [],
      getBug: () => undefined,
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

      const getCurrentIterationSpy = sinon.spy(azureClient, "getCurrentIterationInfo");

      vsCodeTextEditorService.getEditorText = () => undefined;

      const result = await store.determineIteration();

      expect(getCurrentIterationSpy.calledOnce).to.be(true);
      expect(result).to.be(iterationInfo);
    });

    it("should call the azure client only once to get the current iteration when called multiple times", async () => {
      const iterationInfo: IterationInfo = {
        id: "1",
        name: "my name",
        path: "my/path",
      };

      azureClient.getCurrentIterationInfo = () => Promise.resolve(iterationInfo);

      const getCurrentIterationSpy = sinon.spy(azureClient, "getCurrentIterationInfo");

      vsCodeTextEditorService.getEditorText = () => undefined;

      const result = await store.determineIteration();
      const result2 = await store.determineIteration();

      expect(getCurrentIterationSpy.calledOnce).to.be(true);
      expect(result).to.be(iterationInfo);
      expect(result).to.be(result2);
    });
  });

  it("should call get the current iteration when there is text in the editor but no iteration prefix", async () => {
    const iterationInfo: IterationInfo = {
      id: "1",
      name: "my name",
      path: "my/path",
    };

    azureClient.getCurrentIterationInfo = () => Promise.resolve(iterationInfo);
    vsCodeTextEditorService.getEditorText = () => `NOT#1 not configured hash
US#1 - known user story hash
US#new - known user story hash
SU#1 - other not configured hash
BUG#1 - known bug hash
BUG#new - known bug hash`;

    const getCurrentIterationSpy = sinon.spy(azureClient, "getCurrentIterationInfo");
    const getEditorTextSpy = sinon.spy(vsCodeTextEditorService, "getEditorText");

    const result = await store.determineIteration();

    expect(getCurrentIterationSpy.calledOnce).to.be(true);
    expect(getEditorTextSpy.calledOnce).to.be(true);
    expect(result).to.be(iterationInfo);
  });

  it("should set the custom iteration when the itertion prefix is found", async () => {
    const iterationInfo: IterationInfo = {
      id: "1",
      name: "my name",
      path: "my/path",
    };

    const azureClientIterations: IterationInfo[] = [
      {
        id: "00000000-0000-0000-0000-00000000001",
        name: "Iteration 1",
        path: "project/Iteration1",
      },
      {
        id: "00000000-0000-0000-0000-00000000002",
        name: "Iteration 2",
        path: "project/Iteration2",
      },
    ];

    azureClient.getCurrentIterationInfo = () => Promise.resolve(iterationInfo);
    azureClient.getIterationsInfo = () => Promise.resolve(azureClientIterations);
    vsCodeTextEditorService.getEditorText = () => `IT#00000000-0000-0000-0000-00000000002 - Iteration 2 - (project/Iteration 1)
NOT#1 not configured hash
US#1 - known user story hash
US#new - known user story hash
SU#1 - other not configured hash
BUG#1 - known bug hash
BUG#new - known bug hash`;

    textProcessor.getIteration = () => <IterationTextInput>{ id: "00000000-0000-0000-0000-00000000002", line: 0 };

    const getCurrentIterationSpy = sinon.spy(azureClient, "getCurrentIterationInfo");
    const getIterationInfosSpy = sinon.spy(azureClient, "getIterationsInfo");
    const getEditorTextSpy = sinon.spy(vsCodeTextEditorService, "getEditorText");
    const getIterationSpy = sinon.spy(textProcessor, "getIteration");

    const result = await store.determineIteration();

    expect(getCurrentIterationSpy.notCalled).to.be(true);
    expect(getEditorTextSpy.calledOnce).to.be(true);
    expect(getIterationSpy.calledOnce).to.be(true);
    expect(getIterationInfosSpy.calledOnce).to.be(true);
    expect(result).not.to.be(iterationInfo);
    expect(result).to.be(azureClientIterations[0]);
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
