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
      const id = dsl.register(geoFilter);
      dsl.remove(id);
      should(foPairs).be.empty();
    });

    it('should remove the entire field if its last condition is removed', () => {
      dsl.register({
        geoDistance: {
          bar: {
            lat: 13,
            lon: 42,
          },
          distance: '1km',
        },
      });

      const id = dsl.register(geoFilter);

      dsl.remove(id);

      const storage = foPairs.get('geospatial');

      should(storage.fields.get('bar')).be.an.Object();
      should(storage.fields.get('foo')).be.undefined();
    });

    it('should remove a single condition from a field if other conditions exist', () => {
      const id1 = dsl.register({
        geoDistance: {
          foo: {
            lat: 13,
            lon: 42,
          },
          distance: '1km',
        },
      });
      const id2 = dsl.register(geoFilter);

      const sf = Array.from(filters.get(id1).subfilters)[0];
      const cond = Array.from(sf.conditions)[0].id;

      dsl.remove(id2);

      const storage = foPairs.get('geospatial');

      should(storage.fields.get('foo').get(cond)).match(new Set([sf]));
    });

    it('should remove a subfilter from a condition if other subfilters exist', () => {
      const id1 = dsl.register(geoFilter);
      const sf = Array.from(filters.get(id1).subfilters)[0];
      const cond = Array.from(sf.conditions)[0].id;

      const id2 = dsl.register({
        and: [
          geoFilter,
          { exists: { field: 'bar' } },
        ],
      });

      dsl.remove(id2);

      const storage = dsl.storage.foPairs.get('geospatial');

      should(storage.fields.get('foo').get(cond)).match(new Set([sf]));
    });
  });
});
