/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * Updates the matched filters according to the provided data
 * O(log n + m) with n the number of range filters stored
 * and m the number of matched ranges
 *
 * @param {FieldOperand} operand - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 * @param {boolean} not - used by notrange operator
 */
function MatchRange (operand, testTables, document, not = false) {
  for (const key of operand.keys) {
    let rangeConditions;
    if (typeof document[key] === 'number') {
      rangeConditions = operand.fields[key].tree.search(document[key], document[key]);
    } else if (not) {
      rangeConditions = operand.fields[key].conditions.values();
    }

    if (rangeConditions !== undefined) {
      for (const cond of rangeConditions) {
        testTables.addMatch(cond.subfilters);
      }
    }
  }
}

module.exports = MatchRange;
