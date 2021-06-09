const should = require('should/as-function');

const FieldOperand = require('../../lib/engine/objects/fieldOperand');
const Koncorde = require('../../');

/**
 * Tests not geoBoundingBox, not geoDistance, not geoDistanceRange
 * and not geoPolygon keywords
 *
 * Does not check filter validation nor standardization as these parts
 * are already tested in the normal keyword unit tests
 */

describe('Koncorde.keyword.notgeospatial', () => {
  let koncorde;
  let engine;

  beforeEach(() => {
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#storage', () => {
    it('should store a single geospatial keyword correctly', () => {
      const id = koncorde.register({
        not: {
          geoDistance: {
            foo: {
              lat: 13,
              lon: 42,
            },
            distance: '1000m',
          },
        },
      });

      const storage = engine.foPairs.get('notgeospatial');
      const subfilter = Array.from(engine.filters.get(id).subfilters)[0];
      const condId = Array.from(subfilter.conditions)[0].id;

      should(storage).be.instanceOf(FieldOperand);
      should(storage.custom.index).be.an.Object();
      should(storage.fields.get('foo')).be.instanceOf(Map);
      should(storage.fields.get('foo').size).be.eql(1);
      should(storage.fields.get('foo').get(condId)).eql(new Set([subfilter]));
    });

    it('should add another condition to an already tested field', () => {
      const id1 = koncorde.register({
        not: {
          geoDistance: {
            foo: {
              lat: 13,
              lon: 42,
            },
            distance: '1000m',
          },
        },
      });

      const id2 = koncorde.register({
        not: {
          geoBoundingBox: {
            foo: {
              bottom: -14,
              left: 0,
              right: 42,
              top: 13,
            },
          },
        },
      });

      const subfilter1 = Array.from(engine.filters.get(id1).subfilters)[0];
      const subfilter2 = Array.from(engine.filters.get(id2).subfilters)[0];
      const condId1 = Array.from(subfilter1.conditions)[0].id;
      const condId2 = Array.from(subfilter2.conditions)[0].id;
      const storage = engine.foPairs.get('notgeospatial');

      should(storage).be.instanceOf(FieldOperand);
      should(storage.custom.index).be.an.Object();
      should(storage.fields.get('foo')).be.instanceOf(Map);
      should(storage.fields.get('foo').size).be.eql(2);
      should(storage.fields.get('foo').get(condId1)).eql(new Set([subfilter1]));
      should(storage.fields.get('foo').get(condId2)).eql(new Set([subfilter2]));
    });

    it('should add another subfilter to an already tested shape', () => {
      const filter = {
        not: {
          geoDistance: {
            foo: {
              lat: 13,
              lon: 42,
            },
            distance: '1000m',
          },
        },
      };

      const id1 = koncorde.register(filter);
      const id2 = koncorde.register({
        and: [
          { equals: {bar: 'baz' } },
          filter,
        ],
      });

      const storage = engine.foPairs.get('notgeospatial');
      const subfilter = Array.from(engine.filters.get(id1).subfilters)[0];
      const subfilter2 = Array.from(engine.filters.get(id2).subfilters)[0];
      const id = Array.from(subfilter.conditions)[0].id;

      should(storage).be.instanceOf(FieldOperand);
      should(storage.custom.index).be.an.Object();
      should(storage.fields.get('foo')).be.instanceOf(Map);
      should(storage.fields.get('foo').size).be.eql(1);

      should(storage.fields.get('foo').get(id))
        .eql(new Set([subfilter, subfilter2]));
    });
  });

  describe('#match', () => {
    let distanceId;
    let distanceRangeId;
    let polygonId;

    beforeEach(() => {
      koncorde.register({
        not: {
          geoBoundingBox: {
            foo: {
              bottom: 43.5810609,
              left: 3.8433703,
              right: 3.9282093,
              top: 43.6331979,
            },
          },
        },
      });

      distanceId = koncorde.register({
        not: {
          geoDistance: {
            foo: {
              lat: 43.5764455,
              lon: 3.948711
            },
            distance: '2000m',
          }
        }
      });

      distanceRangeId = koncorde.register({
        not: {
          geoDistanceRange: {
            foo: {
              lat: 43.6073913,
              lon: 3.9109057
            },
            from: '10m',
            to: '1500m',
          }
        }
      });

      polygonId = koncorde.register({
        not: {
          geoPolygon: {
            foo: {
              points: [
                { latLon: [ 43.6021299, 3.8989713 ] },
                { latLon: [ 43.6057389, 3.8968173 ] },
                { latLon: [ 43.6092889, 3.8970423 ] },
                { latLon: [ 43.6100359, 3.9040853 ] },
                { latLon: [ 43.6069619, 3.9170343 ] },
                { latLon: [ 43.6076479, 3.9230133 ] },
                { latLon: [ 43.6038779, 3.9239153 ] },
                { latLon: [ 43.6019189, 3.9152403 ] },
                { latLon: [ 43.6036049, 3.9092313 ] },
              ]
            }
          }
        }
      });
    });

    it('should match shapes not containing the provided point', () => {
      let result = koncorde.test({
        foo: {
          lat: 43.6073913,
          lon: 3.9109057,
        },
      });

      should(result.sort()).match([distanceId, distanceRangeId].sort());
    });

    it('should return an empty array if the provided point is invalid', () => {
      should(koncorde.test({ foo: { lat: 'foo', lon: 'bar' } }))
        .be.an.Array().and.be.empty();
    });

    it('should return all subscriptions if the document does not contain the registered field', () => {
      should(koncorde.test({ bar: { lat: 43.6073913, lon: 3.9109057 } }))
        .be.an.Array()
        .and.has.length(4);
    });

    it('should reject a shape if the point is right on its border', () => {
      const result = koncorde.test({
        foo: {
          lat: 43.5810609,
          lon: 3.8433703,
        },
      });

      should(result.sort()).match([distanceId, distanceRangeId, polygonId].sort());
    });
  });

  describe('#removal', () => {
    let filter;
    let filterId;
    let storage;

    beforeEach(() => {
      filter = {
        not: {
          geoBoundingBox: {
            foo: {
              bottom: 43.5810609,
              left: 3.8433703,
              top: 43.6331979,
              right: 3.9282093,
            },
          },
        },
      };

      filterId = koncorde.register(filter);
      storage = engine.foPairs.get('notgeospatial');
    });

    it('should destroy the whole structure when removing the last item', () => {
      koncorde.remove(filterId);
      should(engine.foPairs).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      const id = koncorde.register({
        and: [
          filter,
          { equals: { foo: 'bar' } },
        ],
      });

      const sf = Array.from(engine.filters.get(id).subfilters)[0];
      koncorde.remove(filterId);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(Array.from(sf.conditions)[1].id))
        .match(new Set([sf]));
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const geofilter = {
        not: {
          geoDistance: {
            foo: {
              lat: 43.5764455,
              lon: 3.948711,
            },
            distance: '2000m',
          },
        },
      };

      const id = koncorde.register(geofilter);
      const subfilter = Array.from(engine.filters.get(id).subfilters)[0];
      const condId = Array.from(subfilter.conditions)[0].id;

      koncorde.remove(filterId);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('foo').get(condId)).match(new Set([subfilter]));
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      const geofilter = {
        not: {
          geoDistance: {
            bar: {
              lat: 43.5764455,
              lon: 3.948711,
            },
            distance: '2000m',
          },
        },
      };

      const id = koncorde.register(geofilter);
      const subfilter = Array.from(engine.filters.get(id).subfilters)[0];
      const condId = Array.from(subfilter.conditions)[0].id;
      const operand = engine.foPairs.get('notgeospatial');

      should(operand.fields).have.keys('foo', 'bar');

      koncorde.remove(filterId);

      should(storage).be.instanceOf(FieldOperand);
      should(storage.fields.get('bar').get(condId)).match(new Set([subfilter]));
    });
  });
});
