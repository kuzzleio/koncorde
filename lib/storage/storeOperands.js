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

import IntervalTree from 'node-interval-tree';

const
  RegexpCondition = require('./objects/regexpCondition'),
  BoostSpatialIndex = require('boost-geospatial-index');

/**
 * Exposes a sets of methods meant to store operands in
 * the DSL keyword-specific part of a field-operand  object
 *
 * All provided <f,o> pair object references must point directly
 * to the right index/collection/keyword part of the structure
 *
 * @class OperandsStorage
 * */
class OperandsStorage {
  /**
   * Stores an empty filter in the <f,o> pairs structure
   * There can never be more than 1 filter and subfilter for an
   * all-matching filter, for an index/collection pair
   *
   * @param {object} foPairs
   * @param {object} subfilter
   */
  everything(foPairs, subfilter) {
    foPairs.fields.all = [subfilter];
  }

  /**
   * Stores a "equals" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  equals(foPairs, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName];
    let entries;

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.add(fieldName);
      foPairs.fields[fieldName] = new Map([[value, [subfilter]]]);
    } else if ((entries = foPairs.fields[fieldName].get(value)) === undefined) {
      foPairs.fields[fieldName].set(value, [subfilter]);
    } else {
      entries.push(subfilter);
    }
  }

  /**
   * Stores a "not equals" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notequals(foPairs, subfilter, condition) {
    this.equals(foPairs, subfilter, condition);
  }

  /**
   * Stores a "exists" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  exists(foPairs, subfilter, condition) {
    const {path, value} = condition.value;

    if (!foPairs.fields[path]) {
      foPairs.keys.add(path);
      foPairs.fields[path] = {
        subfilters: [],
        values: new Map()
      };
    }

    let entries;

    if (!condition.value.array) {
      foPairs.fields[path].subfilters.push(subfilter);
    } else if ((entries = foPairs.fields[path].values.get(value)) !== undefined) {
      entries.push(subfilter);
    } else {
      foPairs.fields[path].values.set(value, [subfilter]);
    }
  }

  /**
   * Stores a "not exists" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notexists(foPairs, subfilter, condition) {
    this.exists(foPairs, subfilter, condition);
  }

  nothing(foPairs, subfilter) {
    foPairs.fields.all = [subfilter];
  }

  /**
   * Stores a "range" condition into the field-operand structure
   *
   * Stores the range in interval trees for searches in O(log n + m)
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  range(foPairs, subfilter, condition) {
    const
      field = Object.keys(condition.value)[0],
      args = condition.value[field];
    let
      low = -Infinity,
      high = Infinity;

    /*
     Initializes low and high values depending on condition arguments
     As the interval tree library used only considers inclusive boundaries,
     we need to add or substract an epsilon value to provided arguments
     for lt and gt options.
     */
    const keys = Object.keys(args);
    let i; // NOSONAR

    for(i = 0; i < keys.length; i++) {
      const a = keys[i];

      if (['gt', 'gte'].indexOf(a) !== -1) {
        low = a === 'gt' ? args[a] + 1e-10 : args[a];
      }

      if (['lt', 'lte'].indexOf(a) !== -1) {
        high = a === 'lt' ? args[a] - 1e-10 : args[a];
      }
    }

    if (!foPairs.fields[field]) {
      foPairs.keys.add(field);
      foPairs.fields[field] = {
        tree: new IntervalTree(),
        count: 1,
        subfilters: {
          [subfilter.id]: {
            [condition.id]: {subfilter, low, high}
          }
        }
      };
    }
    else {
      if (!foPairs.fields[field].subfilters[subfilter.id]) {
        foPairs.fields[field].subfilters[subfilter.id] = {};
      }
      foPairs.fields[field].subfilters[subfilter.id][condition.id] = {subfilter, low, high};
      foPairs.fields[field].count++;
    }

    foPairs.fields[field].tree.insert(low, high, subfilter);
  }

  /**
   * Stores a "not range" condition into the field-operand structure
   *
   * "not range" conditions are stored as an inverted range,
   * meaning that if a user subscribes to the following range:
   *      [min, max]
   * Then we register the following ranges in the tree:
   *      ]-Infinity, min[
   *      ]max, +Infinity[
   *
   * (boundaries are also reversed: inclusive boundaries become
   * exclusive, and vice-versa)
   *
   * Matching is then executed exactly like for "range" conditions.
   * This does not hurt performances as searches in the interval tree
   * are in O(log n)
   *
   * (kudos to @asendra for this neat trick)
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notrange(foPairs, subfilter, condition) {
    const
      field = Object.keys(condition.value)[0],
      args = condition.value[field];
    let
      low = -Infinity,
      high = Infinity;

    /*
     Initializes low and high values depending on condition arguments
     As the interval tree library used only considers inclusive boundaries,
     we need to add or substract an epsilon value to provided arguments
     for lte and gte options
     This is the reverse operation than the one done for the "range"
     keyword, as we then invert the searched range.
     */
    const keys = Object.keys(args);
    let i; // NOSONAR

    for(i = 0; i < keys.length; i++) {
      const a = keys[i];

      if (['gt', 'gte'].indexOf(a) !== -1) {
        low = a === 'gte' ? args[a] - 1e-10 : args[a];
      }

      if (['lt', 'lte'].indexOf(a) !== -1) {
        high = a === 'lte' ? args[a] + 1e-10 : args[a];
      }
    }

    if (!foPairs.fields[field]) {
      foPairs.keys.add(field);
      foPairs.fields[field] = {
        tree: new IntervalTree(),
        count: 1,
        subfilters: {
          [subfilter.id]: {
            [condition.id]: {subfilter, low, high}
          }
        }
      };
    }
    else {
      if (!foPairs.fields[field].subfilters[subfilter.id]) {
        foPairs.fields[field].subfilters[subfilter.id] = {};
      }
      foPairs.fields[field].subfilters[subfilter.id][condition.id] = {subfilter, low, high};
      foPairs.fields[field].count++;
    }

    if (low !== -Infinity) {
      foPairs.fields[field].tree.insert(-Infinity, low, subfilter);
    }

    if (high !== Infinity) {
      foPairs.fields[field].tree.insert(high, Infinity, subfilter);
    }
  }

  /**
   * Stores a "regexp" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  regexp(foPairs, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      value = new RegexpCondition(condition.value[fieldName].value, subfilter, condition.value[fieldName].flags);
    let entry;

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.add(fieldName);
      foPairs.fields[fieldName] = new Map([[value.stringValue, value]]);
    } else if ((entry = foPairs.fields[fieldName].get(value.stringValue)) !== undefined) {
      entry.subfilters.push(subfilter);
    } else {
      foPairs.fields[fieldName].set(value.stringValue, value);
    }
  }

  /**
   * Stores a "not regexp" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notregexp(foPairs, subfilter, condition) {
    this.regexp(foPairs, subfilter, condition);
  }

  /**
   * Stores a "geospatial" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  geospatial(foPairs, subfilter, condition) {
    const
      geotype = Object.keys(condition.value)[0],
      fieldName = Object.keys(condition.value[geotype])[0],
      value = condition.value[geotype][fieldName];

    if (!foPairs.custom.index) {
      foPairs.custom.index = new BoostSpatialIndex();
    }

    let subfilters;

    if (!foPairs.fields[fieldName]) {
      foPairs.keys.add(fieldName);
      foPairs.fields[fieldName] = new Map([[condition.id, new Set([subfilter])]]);
    } else if ((subfilters = foPairs.fields[fieldName].get(condition.id)) !== undefined) {
      subfilters.add(subfilter);

      // skip the shape insertion in the geospatial index
      return;
    } else {
      foPairs.fields[fieldName].set(condition.id, new Set([subfilter]));
    }

    storeGeoshape(foPairs.custom.index, geotype, condition.id, value);
  }

  /**
   * Stores a "not geospatial" condition into the field-operand structure
   *
   * @param {object} foPairs
   * @param {object} subfilter
   * @param {object} condition
   */
  notgeospatial(foPairs, subfilter, condition) {
    this.geospatial(foPairs, subfilter, condition);
  }
}

/**
 * Stores a geospatial shape in the provided index object.
 *
 * @param {object} index
 * @param {string} type
 * @param {string} id
 * @param {Object|Array} shape
 */
function storeGeoshape(index, type, id, shape) {
  switch (type) {
    case 'geoBoundingBox':
      index.addBoundingBox(id,
        shape.bottom,
        shape.left,
        shape.top,
        shape.right
      );
      break;
    case 'geoDistance':
      index.addCircle(id, shape.lat, shape.lon, shape.distance);
      break;
    case 'geoDistanceRange':
      index.addAnnulus(id, shape.lat, shape.lon, shape.to, shape.from);
      break;
    case 'geoPolygon':
      index.addPolygon(id, shape);
      break;
    default:
      break;
  }
}

module.exports = OperandsStorage;
