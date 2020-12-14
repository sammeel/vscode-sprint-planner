import * as vsc from 'vscode';
import { ISessionStore } from '../store';
import { Bug } from '../constants';
import { Logger } from '../utils/logger';
import { Document } from '../utils/document';

export class BugsCompletionProvider implements vsc.CompletionItemProvider {
	constructor(private sessionStore: ISessionStore, private logger: Logger) {
	}

	async provideCompletionItems(document: vsc.TextDocument, position: vsc.Position, _token: vsc.CancellationToken, _context: vsc.CompletionContext) {
		const text = Document.getTextBeforeCursor(document, position);

		if (text === Bug.prefix) {
			try {
				await this.sessionStore.ensureHasBugs();

				if (this.sessionStore.bugs) {
					return this.sessionStore.bugs.map(us => {
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

		return [];
	}
}
