import * as vsc from "vscode";
import { ISessionStore } from "../store";
import { Logger } from "../utils/logger";
import { Document } from "../utils/document";
import { PrefixService } from "../prefix-service";

export class WorkItemCompletionProvider implements vsc.CompletionItemProvider {
  constructor(private sessionStore: ISessionStore, private logger: Logger, private prefixService: PrefixService) {}

  async provideCompletionItems(
    document: vsc.TextDocument,
    position: vsc.Position,
    _token: vsc.CancellationToken,
    _context: vsc.CompletionContext
  ) {
    const text = Document.getTextBeforeCursor(document, position);

    const prefixes = this.prefixService.getPrefixes();

    for (let index = 0; index < prefixes.length; index++) {
      const prefix = prefixes[index];

      if (text === prefix.prefix) {
        try {
          await this.sessionStore.ensureHasItemsOfWorkItemType(prefix);

          if (this.sessionStore.workItems) {
            return this.sessionStore.workItems.map((us) => {
              const item = new vsc.CompletionItem(`${us.id} - ${us.title}`, vsc.CompletionItemKind.Class);
              item.sortText = us.title;

              return item;
            });
          }
        } catch (err) {
          if (err) {
            vsc.window.showErrorMessage(err.message);
            this.logger.log(err);
          }
        }
      }
	}    

    return [];
  }
}
