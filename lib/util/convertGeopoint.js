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
  geohash = require('ngeohash'),
  Coordinate = require('./coordinate'),
  geoLocationToCamelCase = require('./geoLocationToCamelCase'),
  fieldsExist = require('./fieldsExist');

const 
  regexLatLon = /^([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)$/,
  regexGeohash = /^[0-9a-z]{4,}$/;

/**
 * Converts one of the accepted geopoint format into
 * a standardized version
 *
 * @param {*} point - geopoint field to convert
 * @returns {Coordinate} or null if no accepted format is found
 */
function convertGeopoint (point) {
  const t = typeof point;

  if (!point || (t !== 'string' && t !== 'object')) {
    return null;
  }

  // Format: "lat, lon" or "geohash"
  if (t === 'string') {
    return fromString(point);
  }

  // Format: [lat, lon]
  if (Array.isArray(point)) {
    if (fieldsExist(point, [0, 1], 'number')) {
      return new Coordinate(point[0], point[1]);
    }

    return null;
  }

  const camelCased = geoLocationToCamelCase(point);

  // Format: { lat, lon }
  if (fieldsExist(camelCased, ['lat', 'lon'], 'number')) {
    return new Coordinate(camelCased.lat, camelCased.lon);
  }

  if (camelCased.latLon) {
    // Format: { latLon: [lat, lon] }
    if (Array.isArray(camelCased.latLon)) {
      if (fieldsExist(camelCased.latLon, [0, 1], 'number')) {
        return new Coordinate(camelCased.latLon[0], camelCased.latLon[1]);
      }

      return null;
    }

    // Format: { latLon: { lat, lon } }
    if (typeof camelCased.latLon === 'object' && fieldsExist(camelCased.latLon, ['lat', 'lon'], 'number')) {
      return new Coordinate(camelCased.latLon.lat, camelCased.latLon.lon);
    }

    if (typeof camelCased.latLon === 'string') {
      return fromString(camelCased.latLon);
    }
  }

  return null;
}

/**
 * Converts a geopoint from a string description
 * 
 * @param  {string} str
 * @return {Coordinate}  
 */
function fromString(str) {
  let 
    tmp = str.match(regexLatLon),
    converted = null;

  // Format: "latitude, longitude"
  if (tmp !== null) {
    converted = new Coordinate(Number.parseFloat(tmp[1]), Number.parseFloat(tmp[2]));
  }
  // Format: "<geohash>"
  else if (regexGeohash.test(str)) {
    tmp = geohash.decode(str);
    converted = new Coordinate(tmp.latitude, tmp.longitude);
  }

  return converted;
}

/**
 * @type {convertGeopoint}
 */
module.exports = convertGeopoint;
