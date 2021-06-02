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

const RE2 = require('re2');

const { convertGeopoint } = require('../util/convertGeopoint');
const { convertDistance } = require('../util/convertDistance');
const geoLocationToCamelCase = require('../util/geoLocationToCamelCase');
const NormalizedExists = require('./normalizedExists');

const BBOX_PROPERTIES = [ 'top', 'left', 'bottom', 'right' ];
const BOOL_ATTRIBUTES = ['must', 'must_not', 'should', 'should_not'];

/**
 * Verifies that a subscription is well-formed, and
 * rewrites parts of filters to harmonize filter variants
 * so that every filters use the same syntax
 *
 * Does not mutate the input filters.
 */
class Standardizer {
  constructor (config) {
    this.RegExpConstructor = config.regExpEngine === 're2' ? RE2 : RegExp;

    this.allowedKeywords = new Set([
      'and',
      'bool',
      'equals',
      'exists',
      'geoBoundingBox',
      'geoDistance',
      'geoDistanceRange',
      'geoPolygon',
      'ids',
      'in',
      'missing',
      'not',
      'nothing',
      'or',
      'range',
      'regexp'
    ]);
  }

  /**
   * Standardization entry point
   *
   * @param {Object} filters
   * @returns {Object} resolving to a standardized version of provided filters
   */
  standardize (filters) {
    const keywords = filters ? Object.keys(filters) : [];

    if (keywords.length === 0) {
      return {};
    }

    if (keywords.length > 1) {
      throw new Error('Invalid filter syntax. Filters must have one keyword only');
    }

    if (!this.allowedKeywords.has(keywords[0])) {
      throw new Error(`Unknown Koncorde keyword: ${keywords[0]}`);
    }

    return this[keywords[0]](filters);
  }

  /**
   * Validate a "exists" keyword
   * Two possible syntaxes:
   * - {exists: '<field name>'}
   * or:
   * - {exists: {field: '<field name>'}}
   *
   * The second syntax is deprecated and kept for backward compatibility only
   *
   * @param filter
   * @param [name] - optional keyword name to use. Defaults to 'exists'
   * @returns {Object} standardized filter
   */
  exists (filter, name = 'exists') {
    // Exists parsing is not idempotent => prevent double parse
    if (filter[name] instanceof NormalizedExists) {
      return filter;
    }

    // Syntax: {exists: '<field name>'}
    if (typeof filter[name] === 'string') {
      if (filter[name].length === 0) {
        throw new Error(`${name}: cannot test empty field name`);
      }

      return parseFieldSyntax(filter[name], name);
    }

    // Syntax: {exists: {field: '<field name>'}}
    const field = mustBeNonEmptyObject(filter[name], name);
    requireAttribute(filter[name], 'exists', 'field');
    onlyOneFieldAttribute(field, name);
    mustBeString(filter[name], name, 'field');

    if (filter[name].field.length === 0) {
      throw new Error(`${name}: cannot test empty field name`);
    }

    return parseFieldSyntax(filter[name].field, name);
  }

  /**
   * Validate a "ids" keyword and converts it
   * into a series of "term" conditions
   *
   * @param filter
   * @returns {Object} standardized filter
   */
  ids (filter) {
    const field = mustBeNonEmptyObject(filter.ids, 'ids');
    onlyOneFieldAttribute(field, 'ids');
    requireAttribute(filter.ids, 'ids', 'values');
    mustBeNonEmptyArray(filter.ids, 'ids', 'values');

    if (filter.ids.values.findIndex(v => typeof v !== 'string') > -1) {
      throw new Error('Array "values" in keyword "ids" can only contain strings');
    }

    const result = {
      or: filter.ids.values.map(v => ({equals: {_id: v}}))
    };

    Object.defineProperties(result, {
      _isLeaf: {
        enumerable: false,
        value: true,
        writable: true,
      }
    });

    return result;
  }

  /**
   * Validate a "missing" keyword
   * @param filter
   * @returns {Object} standardized filter
   */
  missing (filter) {
    const { missing } = this.exists(filter, 'missing');
    return { not: {exists: missing } };
  }

  nothing () {
    return { nothing: true };
  }

  /**
   * Validate a "range" keyword
   * @param filter
   * @returns {Object} standardized filter
   */
  range (filter) {
    const field = mustBeNonEmptyObject(filter.range, 'range');
    onlyOneFieldAttribute(field, 'range');

    const rangeField = field[0];
    const rangeValues = mustBeNonEmptyObject(
      filter.range[rangeField],
      `range.${rangeField}`);

    let index = rangeValues.findIndex(v => ['gt', 'lt', 'gte', 'lte'].indexOf(v) === -1);
    let high = Infinity;
    let low = -Infinity;
    let error = null;

    if (index > -1) {
      throw new Error(`"range.${rangeField}" accepts only the following attributes : gt, gte, lt, lte`);
    }

    index = rangeValues.findIndex(v => typeof filter.range[rangeField][v] !== 'number');

    if (index > -1) {
      throw new Error(`"range.${rangeField}.${rangeValues[index]}" must be a number`);
    }

    rangeValues.forEach(rangeType => {
      if (rangeType.startsWith('lt')) {
        if (high !== Infinity) {
          error = new Error(`"range.${rangeField}:" only 1 upper boundary allowed`);
        }
        else {
          high = filter.range[rangeField][rangeType];
        }
      }

      if (rangeType.startsWith('gt')) {
        if (low !== -Infinity) {
          error = new Error(`"range.${rangeField}:" only 1 lower boundary allowed`);
        }
        else {
          low = filter.range[rangeField][rangeType];
        }
      }
    });

    if (error) {
      throw error;
    }

    if (high <= low) {
      throw new Error(`"range.${rangeField}:" lower boundary must be strictly inferior to the upper one`);
    }

    return filter;
  }

  /**
   * Validate a "regexp" keyword
   *
   * @generator
   * @param filter
   * @returns {Object} standardized filter
   */
  regexp (filter) {
    const field = mustBeNonEmptyObject(filter.regexp, 'regexp');
    onlyOneFieldAttribute(field, 'regexp');

    const regexpField = field[0];

    const isString = typeof filter.regexp[regexpField] === 'string';
    const isObject = (typeof filter.regexp[regexpField] === 'object'
      && filter.regexp[regexpField] !== null
      && !Array.isArray(filter.regexp[regexpField])
      && Object.keys(filter.regexp[regexpField]).length > 0);

    if (!isObject && !isString) {
      throw new Error(`regexp.${regexpField} must be either a string or a non-empty object`);
    }

    let regexValue;
    let flags;

    if (isString) {
      regexValue = filter.regexp[regexpField];
    }
    else {
      if (Object.keys(filter.regexp[regexpField]).findIndex(v => ['flags', 'value'].indexOf(v) === -1) > -1) {
        throw new Error('Keyword "regexp" can only contain the following attributes: flags, value');
      }

      requireAttribute(filter.regexp[regexpField], 'regexp', 'value');
      regexValue = filter.regexp[regexpField].value;

      if (filter.regexp[regexpField].flags) {
        mustBeString(filter.regexp[regexpField], 'regexp', 'flags');
        flags = filter.regexp[regexpField].flags;
      }
    }

    try {
      // eslint-disable-next-line no-new
      new this.RegExpConstructor(regexValue, flags); //NOSONAR
    }
    catch (err) {
      throw new Error(`Cannot parse regexp expression "/${regexValue}/${flags}": ${err.message}`);
    }

    // standardize regexp to the unique format {<field>: {value, flags}}
    return {
      regexp: {
        [field]: {
          flags,
          value: regexValue
        }
      }
    };
  }

  /**
   * Validate a "equals" keyword
   * @param filter
   * @returns {Object} standardized filter
   */
  equals (filter) {
    const field = mustBeNonEmptyObject(filter.equals, 'equals');
    onlyOneFieldAttribute(field, 'equals');
    mustBeScalar(filter.equals, 'equals', field[0]);

    return filter;
  }

  /**
   * Validate a "in" keyword and converts it into a series
   * of "equals" conditions
   * @param filter
   * @returns {Object} standardized filter
   */
  in (filter) {
    const field = mustBeNonEmptyObject(filter.in, 'in');
    onlyOneFieldAttribute(field, 'in');

    const inValue = field[0];
    mustBeNonEmptyArray(filter.in, 'in', inValue);

    if (filter.in[inValue].findIndex(v => typeof v !== 'string') > -1) {
      throw new Error(`Array "${inValue}" in keyword "in" can only contain strings`);
    }

    const result = {
      or: filter.in[inValue].map(v => ({ equals: { [inValue]: v } }))
    };

    Object.defineProperties(result, {
      _isLeaf: {
        enumerable: false,
        value: true,
        writable: true,
      }
    });

    return result;
  }

  /**
   * Validate a "geoBoundingBox" keyword
   * @param filter
   * @returns {Object} standardized filter
   */
  geoBoundingBox (filter) {
    const field = mustBeNonEmptyObject(filter.geoBoundingBox, 'geoBoundingBox');
    onlyOneFieldAttribute(field, 'geoBoundingBox');

    const bBox = geoLocationToCamelCase(filter.geoBoundingBox[field[0]]);
    let standardized = {};

    /*
     * Multiple geopoint formats are accepted
     * We verify that the provided geopoint matches one of the
     * support format, and we convert it to a standardized
     * geopoint for further uses
     */

    // { top: -74.1, left: 40.73, bottom: -71.12, right: 40.01 }
    // (either strings or numbers)
    if (BBOX_PROPERTIES.every(v => ['string', 'number'].includes(typeof bBox[v]))) {
      for (const v of BBOX_PROPERTIES) {
        const n = Number.parseFloat(bBox[v]);

        if (isNaN(n)) {
          throw new Error(`Invalid geoBoundingBox format: ${JSON.stringify(bBox)}`);
        }

        standardized[v] = n;
      }
    }
    // { topLeft: geopoint, bottomRight: geopoint } (see convertGeopoint)
    else if (bBox.topLeft && bBox.bottomRight) {
      const topLeft = convertGeopoint(bBox.topLeft);
      const bottomRight = convertGeopoint(bBox.bottomRight);

      if (topLeft !== null && bottomRight !== null) {
        standardized = {
          bottom: bottomRight.lat,
          left: topLeft.lon,
          right: bottomRight.lon,
          top: topLeft.lat,
        };
      }
    }

    if (BBOX_PROPERTIES.some(v => standardized[v] === null || standardized[v] === undefined)) {
      throw new Error(`Unrecognized geo-point format in "geoBoundingBox.${field[0]}`);
    }

    return {
      geospatial: {
        geoBoundingBox: {
          [field[0]]: standardized,
        }
      }
    };
  }

  /**
   * Validate a "geoDistance" keyword
   * @param filter
   * @returns {Object} standardized filter
   */
  geoDistance (filter) {
    const standardized = {geospatial: {geoDistance: {}}};

    const fields = mustBeNonEmptyObject(filter.geoDistance, 'geoDistance');

    if (fields.length !== 2 || !fields.includes('distance')) {
      throw new Error('"geoDistance" keyword must (only) contain a document field and a "distance" attribute');
    }

    mustBeString(filter.geoDistance, 'geoDistance', 'distance');

    const docField = Object.keys(filter.geoDistance).find(f => f !== 'distance');
    const point = convertGeopoint(filter.geoDistance[docField]);

    if (point === null) {
      throw new Error(`geoDistance.${docField}: unrecognized point format`);
    }

    standardized.geospatial.geoDistance[docField] = {lat: point.lat, lon: point.lon};
    standardized.geospatial.geoDistance[docField].distance = convertDistance(filter.geoDistance.distance);

    return standardized;
  }

  /**
   * Validate a "geoDistanceRange" keyword
   * @param filter
   * @returns {Object} standardized filter
   */
  geoDistanceRange (filter) {
    const fields = mustBeNonEmptyObject(filter.geoDistanceRange, 'geoDistanceRange');

    if (fields.length !== 3 || !fields.includes('from') || !fields.includes('to')) {
      throw new Error('"geoDistanceRange" keyword must (only) contain a document field and the following attributes: "from", "to"');
    }

    const docField = Object.keys(filter.geoDistanceRange).find(f => f !== 'from' && f !== 'to');

    mustBeString(filter.geoDistanceRange, 'geoDistanceRange', 'from');
    mustBeString(filter.geoDistanceRange, 'geoDistanceRange', 'to');

    const point = convertGeopoint(filter.geoDistanceRange[docField]);

    if (point === null) {
      throw new Error(`geoDistanceRange.${docField}: unrecognized point format`);
    }

    const from = convertDistance(filter.geoDistanceRange.from);
    const to = convertDistance(filter.geoDistanceRange.to);

    if (from >= to) {
      throw new Error(`geoDistanceRange.${docField}: inner radius must be smaller than outer radius`);
    }

    return {
      geospatial: {
        geoDistanceRange: {
          [docField]: {
            from,
            lat: point.lat,
            lon: point.lon,
            to,
          }
        }
      }
    };
  }

  /**
   * Validate a "geoPolygon" keyword
   * @param filter
   * @returns {Object} standardized filter
   */
  geoPolygon (filter) {
    const fields = mustBeNonEmptyObject(filter.geoPolygon, 'geoPolygon');
    const docField = fields[0];

    onlyOneFieldAttribute(fields, 'geoPolygon');
    requireAttribute(filter.geoPolygon[docField], `geoPolygon.${docField}`, 'points');
    mustBeNonEmptyArray(filter.geoPolygon[docField], `geoPolygon.${docField}`, 'points');

    const points = [];

    if (filter.geoPolygon[docField].points.length < 3) {
      throw new Error(`"geoPolygon.${docField}": at least 3 points are required to build a polygon`);
    }

    for (let i = 0; i < filter.geoPolygon[docField].points.length; ++i) {
      const point = convertGeopoint(filter.geoPolygon[docField].points[i]);

      if (point === null) {
        throw new Error(`geoPolygon.${docField}: unrecognized point format (${JSON.stringify(filter.geoPolygon[docField].points[i])})`);
      }

      points.push([point.lat, point.lon]);
    }

    return {
      geospatial: {
        geoPolygon: {
          [docField]: points
        }
      }
    };
  }

  /**
   * Validates a AND-like operand
   * @param {object} filter
   * @param {string} [keyword] name - user keyword entry (and, must, should_not).. used to display errors if any
   * @returns {Object} standardized filter
   */
  and (filter) {
    mustBeNonEmptyArray(filter, 'and');
    return this._standardizeFilterArray(filter, 'and');
  }

  /**
   * Validates a OR-like operand
   * @param {object} filter
   * @param {string} [keyword] name - user keyword entry (or, should, must_not).. used to display errors if any
   * @returns {Object} standardized filter
   */
  or (filter) {
    mustBeNonEmptyArray(filter, 'or');
    return this._standardizeFilterArray(filter, 'or');
  }

  /**
   * Validates a NOT operand
   * @param filter
   * @returns {Object} standardized filter
   */
  not (filter) {
    const fields = mustBeNonEmptyObject(filter.not, 'not');
    onlyOneFieldAttribute(fields, 'not');

    const result = this.standardize(filter.not);
    const k = Object.keys(result)[0];

    if (k === 'and' || k === 'or') {
      let _isLeaf = true;

      const subs = result[k].map(f => {
        const sub = this.standardize({ not: f });

        if (sub.or || sub.and) {
          _isLeaf = false;
        }

        return sub;
      });

      const res = {
        [k === 'and' ? 'or' : 'and']: subs
      };

      Object.defineProperties(res, {
        _isLeaf: {
          enumerable: false,
          value: _isLeaf,
          writable: true,
        }
      });

      return res;
    }

    if (result.not) {
      return result.not;
    }
    return {not: result};
  }

  /**
   * Validates a BOOL operand
   * @param filter
   * @returns {Object} standardized filter
   */
  bool (filter) {
    const fields = mustBeNonEmptyObject(filter.bool, 'bool');

    if (fields.findIndex(field => BOOL_ATTRIBUTES.indexOf(field) === -1) > -1) {
      throw new Error(`"bool" operand accepts only the following attributes: ${BOOL_ATTRIBUTES.join(', ')}`);
    }

    const f = {and: []};

    if (filter.bool.must) {
      f.and = f.and.concat(filter.bool.must);
    }

    if (filter.bool.must_not) {
      f.and.push({not: {or: filter.bool.must_not}});
    }

    if (filter.bool.should) {
      f.and.push({or: filter.bool.should});
    }

    if (filter.bool.should_not) {
      f.and.push({not: {and: filter.bool.should_not}});
    }

    return this.standardize(f);
  }

  /**
   * Checks that a filters array is well-formed and standardizes it
   *
   * @private
   * @param {Object} filter - "and" or "or" filter, i.e. {and: [cond1, cond2, ...]}
   * @param {string} operand - "real" operand to test - "and" or "or"
   * @returns {Object}
   */
  _standardizeFilterArray (filter, operand) {
    // All registered items must be non-array, non-empty objects
    const idx = Object.keys(filter[operand]).findIndex(v => {
      return typeof filter[operand][v] !== 'object' ||
        Array.isArray(filter[operand][v]) ||
        Object.keys(filter[operand][v]).length === 0;
    });

    if (idx > -1) {
      throw new Error(`"${operand}" operand can only contain non-empty objects`);
    }

    const result = {
      _isLeaf: true,
      [operand]: [],
    };

    Object.defineProperties(result, {
      _isLeaf: {
        enumerable: false,
        value: true,
        writable: true,
      }
    });

    const leaves = [];
    const andOrs = [];

    filter[operand]
      .map(f => this.standardize(f))
      .reduce((acc, sub) => {
        if (sub[operand]) {
          // and in and || or in or
          leaves.push(...sub[operand]);
          if (!sub._isLeaf) {
            result._isLeaf = false;
          }
        }
        else if (sub.and || sub.or) {
          result._isLeaf = false;
          andOrs.push(sub);
        }
        else {
          leaves.push(sub);
        }
      }, result);

    // transforms filters like {and: [ equals, equals, equals, or ]}
    // { and: [ and: [ equals, equals, equals ], or} to allow the sub and/or condition
    // to be processed as one condition by the canonicalization
    if (!result._isLeaf && leaves.length > 1) {
      const sub = this.standardize({[operand]: leaves});

      result[operand] = andOrs.concat(sub);
      return result;
    }

    result[operand] = andOrs.concat(leaves);

    if (result[operand].length === 1) {
      return result[operand][0];
    }

    return result;
  }
}

/**
 * Verifies that "filter" contains only 1 field
 * @param {Array} fieldsList
 * @param {string} keyword
 */
function onlyOneFieldAttribute(fieldsList, keyword) {
  if (fieldsList.length > 1) {
    throw new Error(`"${keyword}" can contain only one attribute`);
  }
}

/**
 * Verifies that "filter.attribute' exists
 * @param filter
 * @param keyword
 * @param attribute
 */
function requireAttribute(filter, keyword, attribute) {
  if (filter[attribute] === undefined) {
    throw new Error(`"${keyword}" requires the following attribute: ${attribute}`);
  }
}

/**
 * Tests if "filter" is a non-object
 * @param {object} filter
 * @param {string} keyword
 * @returns {Array.<string>} object's keys
 */
function mustBeNonEmptyObject(filter, keyword) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new Error(`"${keyword}" must be a non-empty object`);
  }

  const fields = Object.keys(filter);

  if (fields.length === 0) {
    throw new Error(`"${keyword}" must be a non-empty object`);
  }

  return fields;
}

/**
 * Checks that filter.field is a scalar value
 * @param filter
 * @param keyword
 * @param field
 * @returns {*}
 */
function mustBeScalar (filter, keyword, field) {
  if (filter[field] instanceof Object || filter[field] === undefined) {
    throw new Error(`"${field}" in "${keyword}" must be either a string, a number, a boolean or null`);
  }
}

/**
 * Verifies that filter.field is a string
 * @param filter
 * @param keyword
 * @param field
 */
function mustBeString (filter, keyword, field) {
  if (typeof filter[field] !== 'string') {
    throw new Error(`Attribute "${field}" in "${keyword}" must be a string`);
  }
}

/**
 * Verifies that filter.field is an array
 * @param filter
 * @param keyword
 * @param field
 */
function mustBeNonEmptyArray (filter, keyword, field) {
  const prefix = field
    ? `Attribute "${field}" in "${keyword}"`
    : `Attribute "${keyword}"`;
  const value = field ? filter[field] : filter[keyword];

  if (!Array.isArray(value)) {
    throw new Error(`${prefix} must be an array`);
  }

  if (value.length === 0) {
    throw new Error(`${prefix} cannot be empty`);
  }
}

/**
 * Verifies that the provided value is a valid field syntax.
 * Accepted syntaxes:
 *   - nested field path (e.g. "path.to.nested.field")
 * and/or:
 *   - array vallue description( e.g. "path.to.array['value']")
 *
 * Returns an object of the following form:
 * {
 *   path: '<field path>',
 *   type: ['object'|'array'],
 *   [value: '<search value>']
 * }
 *
 * Example:
 *   'foo.bar.baz' => { path: 'foo.bar.baz', type: 'object' }
 *   'foo.bar["baz"]' => {path: 'foo.bar', type: 'array', value: 'baz'};
 *
 * @param  {String} value
 * @param  {String} keyword
 * @param  {String} field
 */
function parseFieldSyntax(field, keyword) {
  const arrayField = field.match(/^(.*?[^\\])\[(.*)]$/);
  const array = arrayField !== null;
  let path = field;
  let value = null;

  if (array) {
    let rawValue;
    [, path, rawValue] = arrayField;

    try {
      value = JSON.parse(rawValue);
    }
    catch (error) {
      throw new Error(`[${keyword}] Invalid array value "${rawValue}"`);
    }
  }

  // clean up any escaped bracked from the field path
  path = path.replace(/\\([[\]])/g, '$1');

  return { [keyword]: new NormalizedExists(path, array, value) };
}

module.exports = Standardizer;
