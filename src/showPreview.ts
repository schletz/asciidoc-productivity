// =================================================================================================
// showPreview.ts
// Renders a preview for AsciiDoc documents in VS Code.
// This file uses a customized version of asciidoctor.js:
//     git clone https://github.com/asciidoctor/asciidoctor.js.git
//     cd asciidoctor.js
//     npm install
//     cd packages/core
//     npm install
//     
//     In packages/core/src/template-asciidoctor-browser.js change 
//     export default function Asciidoctor(moduleConfig)
//     to
//     window.Asciidoctor = function Asciidoctor(moduleConfig)
//
// Download asciidoctor-kroki for PlantUML Rendering from
// https://github.com/asciidoctor/asciidoctor-kroki/blob/master/dist/browser/asciidoctor-kroki.js
//
// Download highlight.js from https://highlightjs.org/download and copy min.js and theme to lib.
// Download MathJax from https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-chtml.js to lib.
// =================================================================================================
import * as vscode from 'vscode';
import { PreviewService } from './PreviewService';

/**
 * Entry point for the show preview command.
 * Wraps the PreviewService singleton call to maintain compatibility with extension.ts exports.
 * @param context - The VS Code extension context.
 */
export async function showPreview(context: vscode.ExtensionContext): Promise<void> {
    await PreviewService.getInstance().showPreview(context);
}