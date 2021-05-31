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
// add support for ES6 modules ("import ... from ...")
require('reify');

const crypto = require('crypto');

const Transformer = require('./transform');
const Engine = require('./engine');
const convertDistance = require('./util/convertDistance');
const convertGeopoint = require('./util/convertGeopoint');
const hash = require('./util/hash');

class NormalizedFilter {
  constructor (normalized, id, index) {
    this.filter = normalized;
    this.id = id;
    this.index = index;
  }
}

class Koncorde {

  /**
   * @param {Object} config   */
  constructor (config) {
    if (config && (typeof config !== 'object' || Array.isArray(config))) {
      throw new Error('Invalid argument: expected an object');
    }

    this.config = Object.assign({
      maxMinTerms: 256,
      regExpEngine: 're2',
    }, config);

    this.config.seed = this.config.seed || crypto.randomBytes(32);

    if (this.config.regExpEngine !== 're2' && this.config.regExpEngine !== 'js') {
      throw new Error('Invalid configuration value for "regExpEngine". Supported: re2, js');
    }

    if (!(this.config.seed instanceof Buffer) || this.config.seed.length !== 32) {
      throw new Error('Invalid seed: expected a 32 bytes long Buffer');
    }

    this.transformer = new Transformer(this.config);

    // Indexed engines: the default index is mapped to the null key
    this.engines = new Map([[null, new Engine(this.config)]]);
  }

  /**
   * Checks if the provided filter is valid
   *
   * @param {object} filter
   * @return {Object}
   */
  validate (filter) {
    return this.transformer.check(filter);
  }

  /**
   * Subscribes an unoptimized filter to the real-time engine.
   * Identical to a call to normalize() + store()
   *
   * Returns the filter unique identifier
   *
   * @param {Object} filter
   * @param {String} [index] - Index name
   * @return {String}
   */
  register (filter, index = null) {
    const normalized = this.normalize(filter, index);
    return this.store(normalized);
  }

  /**
   * Returns an optimized version of the provided filter, with
   * its associated filter unique ID.
   * Does not store anything in the filters structures.
   * The returned object can either be used with store(), or discarded.
   *
   * @param  {Object} filter
   * @param  {String} [index] name
   * @return {{id: String, index: String, normalized: Object}}
   */
  normalize(filter, index = null) {
    if (index !== null && typeof index !== 'string') {
      throw new Error('Invalid "index" argument: must be a string');
    }

    const normalized = this.transformer.normalize(filter);
    const id = hash(this.config.seed, { filter: normalized, index });

    return new NormalizedFilter(normalized, id, index);
  }

  /**
   * Stores a normalized filter.
   * A normalized filter is obtained using a call to normalize()
   *
   * Returns the filter unique identifer
   *
   * @param  {NormalizedFilter} normalized - Obtained with a call to normalize()
   * @return {String}
   */
  store (normalized) {
    if (!(normalized instanceof NormalizedFilter)) {
      throw new Error('Invalid argument: not a normalized filter (use Koncorde.normalize to get one)');
    }

    let engine = this.engines.get(normalized.index);

    if (!engine) {
      engine = new Engine(this.config);
      this.engines.set(normalized.index, engine);
    }

    engine.store(normalized);

    return normalized.id;
  }

  /**
   * Returns all indexed filter IDs
   *
   * @param {String} [index] name
   * @returns {Array.<String>} Array of matching filter IDs
   */
  getFilterIds (index = null) {
    const engine = this.engines.get(index);

    if (!engine) {
      return [];
    }

    return Array.from(engine.filters.keys());
  }

  /**
   * Returns the list of named indexes
   *
   * @return {Array.<String>}
   */
  getIndexes () {
    return Array.from(this.engines.keys()).map(i => i || '(default)');
  }

  /**
   * Check if a filter identifier is known by Koncorde
   *
   * @param {String} filterId
   * @param {String} [index] name
   * @returns {Boolean}
   */
  hasFilterId (filterId, index = null) {
    const engine = this.engines.get(index);

    return engine && engine.filters.has(filterId);
  }

  /**
   * Test data against filters in the filters tree to get the matching
   * filters ID, if any
   *
   * @param {Object} data to test filters on
   * @param {String} [index] name
   * @return {Array} list of matching filters
   */
  test (data, index = null) {
    const engine = this.engines.get(index);

    if (!engine) {
      return [];
    }

    return engine.match(flattenObject(data));
  }

  /**
   * Removes all references to a given filter from the real-time engine
   *
   * @param {String} filterId - ID of the filter to remove
   * @param {String} [index] name
   */
  remove (filterId, index = null) {
    const engine = this.engines.get(index);

    if (!engine) {
      return;
    }

    const remaining = engine.remove(filterId);

    if (index && remaining === 0) {
      this.engines.delete(index);
    }
  }

  /**
   * Converts a distance string value to a number of meters
   * @param {string} distance - client-provided distance
   * @returns {number} converted distance
   */
  static convertDistance(distance) {
    return convertDistance(distance);
  }

  /**
   * Converts one of the accepted geopoint format into
   * a standardized version
   *
   * @param {object} obj - object containing a geopoint
   * @returns {Coordinate} or null if no accepted format is found
   */
  static convertGeopoint(point) {
    return convertGeopoint(point);
  }
}

/**
 * Flatten an object transform:
 * {
 *  title: "kuzzle",
 *  info : {
 *    tag: "news"
 *  }
 * }
 *
 * Into an object like:
 * {
 *  title: "kuzzle",
 *  info.tag: news
 * }
 *
 * @param {object} target the object we have to flatten
 * @returns {object} the flattened object
 */
function flattenObject(target) {
  const output = {};

  flattenStep(output, target);

  return output;
}

function flattenStep(output, object, prev) {
  const keys = Object.keys(object);

  for(let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = object[key];
    const newKey = prev ? prev + '.' + key : key;

    if (Object.prototype.toString.call(value) === '[object Object]') {
      output[newKey] = value;
      flattenStep(output, value, newKey);
    }

    output[newKey] = value;
  }
}

/**
 * @type {Koncorde}
 */
module.exports = Koncorde;
