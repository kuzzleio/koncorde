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

const Standardizer = require('./standardize');
const { Canonical } = require('./canonical');

/**
 * Checks that provided filters are valid,
 * standardizes them by reducing the number of used keywords
 * and converts these filters in canonical form
 *
 * @class Transformer
 */
class Transformer {
  constructor(config) {
    this.standardizer = new Standardizer(config);
    this.canonical = new Canonical(config);
  }

  /**
   * Checks, standardizes and converts filters in canonical form
   *
   * @param {Object} filters
   * @return {Array}
   */
  normalize(filters) {
    const standardized = this.standardizer.standardize(filters);

    return this.canonical.convert(standardized);
  }

  /**
   * Performs a simple filter check to validate it, without converting
   * it to canonical form
   *
   * @param {object} filters
   */
  check(filters) {
    this.standardizer.standardize(filters);
  }
}

/**
 * @type {Transformer}
 */
module.exports = { Transformer };
