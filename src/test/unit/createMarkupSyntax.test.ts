import * as assert from 'assert';
import AsciidocSyntax from '../../AsciidocSyntax';
import MarkdownSyntax from '../../MarkdownSyntax';
import { createMarkupSyntax } from '../../createMarkupSyntax';

suite('Unit: createMarkupSyntax', () => {
    test('the language id decides', () => {
        assert.ok(createMarkupSyntax({ languageId: 'asciidoc', fileName: 'Untitled-1' }) instanceof AsciidocSyntax);
        assert.ok(createMarkupSyntax({ languageId: 'markdown', fileName: 'notes.txt' }) instanceof MarkdownSyntax);
    });

    test('the file extension is the fallback for unknown language ids', () => {
        for (const fileName of ['a.adoc', 'a.ASCIIDOC', 'a.asc']) {
            assert.ok(createMarkupSyntax({ languageId: 'plaintext', fileName }) instanceof AsciidocSyntax, fileName);
        }
        for (const fileName of ['a.md', 'a.Markdown']) {
            assert.ok(createMarkupSyntax({ languageId: 'plaintext', fileName }) instanceof MarkdownSyntax, fileName);
        }
    });

    test('other documents are rejected', () => {
        assert.throws(
            () => createMarkupSyntax({ languageId: 'plaintext', fileName: 'notes.txt' }),
            /Only AsciiDoc and Markdown documents are supported\./);
    });
});
