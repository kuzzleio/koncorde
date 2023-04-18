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
const { KoncordeParseError } = require('../types/KoncordeParseError');
const geoLocationToCamelCase = require('../util/geoLocationToCamelCase');
const NormalizedExists = require('./normalizedExists');

const BBOX_PROPERTIES = ['top', 'left', 'bottom', 'right'];
const BOOL_ATTRIBUTES = ['must', 'must_not', 'should', 'should_not'];

/**
 * Verifies that a subscription is well-formed, and
 * rewrites parts of filters to harmonize filter variants
 * so that every filters use the same syntax
 *
 * Does not mutate the input filters.
 */
class Standardizer {
  constructor(config) {
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
      'match',
      'missing',
      'not',
      'nothing',
      'or',
      'select',
      'range',
      'regexp',
    ]);
  }

  /**
   * Standardization entry point
   *
   * @param {Object} filters
   * @param {string} [path] - currently examined filter path
   * @returns {Object} resolving to a standardized version of provided filters
   */
  standardize(filters, path = null) {
    const keywords = filters ? Object.keys(filters) : [];

    if (keywords.length === 0) {
      return {};
    }

    if (keywords.length > 1) {
      throw new KoncordeParseError(
        'Invalid filter syntax. Filters must have one keyword only',
        keywords.join(','),
        path);
    }

    if (!this.allowedKeywords.has(keywords[0])) {
      throw new KoncordeParseError(
        'unknown keyword',
        keywords[0],
        pathAdd(path, keywords[0]));
    }

    return this[keywords[0]](filters, pathAdd(path, keywords[0]));
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
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @param {String} [name] - optional keyword name to use. Defaults to 'exists'
   * @returns {Object} standardized filter
   */
  exists(filter, path, name = 'exists') {
    // Exists parsing is not idempotent => prevent double parse
    if (filter[name] instanceof NormalizedExists) {
      return filter;
    }

    // Syntax: {exists: '<field name>'}
    if (typeof filter[name] === 'string') {
      if (filter[name].length === 0) {
        throw new KoncordeParseError('cannot test empty field name', name, path);
      }

      return parseFieldSyntax(filter[name], name, path);
    }

    // Syntax: {exists: {field: '<field name>'}}
    isObject(filter, name, name, path, {
      properties: 1,
      required: ['field'],
    });

    const fieldPath = pathAdd(path, 'field');

    isString(filter[name], 'field', name, fieldPath);

    return parseFieldSyntax(filter[name].field, name, fieldPath);
  }


  /**
   * Validate an "ids" keyword and converts it into a series of
   * "equals" conditions
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  ids(filter, path) {
    isObject(filter, 'ids', 'ids', path, {
      properties: 1,
      required: ['values'],
    });

    isArray(filter.ids, 'values', 'ids', pathAdd(path, 'values'), {
      nonEmpty: true,
      type: 'string',
    });

    const result = {
      or: filter.ids.values.map(v => ({ equals: { _id: v } }))
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
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  missing(filter, path) {
    const { missing } = this.exists(filter, path, 'missing');
    return { not: { exists: missing } };
  }

  nothing() {
    return { nothing: true };
  }

  /**
   * Validate a "range" keyword
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  range(filter, path) {
    isObject(filter, 'range', 'range', path, { properties: 1 });

    const field = Object.keys(filter.range)[0];
    const fieldPath = `${path}.${field}`;

    isObject(filter.range, field, 'range', pathAdd(path, field), {
      allowed: ['gt', 'gte', 'lt', 'lte'],
      nonEmpty: true,
    });

    let high = Infinity;
    let low = -Infinity;

    for (const [key, value] of Object.entries(filter.range[field])) {
      if (typeof value !== 'number') {
        throw new KoncordeParseError(
          'must be a number',
          'range',
          pathAdd(fieldPath, key));
      }

      if (key === 'lt' || key === 'lte') {
        if (high !== Infinity) {
          throw new KoncordeParseError(
            'only 1 upper boundary allowed',
            'range',
            fieldPath);
        }
        else {
          high = value;
        }
      }

      if (key === 'gt' || key === 'gte') {
        if (low !== -Infinity) {
          throw new KoncordeParseError(
            'only 1 lower boundary allowed',
            'range',
            fieldPath);
        }
        else {
          low = value;
        }
      }
    }

    if (high <= low) {
      throw new KoncordeParseError(
        'lower boundary must be strictly inferior to the upper one',
        'range',
        fieldPath);
    }

    return filter;
  }

  /**
   * Validate a "regexp" keyword
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  regexp(filter, path) {
    isObject(filter, 'regexp', 'regexp', path, { properties: 1 });

    const field = Object.keys(filter.regexp)[0];
    let value;
    let flags;

    if (typeof filter.regexp[field] === 'string') {
      value = filter.regexp[field];
    }
    else if (Object.prototype.toString.call(filter.regexp[field]) === '[object Object]') {
      const fieldPath = pathAdd(path, field);

      isObject(filter.regexp, field, 'regexp', fieldPath, {
        allowed: ['flags', 'value'],
        nonEmpty: true,
        required: ['value'],
      });

      value = filter.regexp[field].value;

      if (filter.regexp[field].flags) {
        isString(filter.regexp[field], 'flags', 'regexp', pathAdd(fieldPath, 'flags'));
        flags = filter.regexp[field].flags;
      }
    }
    else {
      throw new KoncordeParseError(
        'must be either a string or a non-empty object',
        'regexp',
        pathAdd(path, field));
    }

    try {
      // eslint-disable-next-line no-new
      new this.RegExpConstructor(value, flags); //NOSONAR
    }
    catch (err) {
      throw new KoncordeParseError(
        `cannot parse regexp expression "/${value}/${flags}" (${err.message})`,
        'regexp',
        pathAdd(path, field));
    }

    // standardize regexp to the unique format {<field>: {value, flags}}
    return {
      regexp: {
        [field]: {
          flags,
          value,
        }
      }
    };
  }

  /**
   * Validate a "equals" keyword
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  equals(filter, path) {
    isObject(filter, 'equals', 'equals', path, { properties: 1 });

    const field = Object.keys(filter.equals)[0];
    isScalar(filter.equals, field, 'equals', pathAdd(path, field));

    return filter;
  }

  /**
     * Validate a "select" keyword
     *
     * @param {Object} filter
     * @param {String} path - currently examined filter path
     * @returns {Object} standardized filter
     */
  select(filter, path) {
    isObject(filter, 'select', 'select', path, { properties: 3 });
  
    isString(filter.select, 'field', 'select', pathAdd(path, 'field'));
    isInteger(filter.select, 'index', 'select', pathAdd(path, 'index'));
    isObject(filter.select, 'query', 'select', pathAdd(path, 'query'), { nonEmpty: true });
      
  
    this.standardize(filter.select.query, pathAdd(path, 'query'));
      
    return filter;
  }

  /**
   * Validate a "match" keyword
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  match(filter, path) {
    isObject(filter, 'match', 'match', path, { nonEmpty: true });
    return filter;
  }

  /**
   * Validate a "in" keyword and converts it into a series
   * of "equals" conditions
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  in(filter, path) {
    isObject(filter, 'in', 'in', path, { properties: 1 });

    const field = Object.keys(filter.in)[0];

    isArray(filter.in, field, 'in', pathAdd(path, field), {
      nonEmpty: true,
      type: 'string',
    });

    const result = {
      or: filter.in[field].map(v => ({ equals: { [field]: v } }))
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
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  geoBoundingBox(filter, path) {
    isObject(filter, 'geoBoundingBox', 'geoBoundingBox', path, {
      properties: 1,
    });

    const field = Object.keys(filter.geoBoundingBox)[0];

    const bBox = geoLocationToCamelCase(filter.geoBoundingBox[field]);
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
          throw new KoncordeParseError(
            `unrecognized geoBoundingBox format: ${JSON.stringify(bBox)}`,
            'geoBoundingBox',
            pathAdd(path, field));
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
      throw new KoncordeParseError(
        'unrecognized geo-point format',
        'geoBoundingBox',
        pathAdd(path, field));
    }

    return {
      geospatial: {
        geoBoundingBox: {
          [field]: standardized,
        }
      }
    };
  }

  /**
   * Validate a "geoDistance" keyword
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  geoDistance(filter, path) {
    const standardized = { geospatial: { geoDistance: {} } };

    isObject(filter, 'geoDistance', 'geoDistance', path, {
      properties: 2,
      required: ['distance'],
    });

    isString(filter.geoDistance, 'distance', 'geoDistance', pathAdd(path, 'distance'));

    const field = Object.keys(filter.geoDistance).find(f => f !== 'distance');
    const point = convertGeopoint(filter.geoDistance[field]);

    if (point === null) {
      throw new KoncordeParseError(
        'unrecognized point format',
        'geoDistance',
        pathAdd(path, field));
    }

    standardized.geospatial.geoDistance[field] = {
      distance: convertDistance(filter.geoDistance.distance),
      lat: point.lat,
      lon: point.lon,
    };

    return standardized;
  }

  /**
   * Validate a "geoDistanceRange" keyword
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  geoDistanceRange(filter, path) {
    isObject(filter, 'geoDistanceRange', 'geoDistanceRange', path, {
      properties: 3,
      required: ['from', 'to'],
    });

    const field = Object
      .keys(filter.geoDistanceRange)
      .find(f => f !== 'from' && f !== 'to');

    const [from, to] = ['from', 'to'].map(f => {
      isString(filter.geoDistanceRange, f, 'geoDistanceRange', pathAdd(path, f));
      return convertDistance(filter.geoDistanceRange[f]);
    });

    if (from >= to) {
      throw new KoncordeParseError(
        'inner radius must be smaller than outer radius',
        'geoDistanceRange',
        path);
    }

    const point = convertGeopoint(filter.geoDistanceRange[field]);

    if (point === null) {
      throw new KoncordeParseError(
        'unrecognized point format',
        'geoDistanceRange',
        pathAdd(path, field));
    }

    return {
      geospatial: {
        geoDistanceRange: {
          [field]: {
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
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  geoPolygon(filter, path) {
    isObject(filter, 'geoPolygon', 'geoPolygon', path, { properties: 1 });

    const field = Object.keys(filter.geoPolygon)[0];
    const fieldPath = pathAdd(path, field);

    isObject(filter.geoPolygon, field, 'geoPolygon', fieldPath, {
      properties: 1,
      required: ['points'],
    });

    const pointsPath = pathAdd(fieldPath, 'points');

    isArray(filter.geoPolygon[field], 'points', 'geoPolygon', pointsPath);

    if (filter.geoPolygon[field].points.length < 3) {
      throw new KoncordeParseError(
        'at least 3 points are required to build a polygon',
        'geoPolygon',
        pointsPath);
    }

    const points = [];

    for (let i = 0; i < filter.geoPolygon[field].points.length; ++i) {
      const point = convertGeopoint(filter.geoPolygon[field].points[i]);

      if (point === null) {
        throw new KoncordeParseError(
          `unrecognized point format "${JSON.stringify(filter.geoPolygon[field].points[i])}"`,
          'geoPolygon',
          pointsPath);
      }

      points.push([point.lat, point.lon]);
    }

    return {
      geospatial: {
        geoPolygon: {
          [field]: points
        }
      }
    };
  }

  /**
   * Validates an AND-like operand
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  and(filter, path) {
    isArray(filter, 'and', 'and', path, { nonEmpty: true });

    return this._standardizeFilterArray(filter, 'and', path);
  }

  /**
   * Validates an OR-like operand
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  or(filter, path) {
    isArray(filter, 'or', 'or', path, { nonEmpty: true });

    return this._standardizeFilterArray(filter, 'or', path);
  }

  /**
   * Validates a NOT operand
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  not(filter, path) {
    isObject(filter, 'not', 'not', path, { properties: 1 });

    const result = this.standardize(filter.not, path);
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

    return { not: result };
  }

  /**
   * Validates a BOOL operand
   *
   * @param {Object} filter
   * @param {String} path - currently examined filter path
   * @returns {Object} standardized filter
   */
  bool(filter, path) {
    isObject(filter, 'bool', 'bool', path, {
      allowed: BOOL_ATTRIBUTES,
      nonEmpty: true,
    });

    const f = { and: [] };

    if (filter.bool.must) {
      f.and = f.and.concat(filter.bool.must);
    }

    if (filter.bool.must_not) {
      f.and.push({ not: { or: filter.bool.must_not } });
    }

    if (filter.bool.should) {
      f.and.push({ or: filter.bool.should });
    }

    if (filter.bool.should_not) {
      f.and.push({ not: { and: filter.bool.should_not } });
    }

    return this.standardize(f, path);
  }

  /**
   * Checks that a filters array is well-formed and standardizes it
   *
   * @private
   * @param {Object} filter - "and" or "or" filter, i.e. {and: [cond1, cond2, ...]}
   * @param {string} operand - "real" operand to test - "and" or "or"
   * @param {String} path - currently examined filter path
   * @returns {Object}
   */
  _standardizeFilterArray(filter, operand, path) {
    // All registered items must be non-array, non-empty objects
    const idx = Object.keys(filter[operand]).findIndex(v => {
      return Object.prototype.toString.call(filter[operand][v]) !== '[object Object]'
        || Object.keys(filter[operand][v]).length === 0;
    });

    if (idx > -1) {
      throw new KoncordeParseError(
        'can only contain non-empty objects',
        operand,
        path);
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
      .map(f => this.standardize(f, path))
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
      const sub = this.standardize({ [operand]: leaves }, path);

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
 * Verifies that "filter.property" is an object, and that it complies to the
 * optional rules provided
 *
 * @param {Object} filter
 * @param {String} property to examine
 * @param {String} keyword - Koncorde keyword being analyzed
 * @param {String} path - filter path being analyzed
 * @param {Object}   [options]
 * @param {String[]} [options.allowed] - list of the only allowed properties
 * @param {Boolean}  [options.nonEmpty] - if true, the object must not be empty
 * @param {String[]} [options.required] - list of required properties
 * @param {Number}   [options.properties] - the expected number of properties
 */
function isObject(filter, property, keyword, path, options = null) {
  if (Object.prototype.toString.call(filter[property]) !== '[object Object]') {
    throw new KoncordeParseError('must be an object', keyword, path);
  }

  if (options) {
    const fields = Object.keys(filter[property]);

    if (options.nonEmpty && fields.length === 0) {
      throw new KoncordeParseError('must be a non-empty object', keyword, path);
    }

    if (options.properties && fields.length !== options.properties) {
      throw new KoncordeParseError(
        `expected object to have exactly ${options.properties} propert${options.properties > 1 ? 'ies' : 'y'}, got ${fields.length}`,
        keyword,
        path);
    }

    if (options.required) {
      for (let i = 0; i < options.required.length; i++) {
        if (filter[property][options.required[i]] === undefined) {
          throw new KoncordeParseError(
            `the property "${options.required[i]}" is missing`,
            keyword,
            path);
        }
      }
    }

    if (options.allowed) {
      for (let i = 0; i < fields.length; i++) {
        if (!options.allowed.includes(fields[i])) {
          throw new KoncordeParseError(
            `"${fields[i]}" is not an allowed attribute (allowed: ${options.allowed.join(',')})`,
            keyword,
            path);
        }
      }
    }
  }
}


/**
 * Verifies that "filter.property" is a scalar value
 *
 * @param {Object} filter
 * @param {String} property to examine
 * @param {String} keyword - currently examined filter keyword
 * @param {String} path - currently examined filter path
 * @returns {*}
 */
function isScalar(filter, property, keyword, path) {
  if (filter[property] instanceof Object || filter[property] === undefined) {
    throw new KoncordeParseError(
      'must either be a string, a number, a boolean, or null',
      keyword,
      path);
  }
}

/**
 * Verifies that "filter.property" is a string
 *
 * @param {Object} filter
 * @param {String} property to examine
 * @param {String} keyword - currently examined keyword
 * @param {String} path - currently examined filter path
 */
function isString(filter, property, keyword, path) {
  if (typeof filter[property] !== 'string') {
    throw new KoncordeParseError('must be a string', keyword, path);
  }


  if (filter[property].length === 0) {
    throw new KoncordeParseError('cannot be empty', keyword, path);
  }
}

/**
 * Verifies that "filter.property" is an integer
 *
 * @param {Object} filter
 * @param {String} property to examine
 * @param {String} keyword - currently examined keyword
 * @param {String} path - currently examined filter path
 */
function isInteger(filter, property, keyword, path) {
  if (typeof filter[property] !== 'number') {
    throw new KoncordeParseError('must be an integer', keyword, path);
  }


  if (Math.floor(filter[property]) !== filter[property]) {
    throw new KoncordeParseError('cannot have decimals, must be an integer', keyword, path);
  }
}

/**
 * Verifies that "filter.property" is an array
 *
 * @param {Object} filter
 * @param {String} property to examine
 * @param {String} keyword - currently examined keyword
 * @param {String} path - currently examined filter path (including keyword)
 * @param {Object} [options]
 * @param {Boolean} [options.nonEmpty] - if true, the array must be non-empty
 * @param {String}  [options.type] - if set, all the array items must be of the provided type
 */
function isArray(filter, property, keyword, path, options = null) {
  if (!Array.isArray(filter[property])) {
    throw new KoncordeParseError('must be an array', keyword, path);
  }

  if (options) {
    if (options.nonEmpty && filter[property].length === 0) {
      throw new KoncordeParseError('cannot be empty', keyword, path);
    }

    if (options.type && !filter[property].every(i => typeof i === options.type)) {
      throw new KoncordeParseError(
        `must hold only values of type "${options.type}"`,
        keyword,
        path);
    }
  }
}

/**
 * Verifies that the provided value is a valid field syntax.
 * Accepted syntaxes:
 *   - nested field path (e.g. "path.to.nested.field")
 * and/or:
 *   - array value description( e.g. "path.to.array['value']")
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
 * @param  {String} keyword - currently examined keyword
 * @param  {String} path - currently examined filter path (including keyword)
 */
function parseFieldSyntax(field, keyword, path) {
  const arrayField = field.match(/^(.*?[^\\])\[(.*)]$/);
  const array = arrayField !== null;
  let fieldPath = field;
  let value = null;

  if (array) {
    let rawValue;
    [, fieldPath, rawValue] = arrayField;

    try {
      value = JSON.parse(rawValue);
    }
    catch (error) {
      throw new KoncordeParseError(
        `contains an invalid array value ("${rawValue}")`,
        keyword,
        path);
    }
  }

  // clean up any escaped bracked from the field fieldPath
  fieldPath = fieldPath.replace(/\\([[\]])/g, '$1');

  return { [keyword]: new NormalizedExists(fieldPath, array, value) };
}

function pathAdd(current, leaf) {
  if (current === null) {
    return leaf;
  }

  return `${current}.${leaf}`;
}

module.exports = Standardizer;
