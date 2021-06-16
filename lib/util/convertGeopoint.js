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

const geohash = require('ngeohash');

const Coordinate = require('./coordinate');
const geoLocationToCamelCase = require('./geoLocationToCamelCase');

const GEOHASH_REGEX = /^[0-9a-z]{4,}$/;

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
    if (point.length === 2) {
      return toCoordinate(point[0], point[1]);
    }

    return null;
  }

  const camelCased = geoLocationToCamelCase(point);

  // Format: { lat, lon }
  if ( Object.prototype.hasOwnProperty.call(camelCased, 'lat')
    && Object.prototype.hasOwnProperty.call(camelCased, 'lon')
  ) {
    return toCoordinate(camelCased.lat, camelCased.lon);
  }

  if (Object.prototype.hasOwnProperty.call(camelCased, 'latLon')) {
    // Format: { latLon: [lat, lon] }
    if (Array.isArray(camelCased.latLon)) {
      if (camelCased.latLon.length === 2) {
        return toCoordinate(camelCased.latLon[0], camelCased.latLon[1]);
      }

      return null;
    }

    // Format: { latLon: { lat, lon } }
    if ( typeof camelCased.latLon === 'object'
      && Object.prototype.hasOwnProperty.call(camelCased.latLon, 'lat')
      && Object.prototype.hasOwnProperty.call(camelCased.latLon, 'lon')
    ) {
      return toCoordinate(camelCased.latLon.lat, camelCased.latLon.lon);
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
  const coordinates = str.split(',');
  let converted = null;

  // Format: "latitude, longitude"
  if (coordinates.length === 2) {
    converted = toCoordinate(coordinates[0], coordinates[1]);
  }
  // Format: "<geohash>"
  else if (GEOHASH_REGEX.test(str)) {
    const decoded = geohash.decode(str);
    converted = toCoordinate(decoded.latitude, decoded.longitude);
  }

  return converted;
}

function toCoordinate(lat, lon) {
  const latN = Number.parseFloat(lat);
  const lonN = Number.parseFloat(lon);

  if (isNaN(latN) || isNaN(lonN)) {
    return null;
  }

  return new Coordinate(latN, lonN);
}

/**
 * @type {convertGeopoint}
 */
module.exports = { convertGeopoint };
