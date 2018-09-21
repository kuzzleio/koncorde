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

// add support for ES6 modules ("import ... from ...")
require('reify');

const
  Transformer = require('./transform'),
  Storage = require('./storage'),
  Matcher = require('./match'),
  convertDistance = require('./util/convertDistance'),
  convertGeopoint = require('./util/convertGeopoint');

class Koncorde {

  /**
   * @param {Object} config
   */
  constructor(config) {
    if (config && (typeof config !== 'object' || Array.isArray(config))) {
      throw new Error('Invalid argument: expected an object');
    }

    this.config = Object.assign({
      seed: Buffer.from('o%dWl&F@%*Sr$7i18x3@@&uXQOC$X8az'),
      maxMinTerms: 256
    }, config || {});

    if (!(this.config.seed instanceof Buffer) || this.config.seed.length !== 32) {
      throw new Error('Invalid seed: expected a 32 bytes long Buffer');
    }

    this.transformer = new Transformer(this.config);
    this.storage = new Storage(this.config.seed);
    this.matcher = new Matcher(this.storage);
  }

  /**
   * Checks if the provided filter is valid
   *
   * @param {object} filter
   * @return {Promise<Object>}
   */
  validate(filter) {
    return this.transformer.check(filter);
  }

  /**
   * Subscribes an unoptimized filter to the real-time engine.
   * Identical to a call to normalize() + store()
   *
   * @param {string} index
   * @param {string} collection
   * @param {object} filters
   * @return {Promise}
   */
  register(index, collection, filter) {
    return this.transformer.normalize(filter)
      .then(normalized => this.storage.store(index, collection, normalized));
  }

  /**
   * Returns an optimized version of the provided filter, with
   * its associated filter unique ID.
   * Does not store anything in the DSL structures
   * The returned object can either be used with store(), or discarded.
   *
   * @param  {string} index      index
   * @param  {[type]} collection collection
   * @param  {[type]} filter     filter
   * @return {Promise.<{index: String, collection: String, id: String, normalized: Object}>}
   */
  normalize(index, collection, filter) {
    return this.transformer.normalize(filter)
      .then(normalized => ({
        index,
        collection,
        normalized,
        id: this.storage.getFilterId(index, collection, normalized)
      }));
  }

  /**
   * Stores a normalized filter into this DSL structures.
   * A normalized filter is obtained using a call to normalize()
   *
   * @param  {Object} normalized Obtained with a call to normalize()
   * @return {{diff: Object, id: String}}
   */
  store(normalized) {
    return this.storage.store(normalized.index, normalized.collection, normalized.normalized, normalized.id);
  }

  /**
   * Check if there are filters registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {boolean}
   */
  exists(index, collection) {
    return this.storage.filtersIndex[index] !== undefined && this.storage.filtersIndex[index][collection] !== undefined;
  }

  /**
   * Returns all filters IDs registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {Array} Array of matching filter IDs
   */
  getFilterIds(index, collection) {
    return this.exists(index, collection) ? Array.from(this.storage.filtersIndex[index][collection]) : [];
  }

  /**
   * Test data against filters in the filters tree to get the matching
   * filters ID, if any
   *
   * @param {string} index - the index on which the data apply
   * @param {string} collection - the collection on which the data apply
   * @param {object} data to test filters on
   * @param {string} [documentId] - if the data refers to a document, the document unique ID
   * @return {Array} list of matching filters
   */
  test(index, collection, data, documentId) {
    if (this.exists(index, collection)) {
      return this.matcher.match(index, collection, flattenObject(data, documentId));
    }

    return [];
  }

  /**
   * Removes all references to a given filter from the real-time engine
   *
   * @param {string} filterId - ID of the filter to remove
   */
  remove(filterId) {
    return this.storage.remove(filterId);
  }

  /**
   * Converts a distance string value to a number of meters
   * @param {string} distance - client-provided distance
   * @returns {number} resolves to converted distance
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
 * @param {string} [id] of the document, if relevant
 * @returns {object} the flattened object
 */
function flattenObject(target, id) {
  const output = {};

  if (id) {
    output._id = id;
  }

  flattenStep(output, target);

  return output;
}

function flattenStep(output, object, prev) {
  const keys = Object.keys(object);
  let i; // NOSONAR

  for(i = 0; i < keys.length; i++) {
    const
      key = keys[i],
      value = object[key],
      newKey = prev ? prev + '.' + key : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
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
