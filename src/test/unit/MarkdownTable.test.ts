import * as assert from 'assert';
import MarkdownTable from '../../MarkdownTable';

suite('Unit: MarkdownTable', () => {
    test('render aligns cells according to the delimiter row', () => {
        const table = MarkdownTable.parse([
            '|Left|Center|Right|None|',
            '|:-|:-:|-:|-|',
            '|a|b|c|d|',
            '|long text|x|1234567|e|'
        ]);
        assert.deepStrictEqual(table.alignments, ['left', 'center', 'right', 'none']);
        assert.strictEqual(table.render(),
            '| Left      | Center |   Right | None |\n' +
            '|:----------|:------:|--------:|------|\n' +
            '| a         |   b    |       c | d    |\n' +
            '| long text |   x    | 1234567 | e    |');
    });

    test('render counts code points, not UTF-16 units', () => {
        const table = MarkdownTable.parse(['| A | B |', '|---|---|', '| 😀😀😀😀 | x |']);
        assert.strictEqual(table.render(), '| A    | B   |\n|------|-----|\n| 😀😀😀😀 | x   |');
    });

    test('parse pads the header when a body row has more cells', () => {
        const table = MarkdownTable.parse(['| A |', '|:-:|', '| 1 | 2 |']);
        assert.deepStrictEqual(table.rows, [['A', ''], ['1', '2']]);
        assert.deepStrictEqual(table.alignments, ['center', 'none']);
    });

    test('parse keeps escaped pipes and render escapes them again', () => {
        const table = MarkdownTable.parse(['| A | B |', '|---|---|', '| a\\|b | c |']);
        assert.deepStrictEqual(table.rows[1], ['a|b', 'c']);
        assert.strictEqual(table.render(), '| A    | B   |\n|------|-----|\n| a\\|b | c   |');
    });

    test('render prefixes every line with the indent', () => {
        assert.strictEqual(
            MarkdownTable.fromRows([['A'], ['1']]).render('  '),
            '  | A   |\n  |-----|\n  | 1   |');
    });

    test('isDelimiterRow recognizes rows with and without outer pipes', () => {
        assert.ok(MarkdownTable.isDelimiterRow('|---|:-:|'));
        assert.ok(MarkdownTable.isDelimiterRow(' --- | ---: '));
        assert.ok(!MarkdownTable.isDelimiterRow('| a | --- |'));
    });
});
