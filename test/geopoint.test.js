'use strict';

const
  should = require('should'),
  Coordinates = require('../lib/util/coordinate'),
  convert = require('../lib/util/convertGeopoint');

describe('#geopoint conversions', () => {
  const coords = new Coordinates(43.6021299, 3.8989713);

  it('"lat, lon"', () => {
    should(convert('43.6021299, 3.8989713'))
      .be.instanceOf(Coordinates)
      .and.match(coords);
  });

  it('"geohash"', () => {
    const converted = convert('spfb09x0ud5s');

    should(converted).be.instanceOf(Coordinates);
    
    should(converted.lat).be.approximately(coords.lat, 10e-6);
    should(converted.lon).be.approximately(coords.lon, 10e-6);
  });

  it('[lat, lon]', () => {
    should(convert([43.6021299, 3.8989713]))
      .be.instanceOf(Coordinates)
      .and.match(coords);
  });

  it('{lat: <latitude>, lon: <longitude>', () => {
    should(convert({lat: 43.6021299, lon: 3.8989713}))
      .be.instanceOf(Coordinates)
      .and.match(coords);
  });

  it('{latLon: {lat: <latitude>, lon: <longitude>}}', () => {
    should(convert({latLon: {lat: 43.6021299, lon: 3.8989713}}))
      .be.instanceOf(Coordinates)
      .and.match(coords);
  });

  it('{lat_lon: {lat: <latitude>, lon: <longitude>}}', () => {
    should(convert({lat_lon: {lat: 43.6021299, lon: 3.8989713}}))
      .be.instanceOf(Coordinates)
      .and.match(coords);
  });

  it('{latLon: {lat: <latitude>, lon: <longitude>}}', () => {
    should(convert({latLon: {lat: 43.6021299, lon: 3.8989713}}))
      .be.instanceOf(Coordinates)
      .and.match(coords);
  });

  it('{lat_lon: {lat: <latitude>, lon: <longitude>}}', () => {
    should(convert({lat_lon: {lat: 43.6021299, lon: 3.8989713}}))
      .be.instanceOf(Coordinates)
      .and.match(coords);
  });

  it('{latLon: "lat, lon"}', () => {
    should(convert({latLon: '43.6021299, 3.8989713'}))
      .be.instanceOf(Coordinates)
      .and.match(coords);
  });

  it('{lat_lon: "lat, lon"}', () => {
    should(convert({lat_lon: '43.6021299, 3.8989713'}))
      .be.instanceOf(Coordinates)
      .and.match(coords);
  });

  it('{latLon: "geohash"}', () => {
    const converted = convert('spfb09x0ud5s');

    should(converted).be.instanceOf(Coordinates);
    
    should(converted.lat).be.approximately(coords.lat, 10e-6);
    should(converted.lon).be.approximately(coords.lon, 10e-6);
  });

  it('{lat_lon: "geohash"}', () => {
    const converted = convert('spfb09x0ud5s');

    should(converted).be.instanceOf(Coordinates);
    
    should(converted.lat).be.approximately(coords.lat, 10e-6);
    should(converted.lon).be.approximately(coords.lon, 10e-6);
  });

  it('should return null if the provided data cannot be converted', () => {
    should(convert(42)).be.null();
    should(convert()).be.null();
    should(convert(null)).be.null();

    should(convert('abc')).be.null();
    should(convert('spfb09;x0ud5s')).be.null();

    should(convert([])).be.null();
    should(convert([12.34])).be.null();
    should(convert([12.34, 'abc'])).be.null();

    should(convert({latLon: []})).be.null();
    should(convert({latLon: [12.34]})).be.null();
    should(convert({latLon: [12.34, 'abc']})).be.null();
  });
});
