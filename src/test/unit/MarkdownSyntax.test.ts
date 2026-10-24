import * as assert from 'assert';
import MarkdownSyntax from '../../MarkdownSyntax';

suite('Unit: MarkdownSyntax', () => {
    const syntax = new MarkdownSyntax();

    test('sourceBlock with and without language', () => {
        assert.strictEqual(syntax.sourceBlock('x = 1', ' python '), '```python\nx = 1\n```\n');
        assert.strictEqual(syntax.sourceBlock('x = 1'), '```\nx = 1\n```\n');
    });

    test('sourceBlock fence is longer than every fence inside the content', () => {
        assert.strictEqual(
            syntax.sourceBlock('```js\na\n```', 'markdown'),
            '````markdown\n```js\na\n```\n````\n');
        assert.strictEqual(
            syntax.sourceBlock('  `````\n```', ''),
            '``````\n  `````\n```\n``````\n');
        // Backticks inside a line cannot close the block.
        assert.strictEqual(syntax.sourceBlock('a ``` b', ''), '```\na ``` b\n```\n');
    });

    test('fileSourceBlock puts a link above the fence', () => {
        assert.strictEqual(
            syntax.fileSourceBlock('code', 'csharp', 'src/Program.cs', 'Program.cs'),
            '[→ Program.cs](src/Program.cs)\n```csharp\ncode\n```\n');
    });

    test('fileSourceBlock encloses paths with spaces and escapes brackets', () => {
        assert.strictEqual(
            syntax.fileSourceBlock('code', undefined, 'src/My [1].cs', 'My [1].cs'),
            '[→ My \\[1\\].cs](<src/My [1].cs>)\n```\ncode\n```\n');
    });

    test('image uses the file name without extension as alt text', () => {
        assert.strictEqual(syntax.image('../img/my diagram.png'), '![my diagram](<../img/my diagram.png>)\n');
        assert.strictEqual(syntax.image('a.b.png'), '![a.b](a.b.png)\n');
    });

    test('imageWithSource adds a visible source line', () => {
        assert.strictEqual(
            syntax.imageWithSource('img/a.png', 'https://example.com/a.png'),
            '![a](img/a.png)\n\n*Source: <https://example.com/a.png>*\n');
    });

    test('table pads every column to its widest cell, at least three characters', () => {
        assert.strictEqual(
            syntax.table([['Name', 'Age'], ['Anna', '17']]),
            '| Name | Age |\n|------|-----|\n| Anna | 17  |\n');
    });

    test('table escapes pipes', () => {
        assert.strictEqual(
            syntax.table([['A', 'B'], ['a|b', '']]),
            '| A    | B   |\n|------|-----|\n| a\\|b |     |\n');
        assert.strictEqual(syntax.table([]), '');
    });

    test('parseTable is the inverse of table', () => {
        const rows = [['Name', 'Age'], ['a|b', ''], ['', 'x']];
        assert.deepStrictEqual(syntax.parseTable(syntax.table(rows)), rows);
    });

    test('parseTable accepts tables without outer pipes, alignment rows and CRLF', () => {
        assert.deepStrictEqual(
            syntax.parseTable('A | B\r\n:--|--:\r\n1 | 2\r\n'),
            [['A', 'B'], ['1', '2']]);
    });

    test('parseTable ignores lines without a pipe', () => {
        assert.deepStrictEqual(syntax.parseTable('Intro\n\n| A |\n|---|\n| 1 |\n\nOutro'), [['A'], ['1']]);
    });

    suite('formatTableAt', () => {
        const lines = [
            '# Title',
            '',
            '  | Name | Age |',
            '  |:-|-:|',
            '  | Bernd | 102 |',
            '',
            'a | b without delimiter row',
            ''
        ];

        test('finds the table around the cursor line and keeps its indentation', () => {
            const expected = {
                startLine: 2,
                endLine: 4,
                text: '  | Name  | Age |\n  |:------|----:|\n  | Bernd | 102 |'
            };
            for (const line of [2, 3, 4]) {
                assert.deepStrictEqual(syntax.formatTableAt(lines, line), expected, `cursor on line ${line}`);
            }
        });

        test('returns undefined outside a table and for pipe lines without delimiter row', () => {
            assert.strictEqual(syntax.formatTableAt(lines, 0), undefined);
            assert.strictEqual(syntax.formatTableAt(lines, 5), undefined);
            assert.strictEqual(syntax.formatTableAt(lines, 6), undefined);
            assert.strictEqual(syntax.formatTableAt(lines, 99), undefined);
        });
    });
});
