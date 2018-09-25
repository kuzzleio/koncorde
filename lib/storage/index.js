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

const
  crypto = require('crypto'),
  murmur = require('murmurhash-native').murmurHash128,
  stringify = require('json-stable-stringify'),
  OperandsStorage = require('./storeOperands'),
  OperandsRemoval = require('./removeOperands'),
  Filter = require('./objects/filter'),
  Subfilter = require('./objects/subfilter'),
  Condition = require('./objects/condition'),
  FieldOperand = require('./objects/fieldOperand'),
  containsOne = require('../util/containsOne');

/**
 * Real-time engine filters storage
 *
 * @class Storage
 * @param {Buffer} seed Hash seed
 */
class Storage {
  constructor (seed = null) {
    this.storeOperand = new OperandsStorage();
    this.removeOperand = new OperandsRemoval();
    this.seed = seed || crypto.randomBytes(32);

    /**
     * Index/Collection => filters link table
     *
     * @type {object}
     *
     * @example
     *  {
     *    index: {
     *      collection: Set(<filter Ids>)
     *    }
     *  }
     */
    this.filtersIndex = {};

    /**
     * Filter => Subfilter link table
     * A filter is made of subfilters. Each subfilter is to be tested
     * against OR operands, meaning if at least 1 subfilter matches, the
     * whole filter matches.
     *
     * @type {Map.<filter ID, Filter>}
     */
    this.filters = new Map();

    /**
     * Subfilters link table
     *
     * A subfilter is a set of conditions to be tested against
     * AND operands. If at least 1 condition returns false, then
     * the whole subfilter is false.
     *
     * @type {object}
     *
     * @example
     *  {
     *    index: {
     *      collection: Map.<string, Subfilter>
     *    }
     *  }
     */
    this.subfilters = {};

    /**
     * Conditions description
     * A condition is made of a DSL keyword, a document field name, and
     * the associated test values
     *
     * @type {object}
     *
     * @example
     *  {
     *    index: {
     *      collection: Map.<string, Condition>
     *    }
     *  }
     */
    this.conditions = {};

    /**
     * Contains field-operand pairs to be tested
     * A field-operand pair is a DSL keyword applied to a document field
     *
     * @type {object}
     *
     * @example
     *  {
     *    index: {
     *      collection: Map<operandName, <operand specific storage>>
     *    }
     *  }
     */
    this.foPairs = {};
  }

  /**
   * Returns the filter id calculated from its components
   * @param  {String} index      Data index
   * @param  {String} collection Data collection
   * @param  {Object} filters    Normalized filters
   * @return {String}            Filter unique ID
   */
  getFilterId (index, collection, filters) {
    return this.hash({index, collection, filters});
  }

  hash (input) {
    let inString;

    switch (typeof input) {
      case 'string':
      case 'number':
      case 'boolean':
        inString = input;
        break;
      default:
        inString = stringify(input);
    }

    return murmur(Buffer.from(inString), 'hex', this.seed);
  }

  /**
   * Remove a filter ID from the storage
   * @param {string} filterId
   */
  remove (filterId) {
    const filter = this.filters.get(filterId);

    if (!filter) {
      return;
    }

    const {index, collection} = filter;

    for (const subfilter of filter.subfilters) {
      if (subfilter.filters.size === 1) {
        for (const condition of subfilter.conditions) {
          this.removeOperand[condition.keyword](this.foPairs, index, collection, subfilter, condition);

          if (condition.subfilters.size === 1) {
            Storage.destroy(this.conditions, index, collection, condition.id);
          } else {
            condition.subfilters.delete(subfilter);
          }
        }

        Storage.destroy(this.subfilters, index, collection, subfilter.id);
      }
      else {
        subfilter.filters.delete(filter);
      }
    }

    if (this.filtersIndex[index][collection].size === 1) {
      if (containsOne(this.filtersIndex[index])) {
        delete this.filtersIndex[index];
      }
      else {
        delete this.filtersIndex[index][collection];
      }
    }
    else {
      this.filtersIndex[index][collection].delete(filterId);
    }

    this.filters.delete(filterId);
  }

  /**
   * Decomposes and stores a normalized filter
   *
   * @param {string} index
   * @param {string} collection
   * @param {Array} filters
   * @param {String} [filterId] Optional: may be computed beforehand with getFilterId
   * @return {object}
   */
  store (index, collection, filters, filterId = null) {
    const
      result = this._addFilter(index, collection, filters, filterId),
      response = {
        id: result.id,
        diff: {
          index,
          collection,
          filters
        }
      };

    if (!result.created) {
      return response;
    }

    this._addFiltersIndex(index, collection, result.id);

    let i; // NOSONAR

    for(i = 0; i < filters.length; i++) {
      const
        sf = filters[i],
        sfResult = this._addSubfilter(this.filters.get(result.id), sf);

      if (sfResult.created) {
        const
          subfilter = this.subfilters[index][collection].get(sfResult.id),
          addedConditions = this._addConditions(subfilter, index, collection, sf);

        // this._addTestTables(subfilter, index, collection);
        Storage.addIndexCollectionToObject(this.foPairs, index, collection);

        let j; // NOSONAR
        for(j = 0; j < addedConditions.length; j++) {
          const cond = addedConditions[j];

          if (!this.foPairs[index][collection].has(cond.keyword)) {
            this.foPairs[index][collection].set(cond.keyword, new FieldOperand());
          }

          this.storeOperand[cond.keyword](this.foPairs[index][collection].get(cond.keyword), subfilter, cond);
        }
      }
    }

    return response;
  }

  /**
   * Adds a filter ID to the index/collection filter references
   *
   * @param {string} index
   * @param {string} collection
   * @param {string} id
   */
  _addFiltersIndex (index, collection, id) {
    if (!this.filtersIndex[index]) {
      this.filtersIndex[index] = {[collection]: new Set([id])};
    } else if (!this.filtersIndex[index][collection]) {
      this.filtersIndex[index][collection] = new Set([id]);
    } else {
      this.filtersIndex[index][collection].add(id);
    }
  }

  /**
   * Add a filter to the filters structure.
   * Returns a boolean indicating if the insertion was successful,
   * or, if false, indicating that the filter was already registered
   *
   * @param {string} index
   * @param {string} collection
   * @param {object} filters
   * @param {string} [filterId] Filter unique identifier
   * @return {object} containing a "created" boolean flag and the filter id
   */
  _addFilter (index, collection, filters, filterId = null) {
    const
      id = filterId || this.getFilterId(index, collection, filters),
      created = !this.filters.has(id);

    if (created) {
      this.filters.set(id, new Filter(id, index, collection, filters));
    }

    return {created, id};
  }

  /**
   * Adds a subfilter to the subfilters structure.
   * Link it to the corresponding filter
   *
   * Return value contains the "created" boolean indicating
   * if the subfilter has been created or updated.
   * If false, nothing changed.
   *
   * @param {Array} subfilter
   * @return {object}
   */
  _addSubfilter (filter, subfilter) {
    const sfId = this.hash(subfilter);
    let created = true;

    Storage.addIndexCollectionToObject(this.subfilters, filter.index, filter.collection);

    const sfRef = this.subfilters[filter.index][filter.collection].get(sfId);
    if (sfRef) {
      created = false;
      sfRef.filters.add(filter);
      filter.subfilters.add(sfRef);
    }
    else {
      const sfObj = new Subfilter(sfId, filter);
      this.subfilters[filter.index][filter.collection].set(sfId, sfObj);
      filter.subfilters.add(sfObj);
    }

    return {created, id: sfId};
  }

  /**
   * Adds conditions registered in a subfilter to the conditions
   * structure, and link them to the corresponding subfilter structure
   *
   * Returns the list of created conditions
   *
   * @param {object} subfilter - link to the corresponding subfilter in the
   *                             subfilters structure
   * @param {string} index
   * @param {string} collection
   * @param {Array} conditions - array of conditions
   * @return {Array}
   */
  _addConditions (subfilter, index, collection, conditions) {
    const diff = [];

    Storage.addIndexCollectionToObject(this.conditions, index, collection);

    // Declaring "i" inside the "for" statement downgrades
    // performances by a factor of 3 to 4
    // Should be fixed in later V8 versions
    // (tested on Node 6.9.x)
    let i; // NOSONAR

    for(i = 0; i < conditions.length; i++) {
      const
        cond = conditions[i],
        cId = this.hash(cond),
        condLink = this.conditions[index][collection].get(cId);

      if (condLink) {
        if (!condLink.subfilters.has(subfilter)) {
          condLink.subfilters.add(subfilter);
          subfilter.conditions.add(condLink);
          diff.push(condLink);
        }
      }
      else {
        const
          keyword = Object.keys(cond).filter(k => k !== 'not')[0],
          condObj = new Condition(cId, subfilter, cond.not ? 'not' + keyword : keyword, cond[keyword]);

        this.conditions[index][collection].set(cId, condObj);
        subfilter.conditions.add(condObj);
        diff.push(condObj);
      }
    }

    return diff;
  }

  /**
   * Many storage objects separate data by index and collection.
   * This function avoids repetition of code by initializing an
   * object with an index and collection
   *
   * @param {object} obj - object to update
   * @param {string} index
   * @param {string} collection
   */
  static addIndexCollectionToObject (obj, index, collection) {
    if (!obj[index]) {
      obj[index] = { [collection]: new Map() };
    }
    else if (!obj[index][collection]) {
      obj[index][collection] = new Map();
    }
  }

  /**
   * Removes a field from an object. If the collection containing it
   * is empty after the removal, this function deletes it too.
   * Same goes for the index.
   *
   * @param {object} obj - object containing the field to remove
   * @param {string} index
   * @param {string} collection
   * @param {string} field
   */
  static destroy (obj, index, collection, field) {
    if (obj[index][collection].size === 1) {
      if (containsOne(obj[index])) {
        delete obj[index];
      }
      else {
        delete obj[index][collection];
      }
    }
    else {
      obj[index][collection].delete(field);
    }
  }
}

module.exports = Storage;
