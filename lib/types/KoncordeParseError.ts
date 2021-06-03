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
 * Dedicated Error class for filter parsing errors.
 * Contains additional fields helping automatizing what went wrong and where
 * when complex filters are rejected by Koncorde.
 */
export class KoncordeParseError extends Error {
  /**
   * The faulty keyword that triggered the error
   * @type {string}
   */
  public keyword: string;

  /**
   * The filter path where the error was found
   * @type {string}
   */
  public path: string;

  constructor (message: string, keyword: string, path: string) {
    if (path) {
      super(`"${path}": ${message}`);
    }
    else {
      super(message);
    }

    this.keyword = keyword;
    this.path = path;
  }
}

