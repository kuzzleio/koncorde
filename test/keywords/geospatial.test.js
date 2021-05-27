const should = require('should/as-function');
const DSL = require('../../');

/**
 * Mutualizes filter removal for all 4 geospatial keywords
 */
describe('DSL.keyword.geospatial', () => {
  let dsl;
  let filters;
  let foPairs;
  const geoFilter = {
    geoBoundingBox: {
      foo: {
        bottom: 43.5810609,
        left: 3.8433703,
        top: 43.6331979,
        right: 3.9282093
      }
    }
  };

  beforeEach(() => {
    dsl = new DSL();
    filters = dsl.storage.filters;
    foPairs = dsl.storage.foPairs;
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const sub = dsl.register('index', 'collection', geoFilter);
      dsl.remove(sub.id);
      should(foPairs._cache).be.empty();
    });

    it('should remove the entire field if its last condition is removed', () => {
      dsl.register('index', 'collection', {
        geoDistance: {
          bar: {
            lat: 13,
            lon: 42,
          },
          distance: '1km',
        },
      });

      const sub = dsl.register('index', 'collection', geoFilter);

      dsl.remove(sub.id);

      const storage = foPairs.get('index', 'collection', 'geospatial');

      should(storage.fields.get('bar')).be.an.Object();
      should(storage.fields.get('foo')).be.undefined();
    });

    it('should remove a single condition from a field if other conditions exist', () => {
      const sub1 = dsl.register('index', 'collection', {
        geoDistance: {
          foo: {
            lat: 13,
            lon: 42,
          },
          distance: '1km',
        },
      });

      const sub2 = dsl.register('index', 'collection', geoFilter);

      const sf = Array.from(filters.get(sub1.id).subfilters)[0];
      const cond = Array.from(sf.conditions)[0].id;

      dsl.remove(sub2.id);

      const storage = foPairs.get('index', 'collection', 'geospatial');

      should(storage.fields.get('foo').get(cond)).match(new Set([sf]));
    });

    it('should remove a subfilter from a condition if other subfilters exist', () => {
      const sub1 = dsl.register('index', 'collection', geoFilter);
      const sf = Array.from(filters.get(sub1.id).subfilters)[0];
      const cond = Array.from(sf.conditions)[0].id;

      const sub2 = dsl.register('index', 'collection', {
        and: [
          geoFilter,
          {exists: {field: 'bar'}},
        ],
      });

      dsl.remove(sub2.id);

      const storage = dsl.storage.foPairs.get('index', 'collection', 'geospatial');

      should(storage.fields.get('foo').get(cond)).match(new Set([sf]));
    });
  });
});
