const should = require('should/as-function');

const FieldOperand = require('../../lib/storage/objects/fieldOperand');
const DSL = require('../../');

/**
 * Tests not geoBoundingBox, not geoDistance, not geoDistanceRange
 * and not geoPolygon keywords
 *
 * Does not check filter validation nor standardization as these parts
 * are already tested in the normal keyword unit tests
 */

describe('DSL.keyword.notgeospatial', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#storage', () => {
    it('should store a single geospatial keyword correctly', () => {
      return dsl.register('index', 'collection', {not: {geoDistance: {foo: {lat: 13, lon: 42}, distance: '1000m'}}})
        .then(subscription => {
          const
            storage = dsl.storage.foPairs.get('index', 'collection', 'notgeospatial'),
            subfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            id = Array.from(subfilter.conditions)[0].id;

          should(storage).be.instanceOf(FieldOperand);
          should(storage.custom.index).be.an.Object();
          should(storage.fields.get('foo')).be.instanceOf(Map);
          should(storage.fields.get('foo').size).be.eql(1);
          should(storage.fields.get('foo').get(id)).eql(new Set([subfilter]));
        });
    });

    it('should add another condition to an already tested field', () => {
      let id1, subfilter1;

      return dsl.register('index', 'collection', {not: {geoDistance: {foo: {lat: 13, lon: 42}, distance: '1000m'}}})
        .then(subscription => {
          subfilter1 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          id1 = Array.from(subfilter1.conditions)[0].id;

          return dsl.register('index', 'collection', {not: {geoBoundingBox: {foo: {top: 13, left: 0, right: 42, bottom: -14}}}});
        })
        .then(subscription => {
          const
            subfilter2 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0],
            id2 = Array.from(subfilter2.conditions)[0].id,
            storage = dsl.storage.foPairs.get('index', 'collection', 'notgeospatial');

          should(storage).be.instanceOf(FieldOperand);
          should(storage.custom.index).be.an.Object();
          should(storage.fields.get('foo')).be.instanceOf(Map);
          should(storage.fields.get('foo').size).be.eql(2);
          should(storage.fields.get('foo').get(id1)).eql(new Set([subfilter1]));
          should(storage.fields.get('foo').get(id2)).eql(new Set([subfilter2]));
        });
    });

    it('should add another subfilter to an already tested shape', () => {
      let
        filter = {not: {geoDistance: {foo: {lat: 13, lon: 42}, distance: '1000m'}}},
        id,
        subfilter;

      return dsl.register('index', 'collection', filter)
        .then(subscription => {
          subfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          id = Array.from(subfilter.conditions)[0].id;

          return dsl.register('index', 'collection', {and: [{equals: {bar: 'baz'}}, filter]});
        })
        .then(subscription => {
          const
            storage = dsl.storage.foPairs.get('index', 'collection', 'notgeospatial'),
            subfilter2 = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];

          should(storage).be.instanceOf(FieldOperand);
          should(storage.custom.index).be.an.Object();
          should(storage.fields.get('foo')).be.instanceOf(Map);
          should(storage.fields.get('foo').size).be.eql(1);
          should(storage.fields.get('foo').get(id)).eql(new Set([subfilter, subfilter2]));
        });
    });
  });

  describe('#match', () => {
    let
      distanceId,
      distanceRangeId,
      polygonId;

    beforeEach(() => {
      return dsl.register('index', 'collection', {not: {geoBoundingBox: {foo: {bottom: 43.5810609, left: 3.8433703, top: 43.6331979, right: 3.9282093}}}})
        .then(() => {
          return dsl.register('index', 'collection', {
            not: {
              geoDistance: {
                foo: {
                  lat: 43.5764455,
                  lon: 3.948711
                },
                distance: '2000m'
              }
            }
          });
        })
        .then(subscription => {
          distanceId = subscription.id;
          return dsl.register('index', 'collection', {
            not: {
              geoDistanceRange: {
                foo: {
                  lat: 43.6073913,
                  lon: 3.9109057
                },
                from: '10m',
                to: '1500m'
              }
            }
          });
        })
        .then(subscription => {
          distanceRangeId = subscription.id;
          return dsl.register('index', 'collection', {
            not: {
              geoPolygon: {
                foo: {
                  points: [
                    {latLon: [43.6021299, 3.8989713]},
                    {latLon: [43.6057389, 3.8968173]},
                    {latLon: [43.6092889, 3.8970423]},
                    {latLon: [43.6100359, 3.9040853]},
                    {latLon: [43.6069619, 3.9170343]},
                    {latLon: [43.6076479, 3.9230133]},
                    {latLon: [43.6038779, 3.9239153]},
                    {latLon: [43.6019189, 3.9152403]},
                    {latLon: [43.6036049, 3.9092313]}
                  ]
                }
              }
            }
          });
        })
        .then(subscription => {
          polygonId = subscription.id;
        });
    });

    it('should match shapes not containing the provided point', () => {
      let result = dsl.test('index', 'collection', {foo: {lat: 43.6073913, lon: 3.9109057}});
      should(result.sort()).match([distanceId, distanceRangeId].sort());
    });

    it('should return an empty array if the provided point is invalid', () => {
      should(dsl.test('index', 'collection', {foo: {lat: 'foo', lon: 'bar'}})).be.an.Array().and.be.empty();
    });

    it('should return all subscriptions if the document does not contain the registered field', () => {
      should(dsl.test('index', 'collection', {bar: {lat: 43.6073913, lon: 3.9109057}}))
        .be.an.Array()
        .and.has.length(4);
    });

    it('should reject a shape if the point is right on its border', () => {
      let result = dsl.test('index', 'collection', {foo: {lat: 43.5810609, lon: 3.8433703}});
      should(result.sort()).match([distanceId, distanceRangeId, polygonId].sort());
    });
  });

  describe('#removal', () => {
    let filter, filterId, storage;

    beforeEach(() => {
      filter = {not: {geoBoundingBox: {foo: {bottom: 43.5810609, left: 3.8433703, top: 43.6331979, right: 3.9282093}}}};
      return dsl.register('index', 'collection', filter)
        .then(subscription => {
          filterId = subscription.id;
          storage = dsl.storage.foPairs.get('index', 'collection', 'notgeospatial');
        });
    });

    it('should destroy the whole structure when removing the last item', () => {
      dsl.remove(filterId);
      should(dsl.storage.foPairs._cache).be.empty();
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let sf;

      return dsl.register('index', 'collection', {and: [filter, {equals: {foo: 'bar'}}]})
        .then(subscription => {
          sf = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          return dsl.remove(filterId);
        })
        .then(() => {
          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').get(Array.from(sf.conditions)[1].id)).match(new Set([sf]));
        });
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      const geofilter = {
        not: {
          geoDistance: {
            foo: {
              lat: 43.5764455,
              lon: 3.948711
            },
            distance: '2000m'
          }
        }
      };

      let id, subfilter;
      return dsl.register('index', 'collection', geofilter)
        .then(subscription => {
          subfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          id = Array.from(subfilter.conditions)[0].id;
          return dsl.remove(filterId);
        })
        .then(() => {
          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('foo').get(id)).match(new Set([subfilter]));
        });
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      const geofilter = {
        not: {
          geoDistance: {
            bar: {
              lat: 43.5764455,
              lon: 3.948711
            },
            distance: '2000m'
          }
        }
      };

      let id, subfilter;
      return dsl.register('index', 'collection', geofilter)
        .then(subscription => {
          subfilter = Array.from(dsl.storage.filters.get(subscription.id).subfilters)[0];
          id = Array.from(subfilter.conditions)[0].id;

          const operand = dsl.storage.foPairs
            .get('index', 'collection', 'notgeospatial');

          should(operand.fields).have.keys('foo', 'bar');
          return dsl.remove(filterId);
        })
        .then(() => {
          should(storage).be.instanceOf(FieldOperand);
          should(storage.fields.get('bar').get(id)).match(new Set([subfilter]));
        });
    });
  });
});
