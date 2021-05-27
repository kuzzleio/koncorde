const should = require('should/as-function');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const DSL = require('../../');

describe('DSL.keyword.geoDistance', () => {
  let dsl;
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
    dsl = new DSL();
    standardize = dsl.transformer.standardizer.standardize.bind(dsl.transformer.standardizer);
  });

  describe('#validation/standardization', () => {
    it('should reject an empty filter', () => {
      should(() => standardize({geoDistance: {}}))
        .throw('"geoDistance" must be a non-empty object');
    });

    it('should reject a filter with multiple field attributes', () => {
      const filter = {geoDistance: {foo: point, bar: point, distance: '1km'}};

      should(() => standardize(filter)).throw('"geoDistance" keyword must (only) contain a document field and a "distance" attribute');
    });

    it('should validate a {lat, lon} point', () => {
      should(standardize({geoDistance: {foo: point, distance: '1km'}}))
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
        .throw('geoDistance.foo: unrecognized point format');
    });

    it('should reject an invalid latLon argument type', () => {
      const p = {latLon: 42};

      should(() => standardize({geoDistance: {foo: p, distance: '1km'}}))
        .throw('geoDistance.foo: unrecognized point format');
    });

    it('should reject an invalid latLon argument string', () => {
      const p = {latLon: '[10, 10]'};

      should(() => standardize({geoDistance: {foo: p, distance: '1km'}}))
        .throw('geoDistance.foo: unrecognized point format');
    });

    it('should reject a filter with a non-string distance value', () => {
      should(() => standardize({geoDistance: {foo: point, distance: 42}}))
        .throw('Attribute "distance" in "geoDistance" must be a string');
    });

    it('should reject a filter with incorrect distance value', () => {
      should(() => standardize({geoDistance: {foo: point, distance: '1 ly'}}))
        .throw('unable to parse distance value "1 ly"');
    });
  });

  describe('#storage', () => {
    it('should store a single geoDistance correctly', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(subscription => {
          const
            subfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            storage = dsl.storage.foPairs.get('index', 'collection', 'geospatial');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').get(Array.from(subfilter.conditions)[0].id)).match(new Set([subfilter]));
        });
    });

    it('should add a subfilter to an already existing condition', () => {
      let sf1;
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(subscription => {
          sf1 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          return dsl.register('index', 'collection', {and: [{geoDistance: {foo: point, distance: '1km'}}, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          const
            sf2 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            storage = dsl.storage.foPairs.get('index', 'collection', 'geospatial');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').get(Array.from(sf1.conditions)[0].id)).match(new Set([sf1, sf2]));
        });
    });

    it('should add another condition to an already existing field', () => {
      let cond1, sf1;

      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(subscription => {
          sf1 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          cond1 = Array.from(sf1.conditions)[0].id;
          return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '10km'}});
        })
        .then(subscription => {
          const
            sf2 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            storage = dsl.storage.foPairs.get('index', 'collection', 'geospatial');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').get(cond1)).match(new Set([sf1]));
          should(storage.fields.get('foo').get(Array.from(sf2.conditions)[0].id)).match(new Set([sf2]));
        });
    });
  });

  describe('#matching', () => {
    it('should match a point inside the circle', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(subscription => {
          const result = dsl.test('index', 'collection', {foo: {lat: 43.634, lon: 3.8432 }});

          should(result).eql([subscription.id]);
        });
    });

    it('should not match if a point is outside the circle', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(() => {
          const result = dsl.test('index', 'collection', {foo: {lat: point.lat, lon: 3.9}});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document does not contain the searched geopoint', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(() => {
          const result = dsl.test('index', 'collection', {bar: point});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document contain an invalid geopoint', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(() => {
          const result = dsl.test('index', 'collection', {foo: '43.6331979 / 3.8433703'});

          should(result).be.an.Array().and.be.empty();
        });
    });
  });
});
