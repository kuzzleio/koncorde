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

const { RegExpCondition } = require('./objects/regexpCondition');

/**
 * Exposes a sets of methods meant to store operands in
 * the Koncorde keyword-specific part of a field-operand  object
 *
 * All provided <f,o> pair object references must point to
 * the root of the structure. This allows cleaning up the
 * entire object when removing conditions
 *
 * @class OperandsRemoval
 */
class OperandsRemoval {
  constructor(config) {
    this.config = config;
  }

  /**
   * Removes an empty filter from the structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   */
  everything(foPairs) {
    foPairs.delete('everything');
  }

  /**
   * Removes a "equals" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  equals(foPairs, subfilter, condition) {
    const fieldName = Object.keys(condition.value)[0];
    const value = condition.value[fieldName];
    const operand = foPairs.get('equals');
    const field = operand.fields.get(fieldName);
    const entries = field.get(value);

    if (entries && entries.size > 1) {
      entries.delete(subfilter);
    }
    else if (field.size > 1) {
      field.delete(value);
    }
    else if (operand.fields.size > 1) {
      operand.fields.delete(fieldName);
    }
    else {
      foPairs.delete('equals');
    }
  }

  /**
   * Removes a "not equals" value from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notequals(foPairs, subfilter, condition) {
    const fieldName = Object.keys(condition.value)[0];
    const value = condition.value[fieldName];
    const operand = foPairs.get('notequals');
    const field = operand.fields.get(fieldName);
    const entries = field.get(value);

    if (entries && entries.size > 1) {
      entries.delete(subfilter);
    }
    else if (field.size > 1) {
      field.delete(value);
    }
    else if (operand.fields.size > 1) {
      operand.fields.delete(fieldName);
    }
    else {
      foPairs.delete('notequals');
    }
  }

  /**
   * Removes a "select" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  select(foPairs, subfilter, condition) {
    const fieldName = condition.value.field;
    const index = condition.value.index;

    const operand = foPairs.get('select');
    const field = operand.fields.get(fieldName);
    const indexEngine = field.get(index);

    if (indexEngine) {
      for (const [filterId, filters] of indexEngine.filters) {
        const subfilterIndex = filters.findIndex((f) => f.id === subfilter.id);

        if (subfilterIndex !== -1) {
          filters.splice(subfilterIndex, 1);

          
          if (filters.length === 0) {
            indexEngine.filters.delete(filterId);
            indexEngine.engine.remove(filterId);
          }

          break;
        }
      }

      if (indexEngine.filters.size === 0) {
        field.delete(index);
      }

      if (field.size === 0) {
        operand.fields.delete(fieldName);
      }

      if (operand.fields.size === 0) {
        foPairs.delete('select');
      }
    }
  }

  /**
   * Removes a "match" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  match(foPairs, subfilter) {
    const operand = foPairs.get('match');
    const entries = operand.custom.filters;

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].subfilter === subfilter) {
        entries.splice(i, 1);
        break;
      }
    }

    if (entries.length === 0) {
      foPairs.delete('match');
    }
  }

  /**
   * Removes a "notmatch" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notmatch(foPairs, subfilter) {
    const operand = foPairs.get('notmatch');
    const entries = operand.custom.filters;

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].subfilter === subfilter) {
        entries.splice(i, 1);
        break;
      }
    }

    if (entries.length === 0) {
      foPairs.delete('notmatch');
    }
  }

  /**
   * Removes a "exists" value from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   * @param {string} [keyword]
   */
  exists(foPairs, subfilter, condition, keyword = 'exists') {
    const { path, value, array } = condition.value;
    const operand = foPairs.get(keyword);
    const field = operand.fields.get(path);

    if (!array) {
      field.subfilters.delete(subfilter);
    }
    else {
      const entries = field.values.get(value);

      if (entries.size > 1) {
        entries.delete(subfilter);
      }
      else {
        field.values.delete(value);
      }
    }

    if (field.subfilters.size === 0 && field.values.size === 0) {
      if (operand.fields.size > 1) {
        operand.fields.delete(path);
      }
      else {
        foPairs.delete(keyword);
      }
    }
  }

  /**
   * Removes a "not exists" value from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notexists(foPairs, subfilter, condition) {
    this.exists(foPairs, subfilter, condition, 'notexists');
  }

  /**
   * Removes a "nothing" keyword from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   */
  nothing(foPairs) {
    foPairs.delete('nothing');
  }

  /**
   * Removes a "range" value from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  range(foPairs, subfilter, condition) {
    const operand = foPairs.get('range');
    const fieldName = Object.keys(condition.value)[0];
    const field = operand.fields.get(fieldName);
    const rangeCondition = field.conditions.get(condition.id);

    if (field.conditions.size > 1 || rangeCondition.subfilters.size > 1) {
      if (rangeCondition.subfilters.size > 1) {
        rangeCondition.subfilters.delete(subfilter);
      }
      else {
        field.tree.remove(
          [rangeCondition.low, rangeCondition.high],
          rangeCondition);
        field.conditions.delete(condition.id);
      }
    }
    else if (operand.fields.size > 1) {
      operand.fields.delete(fieldName);
    }
    else {
      foPairs.delete('range');
    }
  }

  /**
   * Removes a "not range" value from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notrange(foPairs, subfilter, condition) {
    const operand = foPairs.get('notrange');
    const fieldName = Object.keys(condition.value)[0];
    const field = operand.fields.get(fieldName);
    const rangeCondition = field.conditions.get(condition.id);

    if (field.conditions.size > 1 || rangeCondition.subfilters.size > 1) {
      if (rangeCondition.subfilters.size > 1) {
        rangeCondition.subfilters.delete(subfilter);
      }
      else {
        if (rangeCondition.low !== -Infinity) {
          field.tree.remove([-Infinity, rangeCondition.low], rangeCondition);
        }

        if (rangeCondition.high !== Infinity) {
          field.tree.remove([rangeCondition.high, Infinity], rangeCondition);
        }

        field.conditions.delete(condition.id);
      }
    }
    else if (operand.fields.size > 1) {
      operand.fields.delete(fieldName);
    }
    else {
      foPairs.delete('notrange');
    }
  }

  /**
   * Removes a "regexp" value from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   * @param {string} [keyword]
   */
  regexp(foPairs, subfilter, condition, keyword = 'regexp') {
    const fieldName = Object.keys(condition.value)[0];
    const reCondition = new RegExpCondition(
      this.config,
      condition.value[fieldName].value,
      null,
      condition.value[fieldName].flags);
    const stringValue = reCondition.stringValue;
    const operand = foPairs.get(keyword);
    const field = operand.fields.get(fieldName);
    const regexpCondition = field.get(stringValue);

    if (regexpCondition.subfilters.size > 1) {
      regexpCondition.subfilters.delete(subfilter);
    }
    else if (field.size > 1) {
      field.delete(stringValue);
    }
    else if (operand.fields.size > 1) {
      operand.fields.delete(fieldName);
    }
    else {
      foPairs.delete(keyword);
    }
  }

  /**
   * Removes a "not regexp" value from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notregexp(foPairs, subfilter, condition) {
    this.regexp(foPairs, subfilter, condition, 'notregexp');
  }

  /**
   * Removes a "geospatial" value from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  geospatial(foPairs, subfilter, condition, keyword = 'geospatial') {
    const operand = foPairs.get(keyword);
    const geotype = Object.keys(condition.value)[0];
    const fieldName = Object.keys(condition.value[geotype])[0];
    const field = operand.fields.get(fieldName);

    const subfilters = field.get(condition.id);

    if (subfilters.size > 1) {
      subfilters.delete(subfilter);
    }
    else if (field.size > 1) {
      field.delete(condition.id);
      operand.custom.index.remove(condition.id);
    }
    else if (operand.fields.size > 1) {
      operand.fields.delete(fieldName);
      operand.custom.index.remove(condition.id);
    }
    else {
      foPairs.delete(keyword);
    }
  }

  /**
   * Removes a "not geospatial " value from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notgeospatial(foPairs, subfilter, condition) {
    this.geospatial(
      foPairs,
      subfilter,
      condition,
      'notgeospatial');
  }
}

module.exports = OperandsRemoval;
