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

const { OperandsStorage } = require('./storeOperands');
const OperandsRemoval = require('./removeOperands');
const Filter = require('./objects/filter');
const Subfilter = require('./objects/subfilter');
const Condition = require('./objects/condition');
const FieldOperand = require('./objects/fieldOperand');
const Matcher = require('./matcher');
const { hash } = require('../util/hash');

/**
 * Real-time engine
 *
 * @class Engine
 */
class Engine {
  constructor (config) {
    this.seed = config.seed;
    this.storeOperand = new OperandsStorage(config);
    this.removeOperand = new OperandsRemoval(config);
    this.matcher = new Matcher();

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
     */
    this.subfilters = new Map();

    /**
     * Conditions description
     * A condition is made of a Koncorde keyword, a document field name, and
     * the associated test values
     */
    this.conditions = new Map();

    /**
     * Contains field-operand pairs to be tested
     * A field-operand pair is a Koncorde keyword applied to a document field
     */
    this.foPairs = new Map();
  }

  /**
   * Remove a filter ID from the storage
   * Returns the number of indexed filters remaining.
   *
   * @param {string} filterId
   * @param {Number}
   */
  remove (filterId) {
    const filter = this.filters.get(filterId);

    if (!filter) {
      return;
    }

    for (const subfilter of filter.subfilters) {
      if (subfilter.filters.size === 1) {
        for (const condition of subfilter.conditions) {
          this.removeOperand[condition.keyword](
            this.foPairs,
            subfilter,
            condition);

          if (condition.subfilters.size === 1) {
            this.conditions.delete(condition.id);
          }
          else {
            condition.subfilters.delete(subfilter);
          }
        }

        this.subfilters.delete(subfilter.id);
      }
      else {
        subfilter.filters.delete(filter);
      }
    }

    this.filters.delete(filterId);

    return this.filters.size;
  }

  /**
   * Decomposes and stores a normalized filter
   *
   * @param {NormalizedFilter} normalized
   */
  store (normalized) {
    if (this.filters.has(normalized.id)) {
      return;
    }

    const filter = new Filter(normalized.id, normalized.filter);
    this.filters.set(normalized.id, filter);

    for(let i = 0; i < normalized.filter.length; i++) {
      const sf = normalized.filter[i];
      const sfResult = this._addSubfilter(filter, sf);

      if (sfResult.created) {
        const subfilter = this.subfilters.get(sfResult.id);
        const addedConditions = this._addConditions(subfilter, sf);

        for(let j = 0; j < addedConditions.length; j++) {
          const cond = addedConditions[j];
          let operand = this.foPairs.get(cond.keyword);

          if (!operand) {
            operand = new FieldOperand();
            this.foPairs.set(cond.keyword, operand);
          }

          this.storeOperand[cond.keyword](operand, subfilter, cond);
        }
      }
    }
  }

  /**
   * Forward data matching to the embedded matcher
   *
   * @param  {Object} data
   * @return {Array.<String>}
   */
  match (data) {
    return this.matcher.match(this.foPairs, data);
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
   * @return {{created: Boolean, id: String}}
   */
  _addSubfilter (filter, subfilter) {
    const sfId = hash(this.seed, subfilter);
    const sfRef = this.subfilters.get(sfId);
    let created = true;

    if (sfRef) {
      created = false;
      sfRef.filters.add(filter);
      filter.subfilters.add(sfRef);
    }
    else {
      const sfObj = new Subfilter(sfId, filter);
      this.subfilters.set(sfId, sfObj);
      filter.subfilters.add(sfObj);
    }

    return { created, id: sfId };
  }

  /**
   * Adds conditions registered in a subfilter to the conditions
   * structure, and link them to the corresponding subfilter structure
   *
   * Returns the list of created conditions
   *
   * @param {object} subfilter - link to the corresponding subfilter in the
   *                             subfilters structure
   * @param {Array} conditions - array of conditions
   * @return {Array}
   */
  _addConditions (subfilter, conditions) {
    const diff = [];

    for(let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      const cId = hash(this.seed, cond);
      const condLink = this.conditions.get(cId);

      if (condLink) {
        if (!condLink.subfilters.has(subfilter)) {
          condLink.subfilters.add(subfilter);
          subfilter.conditions.add(condLink);
          diff.push(condLink);
        }
      }
      else {
        const keyword = Object.keys(cond).filter(k => k !== 'not')[0];
        const condObj = new Condition(
          cId,
          subfilter,
          cond.not ? 'not' + keyword : keyword,
          cond[keyword]);

        this.conditions.set(cId, condObj);
        subfilter.conditions.add(condObj);
        diff.push(condObj);
      }
    }

    return diff;
  }
}

module.exports = { Engine };
