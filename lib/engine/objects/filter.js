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
 * Creates a Filter object referring to a collection of subfilters
 *
 * @class Filter
 * @type {object}
 * @property {string} id
 * @property {Array<Array<Object>>} filters in their canonical form
 * @property {Array<Subfilter>} subfilters
 *
 * @param {string} id - filter unique id
 * @param {Array<Array<Object>>} filters
 */
class Filter {
  constructor (id, filters) {
    this.id = id;
    this.filters = filters;
    this.subfilters = new Set();
  }
}

module.exports = Filter;
