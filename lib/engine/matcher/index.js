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

const TestTables = require('./testTables');

/**
 * Matches documents or messages against stored subscriptions
 *
 * @class Matcher
 * @constructor
 */
class Matcher {
  constructor() {
    this.matchers = {
      equals:  require('./matchEquals'),
      everything:  require('./matchEverything'),
      exists:  require('./matchExists'),
      geospatial:  require('./matchGeospatial'),
      match:  require('./matchMatch').MatchMatch,
      notequals:  require('./matchNotEquals'),
      notexists:  require('./matchNotExists'),
      notgeospatial:  require('./matchNotGeospatial'),
      notmatch:  require('./matchNotMatch').MatchNotMatch,
      notrange:  require('./matchNotRange'),
      notregexp:  require('./matchNotRegexp'),
      range:  require('./matchRange'),
      regexp:  require('./matchRegexp'),
      select:  require('./matchSelect').MatchSelect,
    };
  }

  /**
   * Matches data against stored subscriptions
   *
   * @param {Map} foPairs
   * @param {Object} data
   * @return {Array}
   */
  match(foPairs, data) {
    const testTables = new TestTables();

    for (const [ key, operand ] of foPairs) {
      if (this.matchers[key]) {
        this.matchers[key](operand, testTables, data);
      }
    }

    return Object.keys(testTables.matched);
  }
}

module.exports = Matcher;
