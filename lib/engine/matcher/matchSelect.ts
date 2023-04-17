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

import { flattenObject } from '../../util/Flatten';


/**
 * Updates the matched filters according to the provided data
 * O(n) with n the number of values to be tested against document fields
 *
 * @param {FieldOperand} operand - content of all conditions to be tested
 * @param {object} testTables - test tables to update when a filter matches the document
 * @param {object} document
 */
export function MatchSelect (operand, testTables, document) {
  // const filters = operand.custom.filters;
  // const subfilters = filters
  //   .filter(filterInfo => matchAny(document, filterInfo.value))
  //   .map(filterInfo => filterInfo.subfilter);

  // if (subfilters.length > 0) {
  //   testTables.addMatch(subfilters);
  // }

  for (const [key, indexMap] of operand.fields.entries()) {
    if (!Array.isArray(document[key])) {
      continue;
    }

    for (const [index, indexEngine] of indexMap.entries()) {
      // If the index is negative, we need to count from the end of the array
      const computedIndex = index >= 0 ? index : document[key].length + index;

      if (computedIndex < 0 || computedIndex >= document[key].length) {
        continue;
      }
      
      const value = document[key][computedIndex];

      const matchedFilters = indexEngine.engine.match(flattenObject({ value }));

      for (const filterId of matchedFilters) {
        testTables.addMatch(indexEngine.filters.get(filterId));
      }
    }
  }
}
