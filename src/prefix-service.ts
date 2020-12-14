import * as vsc from 'vscode';
import * as Constants from './constants';
import { Configuration } from './utils/config';

export class PrefixService implements vsc.Disposable {
    private _eventHandler: vsc.Disposable;
    private prefixes: Constants.IPrefix[] = [];

    constructor(private config: Configuration) {
        this.createPrefixes();

        this._eventHandler = config.onDidChange(newConfig => {
			this.config = newConfig;
            this.createPrefixes();
		});
    }

    dispose() {
		this._eventHandler.dispose();
	}

    private createPrefixes() {
        this.prefixes = [];

        switch (this.config.process) {
            case "Agile": 
                this.prefixes.push(Constants.UserStoryAgile);
                break;
            case "Scrum": 
                this.prefixes.push(Constants.UserStoryScrum);
                break;
            default: 
                throw new Error("Process type not supported");
		}

        this.prefixes.push(Constants.Bug);
    }

    getPrefixes(): Constants.IPrefix[] {
        return this.prefixes;
    }
}