/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {runtimeFor} from './runtimes';

const runtime = runtimeFor('duckdb');

describe('extendModel', () => {
  test('can run query in extend section', async () => {
    const model = runtime.loadModel(`
      query: q1 is table('malloytest.aircraft')->{
        where: state = 'CA'
        group_by: state
      }
    `);
    const q1 = model.loadQueryByName('q1');
    const oneState = await q1.run();
    expect(oneState.data.path(0, 'state').value).toBe('CA');

    const extended = model.extendModel(`
      query: q2 is table('malloytest.aircraft')->{
        where: state = 'NV'
        group_by: state
      }
    `);
    const q2 = extended.loadQueryByName('q2');
    const twoState = await q2.run();
    expect(twoState.data.path(0, 'state').value).toBe('NV');
  });
  test('can reference query from previous section ', async () => {
    const model = runtime.loadModel(`
      query: q1 is table('malloytest.aircraft')->{
        where: state = 'CA'
        group_by: state
      }
    `);
    const q1 = model.loadQueryByName('q1');
    const oneState = await q1.run();
    expect(oneState.data.path(0, 'state').value).toBe('CA');

    const extended = model.extendModel('query: q2 is ->q1 -> { project: * }');
    const q2 = extended.loadQueryByName('q2');
    const twoState = await q2.run();
    expect(twoState.data.path(0, 'state').value).toBe('CA');
  });
  test('can reference sql from previous section ', async () => {
    const model = runtime.loadModel(`
      sql: q1 is { connection: "duckdb" select: """SELECT 'CA' as state""" }
    `);

    const extended = model.extendModel(
      'query: q2 is from_sql(q1)->{project: *}'
    );
    const q2 = extended.loadQueryByName('q2');
    const twoState = await q2.run();
    expect(twoState.data.path(0, 'state').value).toBe('CA');
  });
});