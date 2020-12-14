import * as vsc from "vscode";
import * as Constants from "../constants";
import { TextProcessor } from "../utils/textProcessor";
import { LockableCommand } from "./lockableCommand";
import { PublishBase } from "./publish-base";

export class PublishCommand extends LockableCommand {

  constructor(private publishers: {[workItemType: string]: PublishBase}) {
	super();
  }

  async publish(line?: number) {
    const editor = vsc.window.activeTextEditor;
    if (!editor) {
      return;
    }

    await vsc.window.withProgress({ location: vsc.ProgressLocation.Notification }, async () => {

		let currentLine = line !== undefined ? line : editor.selection.active.line;
        const lines = editor.document.getText().split(Constants.NewLineRegex);

        const userStory = TextProcessor.getUserStory(lines, currentLine);
        if (!userStory) {
		  const bug = TextProcessor.getBug(lines, currentLine);
		  if (!bug) {
			  return console.log("Cannot find user story info or bug info in that line");
		  }else {
			this.publishers[Constants.BugPrefix].publish(line);
		  }
		} else {
			this.publishers[Constants.UserStoryPrefix].publish(line);
		}
    });
  }
}
