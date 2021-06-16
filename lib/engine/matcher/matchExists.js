/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2021 Kuzzle
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

/**
 * Updates the matched filters according to the provided data
 * O(min(n,m)) with n the number of document keys and m the number of fields to test
 *
 * @param {FieldOperand} operand - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 */
function matchExists (operand, testTables, document) {
  const keys = Object.keys(document);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const field = operand.fields.get(key);

    if (field) {
      testTables.addMatch(field.subfilters);

      if (Array.isArray(document[key])) {
        const uniq = new Set(document[key]);

        for (const value of uniq.values()) {
          const entry = field.values.get(value);

          if (entry) {
            testTables.addMatch(entry);
          }
        }
      }
    }
  }
}

module.exports = matchExists;
