import * as vsc from 'vscode';

export interface IVsCodeTextEditorService {
    hasActiveEditor() : boolean;
    getEditorText(): string | undefined 
}

export class VsCodeTextEditorService implements IVsCodeTextEditorService {


    hasActiveEditor() : boolean {
        return vsc.window.activeTextEditor != null;
    }

    getEditorText(): string | undefined {
        if (this.hasActiveEditor()) {
            return vsc.window.activeTextEditor!.document.getText();
        }
        return undefined;
    }
}