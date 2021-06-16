const should = require('should/as-function');
const { Koncorde } = require('../../');

/**
 * Mutualizes filter removal for all 4 geospatial keywords
 */
describe('Koncorde.keyword.geospatial', () => {
  let koncorde;
  let engine;
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
    koncorde = new Koncorde();
    engine = koncorde.engines.get(null);
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      const id = koncorde.register(geoFilter);
      koncorde.remove(id);
      should(engine.foPairs).be.empty();
    });

    it('should remove the entire field if its last condition is removed', () => {
      koncorde.register({
        geoDistance: {
          bar: {
            lat: 13,
            lon: 42,
          },
          distance: '1km',
        },
      });

      const id = koncorde.register(geoFilter);

      koncorde.remove(id);

      const storage = engine.foPairs.get('geospatial');

      should(storage.fields.get('bar')).be.an.Object();
      should(storage.fields.get('foo')).be.undefined();
    });

    it('should remove a single condition from a field if other conditions exist', () => {
      const id1 = koncorde.register({
        geoDistance: {
          foo: {
            lat: 13,
            lon: 42,
          },
          distance: '1km',
        },
      });
      const id2 = koncorde.register(geoFilter);

      const sf = Array.from(engine.filters.get(id1).subfilters)[0];
      const cond = Array.from(sf.conditions)[0].id;

      koncorde.remove(id2);

      const storage = engine.foPairs.get('geospatial');

      should(storage.fields.get('foo').get(cond)).match(new Set([sf]));
    });

    it('should remove a subfilter from a condition if other subfilters exist', () => {
      const id1 = koncorde.register(geoFilter);
      const sf = Array.from(engine.filters.get(id1).subfilters)[0];
      const cond = Array.from(sf.conditions)[0].id;

      const id2 = koncorde.register({
        and: [
          geoFilter,
          { exists: { field: 'bar' } },
        ],
      });

      koncorde.remove(id2);

      const storage = engine.foPairs.get('geospatial');

      should(storage.fields.get('foo').get(cond)).match(new Set([sf]));
    });
  });
});
