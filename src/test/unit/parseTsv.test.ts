import * as assert from 'assert';
import { parseTsv } from '../../parseTsv';

suite('Unit: parseTsv', () => {
    test('splits lines and tabs and accepts CRLF', () => {
        assert.deepStrictEqual(parseTsv('Name\tAge\r\nAnna\t17\r\n'), [['Name', 'Age'], ['Anna', '17']]);
    });

    test('trims cells and pads short rows to the widest row', () => {
        assert.deepStrictEqual(parseTsv(' A \tB\nx\ny\tz\textra'), [
            ['A', 'B', ''],
            ['x', '', ''],
            ['y', 'z', 'extra']
        ]);
    });

    test('keeps trailing tabs as empty cells', () => {
        assert.deepStrictEqual(parseTsv('A\tB\nx\t\n'), [['A', 'B'], ['x', '']]);
    });

    test('returns no rows for empty input', () => {
        assert.deepStrictEqual(parseTsv('\n\n'), []);
    });
});
