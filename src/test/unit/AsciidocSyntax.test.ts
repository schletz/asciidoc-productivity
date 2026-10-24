import * as assert from 'assert';
import AsciidocSyntax from '../../AsciidocSyntax';

suite('Unit: AsciidocSyntax', () => {
    const syntax = new AsciidocSyntax();

    test('sourceBlock with and without language', () => {
        assert.strictEqual(syntax.sourceBlock('x = 1', ' python '), '[source,python]\n----\nx = 1\n----\n');
        assert.strictEqual(syntax.sourceBlock('x = 1', ''), '[source]\n----\nx = 1\n----\n');
        assert.strictEqual(syntax.sourceBlock('x = 1'), '[source]\n----\nx = 1\n----\n');
    });

    test('fileSourceBlock adds a link as block title', () => {
        assert.strictEqual(
            syntax.fileSourceBlock('code', 'csharp', 'src/My File.cs', 'My File.cs'),
            '.link:src/My File.cs[→ My File.cs]\n[source,csharp]\n----\ncode\n----\n');
    });

    test('image and imageWithSource', () => {
        assert.strictEqual(syntax.image('img/a.png'), 'image::img/a.png[]\n');
        assert.strictEqual(
            syntax.imageWithSource('img/a.png', 'https://example.com/a.png'),
            '.Source: https://example.com/a.png\nimage::img/a.png[]\n');
    });

    test('table writes one cell per line and escapes pipes', () => {
        assert.strictEqual(
            syntax.table([['Name', 'Age'], ['a|b', '']]),
            '[%header,cols="a,a"]\n|===\n|Name\n|Age\n\n|a\\|b\n|\n|===\n');
        assert.strictEqual(syntax.table([]), '');
    });

    test('parseTable is the inverse of table', () => {
        const rows = [['Name', 'Age'], ['a|b', ''], ['', 'x']];
        assert.deepStrictEqual(syntax.parseTable(syntax.table(rows).replace(/^\[.*\]\n/, '')), rows);
    });

    test('parseTable reads CRLF and returns no rows for an empty table', () => {
        assert.deepStrictEqual(syntax.parseTable('|===\r\n|A\r\n|B\r\n\r\n|1\r\n|2\r\n|==='), [['A', 'B'], ['1', '2']]);
        assert.deepStrictEqual(syntax.parseTable('|===\n|==='), []);
    });
});
