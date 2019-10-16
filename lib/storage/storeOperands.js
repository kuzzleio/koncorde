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
  RangeCondition = require('./objects/rangeCondition'),
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
   * @param {FieldOperand} operand
   * @param {object} subfilter
   */
  everything(operand, subfilter) {
    operand.fields.set('all', [subfilter]);
  }

  /**
   * Stores a "equals" condition into the field-operand structure
   *
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  equals(operand, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      value = condition.value[fieldName],
      field = operand.fields.get(fieldName);

    if (!field) {
      operand.fields.set(fieldName, new Map([[value, new Set([subfilter])]]));
    }
    else {
      const entries = field.get(value);

      if (entries === undefined) {
        field.set(value, new Set([subfilter]));
      }
      else {
        entries.add(subfilter);
      }
    }
  }

  /**
   * Stores a "not equals" condition into the field-operand structure
   *
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  notequals(operand, subfilter, condition) {
    this.equals(operand, subfilter, condition);
  }

  /**
   * Stores a "exists" condition into the field-operand structure
   *
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  exists(operand, subfilter, condition) {
    const { path, value } = condition.value;
    let field = operand.fields.get(path);

    if (!field) {
      field = { subfilters: new Set(), values: new Map() };
      operand.fields.set(path, field);
    }


    if (!condition.value.array) {
      field.subfilters.add(subfilter);
    }
    else {
      const entries = field.values.get(value);

      if (entries !== undefined) {
        entries.add(subfilter);
      }
      else {
        field.values.set(value, new Set([subfilter]));
      }
    }
  }

  /**
   * Stores a "not exists" condition into the field-operand structure
   *
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  notexists(operand, subfilter, condition) {
    this.exists(operand, subfilter, condition);
  }

  nothing(operand, subfilter) {
    operand.fields.set('all', [subfilter]);
  }

  /**
   * Stores a "range" condition into the field-operand structure
   *
   * Stores the range in interval trees for searches in O(log n + m)
   *
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  range(operand, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      rangeCondition = new RangeCondition(subfilter, condition);

    let
      field = operand.fields.get(fieldName),
      entry;

    if (!field) {
      field = {
        tree: new IntervalTree(),
        conditions: new Map([[condition.id, rangeCondition]])
      };

      operand.fields.set(fieldName, field);
    }
    else {
      entry = field.conditions.get(condition.id);
    }

    if (entry !== undefined) {
      entry.subfilters.add(subfilter);
    }
    else {
      field.conditions.set(condition.id, rangeCondition);
      field.tree.insert(
        rangeCondition.low,
        rangeCondition.high,
        rangeCondition);
    }
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
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  notrange(operand, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      rangeCondition = new RangeCondition(subfilter, condition);

    let
      field = operand.fields.get(fieldName),
      entry;

    if (!field) {
      field = {
        tree: new IntervalTree(),
        conditions: new Map([[condition.id, rangeCondition]])
      };

      operand.fields.set(fieldName, field);
    }
    else {
      entry = field.conditions.get(condition.id);
    }

    if (entry !== undefined) {
      entry.subfilters.add(subfilter);
    }
    else {
      field.conditions.set(condition.id, rangeCondition);

      if (rangeCondition.low !== -Infinity) {
        field.tree.insert(-Infinity, rangeCondition.low, rangeCondition);
      }

      if (rangeCondition.high !== Infinity) {
        field.tree.insert(rangeCondition.high, Infinity, rangeCondition);
      }
    }

  }

  /**
   * Stores a "regexp" condition into the field-operand structure
   *
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  regexp(operand, subfilter, condition) {
    const
      fieldName = Object.keys(condition.value)[0],
      value = new RegexpCondition(
        condition.value[fieldName].value,
        subfilter,
        condition.value[fieldName].flags);

    let field = operand.fields.get(fieldName);

    if (!field) {
      field = new Map([[value.stringValue, value]]);
      operand.fields.set(fieldName, field);
    }

    const entry = field.get(value.stringValue);

    if (entry !== undefined) {
      entry.subfilters.add(subfilter);
    }
    else {
      field.set(value.stringValue, value);
    }
  }

  /**
   * Stores a "not regexp" condition into the field-operand structure
   *
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  notregexp(operand, subfilter, condition) {
    this.regexp(operand, subfilter, condition);
  }

  /**
   * Stores a "geospatial" condition into the field-operand structure
   *
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  geospatial(operand, subfilter, condition) {
    const
      geotype = Object.keys(condition.value)[0],
      fieldName = Object.keys(condition.value[geotype])[0],
      value = condition.value[geotype][fieldName];

    if (!operand.custom.index) {
      operand.custom.index = new BoostSpatialIndex();
    }

    let
      field = operand.fields.get(fieldName),
      subfilters;

    if (!field) {
      field = new Map([[condition.id, new Set([subfilter])]]);
      operand.fields.set(fieldName, field);
    }
    else {
      subfilters = field.get(condition.id);
    }

    if (subfilters !== undefined) {
      subfilters.add(subfilter);
    }
    else {
      field.set(condition.id, new Set([subfilter]));
      storeGeoshape(operand.custom.index, geotype, condition.id, value);
    }

  }

  /**
   * Stores a "not geospatial" condition into the field-operand structure
   *
   * @param {FieldOperand} operand
   * @param {object} subfilter
   * @param {object} condition
   */
  notgeospatial(operand, subfilter, condition) {
    this.geospatial(operand, subfilter, condition);
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
