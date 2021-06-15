const should = require('should/as-function');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const { Koncorde } = require('../../');

describe('Koncorde.keyword.geoDistance', () => {
  let koncorde;
  let engine;
  let standardize;
  const point = { lat: 43.6331979, lon: 3.8433703 };
  const distanceStandardized = {
    geospatial: {
      geoDistance: {
        foo: {
          lat: 43.6331979,
          lon: 3.8433703,
          distance: 1000
        }
      }
    }
  };

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
    standardize = koncorde.transformer.standardizer.standardize.bind(koncorde.transformer.standardizer);
  });

  describe('#validation/standardization', () => {
    it('should reject an empty filter', () => {
      should(() => standardize({geoDistance: {}}))
        .throw({
          keyword: 'geoDistance',
          message: '"geoDistance": expected object to have exactly 2 properties, got 0',
          path: 'geoDistance',
        });
    });

    it('should reject a filter with multiple field attributes', () => {
      const filter = {
        geoDistance: {
          bar: point,
          distance: '1km',
          foo: point,
        },
      };

      should(() => standardize(filter))
        .throw({
          keyword: 'geoDistance',
          message: '"geoDistance": expected object to have exactly 2 properties, got 3',
          path: 'geoDistance',
        });
    });

    it('should validate a {lat, lon} point', () => {
      should(standardize({ geoDistance: { foo: point, distance: '1km' } }))
        .match(distanceStandardized);
    });

    it('should validate a {latLon: [lat, lon]} point', () => {
      const p = {latLon: [point.lat, point.lon]};
      should(standardize({geoDistance: {foo: p, distance: '1km'}}))
        .match(distanceStandardized);
    });

    it('should validate a {lat_lon: [lat, lon]} point', () => {
      const p = {lat_lon: [point.lat, point.lon]};

      should(standardize({geoDistance: {foo: p, distance: '1km'}}))
        .match(distanceStandardized);
    });

    it('should validate a {latLon: {lat: lat, lon: lon}} point', () => {
      const p = {latLon: {lat: point.lat, lon: point.lon}};

      should(standardize({geoDistance: {foo: p, distance: '1km'}}))
        .match(distanceStandardized);
    });

    it('should validate a {lat_lon: {lat: lat, lon: lon}} point', () => {
      const p = {lat_lon: {lat: point.lat, lon: point.lon}};

      should(standardize({geoDistance: {foo: p, distance: '1km'}}))
        .match(distanceStandardized);
    });

    it('should validate a {latLon: "lat, lon"} point', () => {
      const p = {latLon: `${point.lat}, ${point.lon}`};

      should(standardize({geoDistance: {foo: p, distance: '1km'}}))
        .match(distanceStandardized);
    });

    it('should validate a {lat_lon: "lat, lon"} point', () => {
      const p = {lat_lon: `${point.lat}, ${point.lon}`};
      should(standardize({geoDistance: {foo: p, distance: '1km'}}))
        .match(distanceStandardized);
    });

    it('should validate a {latLon: "geohash"} point', () => {
      const p = {latLon: 'spf8prntv18e'};
      const result = standardize({geoDistance: {foo: p, distance: '1km'}});

      should(result).be.an.Object();
      should(result.geospatial).be.an.Object();
      should(result.geospatial.geoDistance).be.an.Object();
      should(result.geospatial.geoDistance.foo).be.an.Object();
      should(result.geospatial.geoDistance.foo.distance).be.eql(1000);

      should(result.geospatial.geoDistance.foo.lat)
        .be.approximately(point.lat, 10e-7);

      should(result.geospatial.geoDistance.foo.lon)
        .be.approximately(point.lon, 10e-7);
    });

    it('should validate a {lat_lon: "geohash"} point', () => {
      const p = {lat_lon: 'spf8prntv18e'};
      const result = standardize({geoDistance: {foo: p, distance: '1km'}});

      should(result).be.an.Object();
      should(result.geospatial).be.an.Object();
      should(result.geospatial.geoDistance).be.an.Object();
      should(result.geospatial.geoDistance.foo).be.an.Object();
      should(result.geospatial.geoDistance.foo.distance).be.eql(1000);

      should(result.geospatial.geoDistance.foo.lat)
        .be.approximately(point.lat, 10e-7);

      should(result.geospatial.geoDistance.foo.lon)
        .be.approximately(point.lon, 10e-7);
    });

    it('should reject an unrecognized point format', () => {
      const p = {foo: 'bar'};

      should(() => standardize({geoDistance: {foo: p, distance: '1km'}}))
        .throw({
          keyword: 'geoDistance',
          message: '"geoDistance.foo": unrecognized point format',
          path: 'geoDistance.foo',
        });
    });

    it('should reject an invalid latLon argument type', () => {
      const p = {latLon: 42};

      should(() => standardize({geoDistance: {foo: p, distance: '1km'}}))
        .throw({
          keyword: 'geoDistance',
          message: '"geoDistance.foo": unrecognized point format',
          path: 'geoDistance.foo',
        });
    });

    it('should reject an invalid latLon argument string', () => {
      const p = {latLon: '[10, 10]'};

      should(() => standardize({geoDistance: {foo: p, distance: '1km'}}))
        .throw({
          keyword: 'geoDistance',
          message: '"geoDistance.foo": unrecognized point format',
          path: 'geoDistance.foo',
        });
    });

    it('should reject a filter with a non-string distance value', () => {
      should(() => standardize({geoDistance: {foo: point, distance: 42}}))
        .throw({
          keyword: 'geoDistance',
          message: '"geoDistance.distance": must be a string',
          path: 'geoDistance.distance',
        });
    });

    it('should reject a filter with incorrect distance value', () => {
      should(() => standardize({geoDistance: {foo: point, distance: '1 ly'}}))
        .throw('unable to parse distance value "1 ly"');
    });
  });

  describe('#storage', () => {
    it('should store a single geoDistance correctly', () => {
      const id = koncorde.register({
        geoDistance: {
          distance: '1km',
          foo: point,
        },
      });

      const subfilter = Array.from(engine.filters.get(id).subfilters)[0];
      const storage = engine.foPairs.get('geospatial');

      should(storage).be.instanceOf(FieldOperand);
      const sfs = storage.fields
        .get('foo')
        .get(Array.from(subfilter.conditions)[0].id);

      should(sfs).match(new Set([subfilter]));
    });

    it('should add a subfilter to an already existing condition', () => {
      const id1 = koncorde.register({
        geoDistance: {
          distance: '1km',
          foo: point,
        },
      });
      const id2 = koncorde.register({
        and: [
          { geoDistance: { foo: point, distance: '1km' } },
          { equals: { foo: 'bar' } },
        ],
      });

      const sf1 = Array.from(engine.filters.get(id1).subfilters)[0];
      const sf2 = Array.from(engine.filters.get(id2).subfilters)[0];
      const storage = engine.foPairs.get('geospatial');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(Array.from(sf1.conditions)[0].id))
        .match(new Set([sf1, sf2]));
    });

    it('should add another condition to an already existing field', () => {
      const id1 = koncorde.register({
        geoDistance: {
          distance: '1km',
          foo: point,
        },
      });
      const id2 = koncorde.register({
        geoDistance: {
          distance: '10km',
          foo: point,
        },
      });

      const sf1 = Array.from(engine.filters.get(id1).subfilters)[0];
      const cond1 = Array.from(sf1.conditions)[0].id;
      const sf2 = Array.from(engine.filters.get(id2).subfilters)[0];
      const storage = engine.foPairs.get('geospatial');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(cond1)).match(new Set([sf1]));
      should(storage.fields.get('foo').get(Array.from(sf2.conditions)[0].id))
        .match(new Set([sf2]));
    });
  });

  describe('#matching', () => {
    it('should match a point inside the circle', () => {
      const id = koncorde.register({
        geoDistance: {
          foo: point,
          distance: '1km',
        },
      });

      const result = koncorde.test({
        foo: {
          lat: 43.634,
          lon: 3.8432,
        },
      });

      should(result).eql([id]);
    });

    it('should not match if a point is outside the circle', () => {
      koncorde.register({
        geoDistance: {
          distance: '1km',
          foo: point,
        },
      });

      const result = koncorde.test({
        foo: {
          lat: point.lat,
          lon: 3.9,
        },
      });

      should(result).be.an.Array().and.be.empty();
    });

    it('should return an empty array if the document does not contain the searched geopoint', () => {
      koncorde.register({
        geoDistance: {
          distance: '1km',
          foo: point,
        },
      });

      const result = koncorde.test({ bar: point });

      should(result).be.an.Array().and.be.empty();
    });

    it('should return an empty array if the document contain an invalid geopoint', () => {
      koncorde.register({
        geoDistance: {
          distance: '1km',
          foo: point,
        },
      });

      const result = koncorde.test({ foo: '43.6331979 / 3.8433703' });

      should(result).be.an.Array().and.be.empty();
    });
  });
});
