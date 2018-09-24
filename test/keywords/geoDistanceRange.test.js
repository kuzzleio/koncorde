'use strict';

const
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  FieldOperand = require('../../lib/storage/objects/fieldOperand'),
  DSL = require('../../');

describe('DSL.keyword.geoDistanceRange', () => {
  let
    dsl,
    standardize;
  const
    point = { lat: 43.6331979, lon: 3.8433703 },
    distanceStandardized = {
      geospatial: {
        geoDistanceRange: {
          foo: {
            lat: 43.6331979,
            lon: 3.8433703,
            from: 1000,
            to: 10000
          }
        }
      }
    };

  beforeEach(() => {
    dsl = new DSL();
    standardize = dsl.transformer.standardizer.standardize.bind(dsl.transformer.standardizer);
  });

  describe('#validation/standardization', () => {
    it('should reject an empty filter', () => {
      return should(standardize({geoDistanceRange: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with multiple field attributes', () => {
      return should(standardize({geoDistanceRange: {foo: point, bar: point, from: '1km', to: '10km'}})).be.rejectedWith(BadRequestError);
    });

    it('should validate a {lat, lon} point', () => {
      return should(standardize({geoDistanceRange: {foo: point, from: '1km', to: '10km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {latLon: [lat, lon]} point', () => {
      const p = {latLon: [point.lat, point.lon]};
      return should(standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {lat_lon: [lat, lon]} point', () => {
      const p = {lat_lon: [point.lat, point.lon]};
      return should(standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {latLon: {lat: lat, lon: lon}} point', () => {
      const p = {latLon: {lat: point.lat, lon: point.lon}};
      return should(standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {lat_lon: {lat: lat, lon: lon}} point', () => {
      const p = {lat_lon: {lat: point.lat, lon: point.lon}};
      return should(standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {latLon: "lat, lon"} point', () => {
      const p = {latLon: `${point.lat}, ${point.lon}`};
      return should(standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {lat_lon: "lat, lon"} point', () => {
      const p = {lat_lon: `${point.lat}, ${point.lon}`};
      return should(standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {latLon: "geohash"} point', () => {
      const p = {latLon: 'spf8prntv18e'};

      return standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})
        .then(result => {
          should(result).be.an.Object();
          should(result.geospatial).be.an.Object();
          should(result.geospatial.geoDistanceRange).be.an.Object();
          should(result.geospatial.geoDistanceRange.foo).be.an.Object();
          should(result.geospatial.geoDistanceRange.foo.from).be.eql(1000);
          should(result.geospatial.geoDistanceRange.foo.to).be.eql(10000);
          should(result.geospatial.geoDistanceRange.foo.lat).be.approximately(point.lat, 10e-7);
          should(result.geospatial.geoDistanceRange.foo.lon).be.approximately(point.lon, 10e-7);
        });
    });

    it('should validate a {lat_lon: "geohash"} point', () => {
      const p = {lat_lon: 'spf8prntv18e'};

      return standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})
        .then(result => {
          should(result).be.an.Object();
          should(result.geospatial).be.an.Object();
          should(result.geospatial.geoDistanceRange).be.an.Object();
          should(result.geospatial.geoDistanceRange.foo).be.an.Object();
          should(result.geospatial.geoDistanceRange.foo.from).be.eql(1000);
          should(result.geospatial.geoDistanceRange.foo.to).be.eql(10000);
          should(result.geospatial.geoDistanceRange.foo.lat).be.approximately(point.lat, 10e-7);
          should(result.geospatial.geoDistanceRange.foo.lon).be.approximately(point.lon, 10e-7);
        });
    });

    it('should reject an unrecognized point format', () => {
      const p = {foo: 'bar'};
      return should(standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject an invalid latLon argument type', () => {
      const p = {latLon: 42};
      return should(standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject an invalid latLon argument string', () => {
      const p = {latLon: '[10, 10]'};
      return should(standardize({geoDistanceRange: {foo: p, from: '1km', to: '10km'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with a non-string from value', () => {
      return should(standardize({geoDistanceRange: {foo: point, from: 42, to: '10km'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with a non-string to value', () => {
      return should(standardize({geoDistanceRange: {foo: point, from: '1km', to: 42}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with incorrect from value', () => {
      return should(standardize({geoDistanceRange: {foo: point, from: '1 micronanomillimeter', to: '1km'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with incorrect to value', () => {
      return should(standardize({geoDistanceRange: {foo: point, from: '1 km', to: '1 ly'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with a negative range', () => {
      return should(standardize({geoDistanceRange: {foo: point, from: '10 km', to: '1km'}})).be.rejectedWith(BadRequestError);
    });
  });

  describe('#storage', () => {
    it('should store a single geoDistanceRange correctly', () => {
      return dsl.register('index', 'collection', {geoDistanceRange: {foo: point, from: '1km', to: '10km'}})
        .then(subscription => {
          const
            subfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            storage = dsl.storage.foPairs.index.collection.get('geospatial');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.get(Array.from(subfilter.conditions)[0].id)).match(new Set([subfilter]));
        });
    });

    it('should add a subfilter to an already existing condition', () => {
      let sf1;
      return dsl.register('index', 'collection', {geoDistanceRange: {foo: point, from: '1km', to: '10km'}})
        .then(subscription => {
          sf1 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          return dsl.register('index', 'collection', {and: [{geoDistanceRange: {foo: point, from: '1km', to: '10km'}}, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          const
            sf2 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            storage = dsl.storage.foPairs.index.collection.get('geospatial');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.get(Array.from(sf1.conditions)[0].id)).match(new Set([sf1, sf2]));
        });
    });

    it('should add another condition to an already existing field', () => {
      let cond1, sf1;

      return dsl.register('index', 'collection', {geoDistanceRange: {foo: point, from: '1km', to: '10km'}})
        .then(subscription => {
          sf1 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          cond1 = Array.from(sf1.conditions)[0].id;
          return dsl.register('index', 'collection', {geoDistanceRange: {foo: point, from: '10km', to: '100km'}});
        })
        .then(subscription => {
          const
            sf2 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            storage = dsl.storage.foPairs.index.collection.get('geospatial');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.keys).eql(new Set(['foo']));
          should(storage.fields.foo.get(cond1)).match(new Set([sf1]));
          should(storage.fields.foo.get(Array.from(sf2.conditions)[0].id)).match(new Set([sf2]));
        });
    });
  });

  describe('#matching', () => {
    it('should match a point inside the circle', () => {
      return dsl.register('index', 'collection', {geoDistanceRange: {foo: point, from: '1km', to: '10km'}})
        .then(subscription => {
          const result = dsl.test('index', 'collection', {foo: {lat: 43.634, lon: 3.9 }});

          should(result).eql([subscription.id]);
        });
    });

    it('should not match if a point is outside the outer radius', () => {
      return dsl.register('index', 'collection', {geoDistanceRange: {foo: point, from: '1km', to: '10km'}})
        .then(() => {
          const result = dsl.test('index', 'collection', {foo: {lat: point.lat, lon: 5}});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should not match if a point is inside the inner radius', () => {
      return dsl.register('index', 'collection', {geoDistanceRange: {foo: point, from: '1km', to: '10km'}})
        .then(() => {
          const result = dsl.test('index', 'collection', {foo: point});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document does not contain the searched geopoint', () => {
      return dsl.register('index', 'collection', {geoDistanceRange: {foo: point, from: '1km', to: '10km'}})
        .then(() => {
          const result = dsl.test('index', 'collection', {bar: point});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document contain an invalid geopoint', () => {
      return dsl.register('index', 'collection', {geoDistanceRange: {foo: point, from: '1km', to: '10km'}})
        .then(() => {
          const result = dsl.test('index', 'collection', {foo: '43.6331979 / 3.8433703'});

          should(result).be.an.Array().and.be.empty();
        });
    });
  });
});
