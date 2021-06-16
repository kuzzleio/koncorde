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
 * Describe either a range or a not-range condition
 *
 * @class RangeCondition
 * @param subfilter
 * @param condition
 */
class RangeCondition {
  constructor(subfilter, condition) {
    this.subfilters = new Set([subfilter]);
    this.not = condition.keyword === 'notrange';

    /*
     Initializes lower and upper bounds depending on condition arguments
     As the interval tree library used only considers inclusive boundaries,
     we need to add or substract an epsilon value to provided arguments
     for lt and gt options.
     */
    this.low = -Infinity;
    this.high = Infinity;

    const field = Object.keys(condition.value)[0];
    const args = condition.value[field];

    for (const key of Object.keys(args)) {
      if (key === 'gt' || key === 'gte') {
        this.low = args[key];

        if (this.not && key === 'gte') {
          this.low -= 1e-10;
        } else if (!this.not && key === 'gt') {
          this.low += 1e-10;
        }
      }

      if (key === 'lt' || key === 'lte') {
        this.high = args[key];

        if (this.not && key === 'lte') {
          this.high += 1e-10;
        } else if (!this.not && key === 'lt') {
          this.high -= 1e-10;
        }
      }
    }
  }
}

module.exports = { RangeCondition };
