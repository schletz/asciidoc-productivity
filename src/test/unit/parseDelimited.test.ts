import * as assert from 'assert';
import { parseDelimited } from '../../parseDelimited';

suite('Unit: parseDelimited', () => {
    test('splits lines at the delimiter and trims cells', () => {
        assert.deepStrictEqual(parseDelimited('A: C\r\nB: D\r\n', ':'), [['A', 'C'], ['B', 'D']]);
    });

    test('treats a multi-character delimiter literally and pads short rows', () => {
        assert.deepStrictEqual(parseDelimited('a.*b.*c\nx', '.*'), [
            ['a', 'b', 'c'],
            ['x', '', '']
        ]);
    });

    test('returns no rows for empty input', () => {
        assert.deepStrictEqual(parseDelimited('', ';'), []);
    });
});
