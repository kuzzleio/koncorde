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

const { convertGeopoint } = require('../../util/convertGeopoint');

/**
 * Updates the matched filters according to the provided data
 * O(log n + m) with n the number of values to be tested against document fields,
 * and m the number of matched shapes
 *
 * @param {FieldOperand} operand - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 */
function MatchNotGeospatial (operand, testTables, document) {
  for (const [key, field] of operand.fields.entries()) {
    if (document[key]) {
      const point = convertGeopoint(document[key]);

      if (point === null) {
        return;
      }

      const result = operand.custom.index.queryPoint(point.lat, point.lon);

      for (const entry of field) {
        if (!result.includes(entry[0])) {
          testTables.addMatch(entry[1]);
        }
      }
    }
    else {
      for (const subfilters of field.values()) {
        testTables.addMatch(subfilters);
      }
    }
  }
}

module.exports = MatchNotGeospatial;
