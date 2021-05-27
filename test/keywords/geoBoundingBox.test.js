const should = require('should/as-function');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const DSL = require('../../');

describe('DSL.keyword.geoBoundingBox', () => {
  let dsl;
  let filters;
  let foPairs;
  let standardize;
  const bbox = {
    topLeft: { lat: 43.6331979, lon: 3.8433703 },
    bottomRight: { lat: 43.5810609, lon: 3.9282093 }
  };
  const bboxStandardized = {
    geospatial: {
      geoBoundingBox: {
        foo: {
          bottom: 43.5810609,
          left: 3.8433703,
          top: 43.6331979,
          right: 3.9282093
        }
      }
    }
  };

  beforeEach(() => {
    dsl = new DSL();
    filters = dsl.storage.filters;
    foPairs = dsl.storage.foPairs;
    standardize = dsl.transformer.standardizer.standardize.bind(dsl.transformer.standardizer);
  });

  describe('#validation/standardization', () => {
    it('should reject an empty filter', () => {
      should(() => standardize({geoBoundingBox: {}}))
        .throw('"geoBoundingBox" must be a non-empty object');
    });

    it('should reject a filter with multiple field attributes', () => {
      should(() => standardize({geoBoundingBox: {foo: bbox, bar: bbox}}))
        .throw('"geoBoundingBox" can contain only one attribute');
    });

    it('should validate a {top, left, bottom, right} bbox', () => {
      const box = {
        bottom: 43.5810609,
        left: 3.8433703,
        top: 43.6331979,
        right: 3.9282093
      };

      should(standardize({geoBoundingBox: {foo: box}})).match(bboxStandardized);
    });

    it('should validate a {"top", "left", "bottom", "right"} bbox', () => {
      const box = {
        bottom: '43.5810609',
        left: '3.8433703',
        top: '43.6331979',
        right: '3.9282093'
      };

      should(standardize({geoBoundingBox: {foo: box}})).match(bboxStandardized);
    });

    it('should validate a {topLeft: {lat, lon}, bottomRight: {lat, lon}} bbox', () => {
      should(standardize({geoBoundingBox: {foo: bbox}})).match(bboxStandardized);
    });

    it('should validate a {top_left: {lat, lon}, bottom_right: {lat, lon}} bbox', () => {
      const box = {
        top_left: { lat: 43.6331979, lon: 3.8433703 },
        bottom_right: { lat: 43.5810609, lon: 3.9282093 }
      };

      should(standardize({geoBoundingBox: {foo: box}})).match(bboxStandardized);
    });

    it('should validate a {topLeft: [lat, lon], bottomRight: [lat, lon]} bbox', () => {
      const box = {
        topLeft: [43.6331979, 3.8433703],
        bottomRight: [43.5810609, 3.9282093]
      };

      should(standardize({geoBoundingBox: {foo: box}})).match(bboxStandardized);
    });

    it('should validate a {top_left: [lat, lon], bottom_right: [lat, lon]} bbox', () => {
      const box = {
        top_left: [43.6331979, 3.8433703],
        bottom_right: [43.5810609, 3.9282093]
      };

      should(standardize({geoBoundingBox: {foo: box}})).match(bboxStandardized);
    });

    it('should validate a {topLeft: "lat, lon", bottomRight: "lat, lon" bbox', () => {
      const box = {
        topLeft: '43.6331979, 3.8433703',
        bottomRight: '43.5810609, 3.9282093'
      };

      should(standardize({geoBoundingBox: {foo: box}})).match(bboxStandardized);
    });

    it('should validate a {top_left: "lat, lon", bottom_right: "lat, lon" bbox', () => {
      const box = {
        top_left: '43.6331979, 3.8433703',
        bottom_right: '43.5810609, 3.9282093'
      };

      should(standardize({geoBoundingBox: {foo: box}})).match(bboxStandardized);
    });

    it('should validate a {topLeft: "geohash", bottomRight: "geohash"} bbox', () => {
      const result = standardize({
        geoBoundingBox: {
          foo: {
            topLeft: 'spf8prntv18e',
            bottomRight: 'spdzcmsqjft4',
          },
        },
      });

      const box = bboxStandardized.geospatial.geoBoundingBox.foo;

      should(result).be.an.Object();
      should(result.geospatial).be.an.Object();
      should(result.geospatial.geoBoundingBox).be.an.Object();
      should(result.geospatial.geoBoundingBox.foo).be.an.Object();

      should(result.geospatial.geoBoundingBox.foo.top)
        .be.approximately(box.top, 10e-7);

      should(result.geospatial.geoBoundingBox.foo.bottom)
        .be.approximately(box.bottom, 10e-7);

      should(result.geospatial.geoBoundingBox.foo.left)
        .be.approximately(box.left, 10e-7);

      should(result.geospatial.geoBoundingBox.foo.right)
        .be.approximately(box.right, 10e-7);
    });

    it('should validate a {top_left: "geohash", bottom_right: "geohash"} bbox', () => {
      const result = standardize({
        geoBoundingBox: {
          foo: {
            top_left: 'spf8prntv18e',
            bottom_right: 'spdzcmsqjft4',
          },
        },
      });

      const box = bboxStandardized.geospatial.geoBoundingBox.foo;

      should(result).be.an.Object();
      should(result.geospatial).be.an.Object();
      should(result.geospatial.geoBoundingBox).be.an.Object();
      should(result.geospatial.geoBoundingBox.foo).be.an.Object();

      should(result.geospatial.geoBoundingBox.foo.top)
        .be.approximately(box.top, 10e-7);

      should(result.geospatial.geoBoundingBox.foo.bottom)
        .be.approximately(box.bottom, 10e-7);

      should(result.geospatial.geoBoundingBox.foo.left)
        .be.approximately(box.left, 10e-7);

      should(result.geospatial.geoBoundingBox.foo.right)
        .be.approximately(box.right, 10e-7);
    });

    it('should reject an unrecognized bbox format', () => {
      const box = {
        top_left: '40.73 / -74.1',
        bottom_right: '40.01 / -71.12',
      };

      should(() => standardize({geoBoundingBox: {foo: box}}))
        .throw('Unrecognized geo-point format in "geoBoundingBox.foo');
    });

    it('should reject a non-convertible bbox point string', () => {
      const box = {
        bottom: '43.5810609',
        left: '3.8433703',
        top: '43.6331979',
        right: 'foobar'
      };

      should(() => standardize({geoBoundingBox: {foo: box}}))
        .throw(`Invalid geoBoundingBox format: ${JSON.stringify(box)}`);
    });
  });

  describe('#storage', () => {
    it('should store a single geoBoundingBox correctly', () => {
      const sub = dsl.register('index', 'collection', {
        geoBoundingBox: { foo: bbox },
      });
      const subfilter = Array.from(filters.get(sub.id).subfilters)[0];
      const storage = foPairs.get('index', 'collection', 'geospatial');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo')).have.value(
        Array.from(subfilter.conditions)[0].id,
        new Set([subfilter]));
    });

    it('should add a subfilter to an already existing condition', () => {
      const sub1 = dsl.register('index', 'collection', {
        geoBoundingBox: { foo: bbox },
      });

      const sub2 = dsl.register('index', 'collection', {
        and: [
          { geoBoundingBox: { foo: bbox } },
          { equals: { foo: 'bar' } },
        ],
      });

      const storage = foPairs.get('index', 'collection', 'geospatial');

      should(storage).be.instanceOf(FieldOperand);

      const sf1 = Array.from(filters.get(sub1.id).subfilters)[0];
      const sf2 = Array.from(filters.get(sub2.id).subfilters)[0];
      should(storage.fields.get('foo')).have.value(
        Array.from(sf1.conditions)[0].id,
        new Set([sf1, sf2]));
    });

    it('should add another condition to an already existing field', () => {
      const sub1 = dsl.register('index', 'collection', {
        geoBoundingBox: {foo: bbox},
      });

      const sub2 = dsl.register('index', 'collection', {
        geoBoundingBox: {
          foo: {
            bottomRight: 'drj7teegpus6',
            topLeft: 'dr5r9ydj2y73',
          },
        },
      });

      const sf1 = Array.from(filters.get(sub1.id).subfilters)[0];
      const sf2 = Array.from(filters.get(sub2.id).subfilters)[0];
      const cond1 = Array.from(sf1.conditions)[0].id;
      const cond2 = Array.from(sf2.conditions)[0].id;

      const storage = foPairs.get('index', 'collection', 'geospatial');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(cond1)).match(new Set([sf1]));
      should(storage.fields.get('foo').get(cond2)).match(new Set([sf2]));
    });
  });

  describe('#matching', () => {
    it('should match a point inside the bbox', () => {
      const sub = dsl.register('index', 'collection', {
        geoBoundingBox: { foo: bbox },
      });

      const result = dsl.test('index', 'collection', {
        foo: {
          latLon: [ 43.6073913, 3.9109057 ]
        }
      });

      should(result).eql([sub.id]);
    });

    it('should convert points to float before trying to match them', () => {
      const sub = dsl.register('index', 'collection', {
        geoBoundingBox: { foo: bbox },
      });

      const result = dsl.test('index', 'collection', {
        foo: {
          latLon: ['43.6073913', '3.9109057'],
        },
      });

      should(result).eql([sub.id]);
    });

    it('should match a point exactly on a bbox corner', () => {
      const sub = dsl.register('index', 'collection', {
        geoBoundingBox: { foo: bbox },
      });

      const result = dsl.test('index', 'collection', {foo: bbox.topLeft});

      should(result).eql([sub.id]);
    });

    it('should match a point on one of the bbox border', () => {
      const sub = dsl.register('index', 'collection', {
        geoBoundingBox: { foo: bbox },
      });

      const result = dsl.test('index', 'collection', {
        foo: {
          lat: bbox.topLeft.lat,
          lon: 3.9,
        },
      });

      should(result).eql([sub.id]);
    });

    it('should not match if a point is outside the bbox', () => {
      dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}});

      const result = dsl.test('index', 'collection', {
        foo: {
          lat: bbox.topLeft.lat + 10e-6,
          lon: 3.9,
        },
      });

      should(result).be.an.Array().and.be.empty();
    });

    it('should return an empty array if the document does not contain a geopoint', () => {
      dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}});

      const result = dsl.test('index', 'collection', {
        bar: {
          lat: bbox.topLeft.lat + 10e-6,
          lon: 3.9,
        },
      });

      should(result).be.an.Array().and.be.empty();
    });

    it('should return an empty array if the document contain an invalid geopoint', () => {
      dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}});

      const result = dsl.test('index', 'collection', {
        foo: '43.6331979 / 3.8433703',
      });

      should(result).be.an.Array().and.be.empty();
    });
  });
});
