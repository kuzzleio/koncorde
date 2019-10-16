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

/**
 * Exposes a sets of methods meant to store operands in
 * the DSL keyword-specific part of a field-operand  object
 *
 * All provided <f,o> pair object references must point to
 * the root of the structure. This allows cleaning up the
 * entire object when removing conditions
 *
 * @class OperandsRemoval
 */
class OperandsRemoval {
  /**
   * Removes an empty filter from the structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   */
  everything(foPairs, index, collection) {
    foPairs.remove(index, collection, 'everything');
  }

  /**
   * Removes a "equals" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   */
  equals(foPairs, index, collection, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName],
      operand = foPairs.get(index, collection, 'equals'),
      entries = operand.fields[fieldName].get(value);

    if (entries && entries.size > 1) {
      entries.delete(subfilter);
    }
    else if (operand.fields[fieldName].size > 1) {
      operand.fields[fieldName].delete(value);
    }
    else if (operand.keys.size > 1) {
      operand.keys.delete(fieldName);
      delete operand.fields[fieldName];
    }
    else {
      foPairs.remove(index, collection, 'equals');
    }
  }

  /**
   * Removes a "not equals" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   */
  notequals(foPairs, index, collection, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName],
      operand = foPairs.get(index, collection, 'notequals'),
      entries = operand.fields[fieldName].get(value);

    if (entries && entries.size > 1) {
      entries.delete(subfilter);
    }
    else if (operand.fields[fieldName].size > 1) {
      operand.fields[fieldName].delete(value);
    }
    else if (operand.keys.size > 1) {
      operand.keys.delete(fieldName);
      delete operand.fields[fieldName];
    }
    else {
      foPairs.remove(index, collection, 'notequals');
    }
  }

  /**
   * Removes a "exists" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   * @param {string} [keyword]
   */
  exists(foPairs, index, collection, subfilter, condition, keyword = 'exists') {
    const
      {path, value, array} = condition.value,
      operand = foPairs.get(index, collection, keyword);

    if (!array) {
      operand.fields[path].subfilters.delete(subfilter);
    } else {
      const entries = operand.fields[path].values.get(value);

      if (entries.size > 1) {
        entries.delete(subfilter);
      } else {
        operand.fields[path].values.delete(value);
      }
    }

    if ( operand.fields[path].subfilters.size === 0
      && operand.fields[path].values.size === 0
    ) {
      if (operand.keys.size > 1) {
        operand.keys.delete(path);
        delete operand.fields[path];
      } else {
        foPairs.remove(index, collection, keyword);
      }
    }
  }

  /**
   * Removes a "not exists" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   */
  notexists(foPairs, index, collection, subfilter, condition) {
    this.exists(foPairs, index, collection, subfilter, condition, 'notexists');
  }

  /**
   * Removes a "nothing" keyword from the field-operand structure
   *
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   */
  nothing(foPairs, index, collection) {
    foPairs.remove(index, collection, 'nothing');
  }

  /**
   * Removes a "range" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   */
  range(foPairs, index, collection, subfilter, condition) {
    const
      operand = foPairs.get(index, collection, 'range'),
      field = Object.keys(condition.value)[0],
      rangeCondition = operand.fields[field].conditions.get(condition.id);

    if (operand.fields[field].conditions.size > 1 || rangeCondition.subfilters.size > 1) {
      if (rangeCondition.subfilters.size > 1) {
        rangeCondition.subfilters.delete(subfilter);
      } else {
        operand.fields[field].tree.remove(rangeCondition.low, rangeCondition.high, rangeCondition);
        operand.fields[field].conditions.delete(condition.id);
      }
    } else if (operand.keys.size > 1) {
      operand.keys.delete(field);
      delete operand.fields[field];
    } else {
      foPairs.remove(index, collection, 'range');
    }
  }

  /**
   * Removes a "not range" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   */
  notrange(foPairs, index, collection, subfilter, condition) {
    const
      operand = foPairs.get(index, collection, 'notrange'),
      field = Object.keys(condition.value)[0],
      rangeCondition = operand.fields[field].conditions.get(condition.id);

    if ( operand.fields[field].conditions.size > 1
      || rangeCondition.subfilters.size > 1
    ) {
      if (rangeCondition.subfilters.size > 1) {
        rangeCondition.subfilters.delete(subfilter);
      }
      else {
        if (rangeCondition.low !== -Infinity) {
          operand.fields[field].tree.remove(
            -Infinity,
            rangeCondition.low,
            rangeCondition);
        }

        if (rangeCondition.high !== Infinity) {
          operand.fields[field].tree.remove(
            rangeCondition.high,
            Infinity,
            rangeCondition);
        }

        operand.fields[field].conditions.delete(condition.id);
      }
    }
    else if (operand.keys.size > 1) {
      operand.keys.delete(field);
      delete operand.fields[field];
    }
    else {
      foPairs.remove(index, collection, 'notrange');
    }
  }

  /**
   * Removes a "regexp" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   * @param {string} [keyword]
   */
  regexp(foPairs, index, collection, subfilter, condition, keyword = 'regexp') {
    const
      fieldName = Object.keys(condition.value)[0],
      stringValue = (new RegExp(condition.value[fieldName].value, condition.value[fieldName].flags)).toString(),
      operand = foPairs.get(index, collection, keyword),
      regexpCondition = operand.fields[fieldName].get(stringValue);

    if (regexpCondition.subfilters.size > 1) {
      regexpCondition.subfilters.delete(subfilter);
    }
    else if (operand.fields[fieldName].size > 1) {
      operand.fields[fieldName].delete(stringValue);
    }
    else if (operand.keys.size > 1) {
      operand.keys.delete(fieldName);
      delete operand.fields[fieldName];
    }
    else {
      foPairs.remove(index, collection, keyword);
    }
  }

  /**
   * Removes a "not regexp" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   */
  notregexp(foPairs, index, collection, subfilter, condition) {
    this.regexp(foPairs, index, collection, subfilter, condition, 'notregexp');
  }

  /**
   * Removes a "geospatial" value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   */
  geospatial(foPairs, index, collection, subfilter, condition, keyword = 'geospatial') {
    const
      operand = foPairs.get(index, collection, keyword),
      geotype = Object.keys(condition.value)[0],
      fieldName = Object.keys(condition.value[geotype])[0];

    const subfilters = operand.fields[fieldName].get(condition.id);

    if (subfilters.size > 1) {
      subfilters.delete(subfilter);
    }
    else if (operand.fields[fieldName].size > 1) {
      operand.fields[fieldName].delete(condition.id);
      operand.custom.index.remove(condition.id);
    }
    else if (operand.keys.size > 1) {
      delete operand.fields[fieldName];
      operand.keys.delete(fieldName);
      operand.custom.index.remove(condition.id);
    }
    else {
      foPairs.remove(index, collection, keyword);
    }
  }

  /**
   * Removes a "not geospatial " value from the field-operand structure
   *
   * The condition
   * @param {CacheStorage} foPairs
   * @param {string} index
   * @param {string} collection
   * @param {object} subfilter
   * @param {object} condition
   */
  notgeospatial(foPairs, index, collection, subfilter, condition) {
    this.geospatial(
      foPairs,
      index,
      collection,
      subfilter,
      condition,
      'notgeospatial');
  }
}

module.exports = OperandsRemoval;
