require('reify');

const should = require('should').noConflict();

const Dsl = require('../');
const sinon = require('sinon');

describe('DSL API', () => {
  let dsl;

  beforeEach(() => {
    dsl = new Dsl();
  });

  describe('#prototypes', () => {
    it('should expose the expected methods', () => {
      should(dsl.validate).be.a.Function();
      should(dsl.register).be.a.Function();
      should(dsl.getFilterIds).be.a.Function();
      should(dsl.test).be.a.Function();
      should(dsl.remove).be.a.Function();
      should(dsl.normalize).be.a.Function();
      should(dsl.store).be.a.Function();
    });
  });

  describe('#constructor', () => {
    it('should throw if an invalid argument is supplied', () => {
      should(() => new Dsl('foobar')).throw(/Invalid argument: expected an object/);
      should(() => new Dsl(['foo', 'bar'])).throw(/Invalid argument: expected an object/);

      should(() => new Dsl({
        seed: 'not a buffer'
      }))
        .throw({message: 'Invalid seed: expected a 32 bytes long Buffer'});

      should(() => new Dsl({
        seed: require('crypto').randomBytes(24)
      }))
        .throw({message: 'Invalid seed: expected a 32 bytes long Buffer'});

      should(() => new Dsl({ regExpEngine: 'foo' }))
        .throw({message: 'Invalid configuration value for "regExpEngine". Supported: re2, js'});

      {
        // valid params
        const seed = Buffer.from('01234567890123456789012345678901');
        const engine = new Dsl({
          seed,
          maxMinTerms: 3,
          regExpEngine: 'js',
        });

        should(engine.config).eql({
          seed,
          maxMinTerms: 3,
          regExpEngine: 'js',
        });
      }

    });
  });

  describe('#validate', () => {
    it('should resolve to "true" if a filter is valid', () => {
      should(() => dsl.validate({ equals: { foo: 'bar' } })).not.throw();
    });

    it('should reject if a filter is not valid', () => {
      should(() => dsl.validate({ equals: { foo: 'bar' }, exists: 'qux'}))
        .throw();
    });
  });

  describe('#register', () => {
    it('should reject if a filter is not valid', () => {
      should(() => dsl.register({ foo: 'bar' })).throw();
    });

    it('should resolve to a cluster diff object if the registration succeeds', () => {
      const result = dsl.register({
        not: {
          and: [
            { exists: 'bar' },
            { equals: { foo: 'bar' } },
          ],
        },
      });

      should(result).be.a.String();
    });

    it('should resolve to the same id for equivalent filters', () => {
      const id1 = dsl.register({
        not: {
          and: [
            { exists: 'bar' },
            { equals: { foo: 'bar' } },
          ],
        },
      });

      const id2 = dsl.register({
        or: [
          { not: { exists: 'bar' } },
          { not: { equals: { foo: 'bar' } } },
        ],
      });

      const id3 = dsl.register({
        bool: {
          should_not: [
            { exists: { field: 'bar' } },
            { equals: { foo: 'bar' } }
          ]
        }
      });

      should(id1).eql(id2);
      should(id1).eql(id3);
    });

    it('should not recreate an already existing subfilter', () => {
      const ids = [];

      ids.push(dsl.register({
        or: [
          { equals: { foo: 'bar' } },
          { exists: 'bar' },
        ],
      }));

      const id = dsl.register({ equals: { foo: 'bar' } });

      const sfs = dsl.storage.filters.get(id).subfilters;

      ids.push(id);
      should(sfs).instanceOf(Set);
      should(sfs.size).be.eql(1);

      const filterIds = [];

      for (const sf of sfs.values()) {
        sf.filters.forEach(f => filterIds.push(f.id));
      }

      should(filterIds.sort()).match(ids.sort());
    });
  });

  describe('#getFilterIds', () => {
    it('should return the list of registered filter IDs', () => {
      const ids = [];

      ids.push(dsl.register({ equals: { foo: 'bar' } }));
      ids.push(dsl.register({ exists: 'foo' }));

      should(dsl.getFilterIds().sort()).match(ids.sort());
    });
  });

  describe('#hasFilter', () => {
    it('should return false if the filter does not exist', () => {
      should(dsl.hasFilter('i dont exist')).be.false();
    });

    it('should return true if the filter exists', () => {
      const id = dsl.register({ equals: { foo: 'bar' } });
      should(dsl.hasFilter(id)).be.true();
    });
  });

  describe('#test', () => {
    /*
     we only check the special case of no registered filter on the provided
     index and collection, as all other checks are performed in
     test/api/dsl/keywords unit tests files
     */
    it('should return an empty array if there is no filter registered', () => {
      should(dsl.test({ foo: 'bar' })).be.an.Array().and.be.empty();
    });

    it('should flatten submitted documents', () => {
      const stub = sinon.stub(dsl.matcher, 'match');

      dsl.register({});
      dsl.test({
        bar: 'bar',
        qux: 'qux',
        obj: {
          hello: 'world',
          nested: {
            another: 'one',
            bites: 'the dust'
          },
          bottlesOfBeer: 99
        },
        arr: ['foo', 'bar'],
        foo: 'bar'
      });

      should(stub.calledWith({
        bar: 'bar',
        qux: 'qux',
        obj: {
          hello: 'world',
          nested: {
            another: 'one',
            bites: 'the dust'
          },
          bottlesOfBeer: 99
        },
        'obj.hello': 'world',
        'obj.nested': {
          another: 'one',
          bites: 'the dust'
        },
        'obj.nested.another': 'one',
        'obj.nested.bites': 'the dust',
        'obj.bottlesOfBeer': 99,
        arr: ['foo', 'bar'],
        foo: 'bar'
      })).be.true();
    });
  });

  describe('#remove', () => {
    it('should do nothing if the filter id does not exist', () => {
      dsl._removeFromTestTables = sinon.spy();

      dsl.remove('foo');
      should(dsl._removeFromTestTables).not.called();
    });

    it('should unsubscribe a filter from a multi-filter subfilter', () => {
      const ids = [];

      ids.push(dsl.register({
        or: [
          { equals: { foo: 'bar' } },
          { exists: { field: 'bar' } },
        ],
      }));

      const id = dsl.register({ equals: { foo: 'bar' } });
      ids.push(id);

      const sfs = dsl.storage.filters.get(id).subfilters;
      should(sfs).instanceOf(Set);
      should(sfs.size).be.eql(1);

      const sf = Array.from(sfs.values())[0];
      should(sf.filters.size).be.eql(2);

      const filterIds = Array.from(sf.filters).map(f => f.id);
      should(filterIds.sort()).match(Array.from(ids).sort());

      dsl.remove(id);

      should(sf.filters.size).be.eql(1);
      const fid = Array.from(sf.filters)[0].id;
      should(fid).match(ids[0]);
    });
  });

  describe('#normalize', () => {
    it('should invoke the normalizer', () => {
      const f = {
        not: {
          and: [
            { exists: { field: 'bar' } },
            { equals: { foo: 'bar' } },
          ],
        },
      };
      const n = {};

      sinon.stub(dsl.transformer, 'normalize').returns(n);
      sinon.stub(dsl.storage, 'getFilterId');

      dsl.normalize(f);

      should(dsl.transformer.normalize.calledOnce).be.true();
      should(dsl.transformer.normalize.calledWith(f)).be.true();

      should(dsl.storage.getFilterId.calledOnce).be.true();
      should(dsl.storage.getFilterId).calledWith(n);
    });
  });

  describe('#store', () => {
    it('should store the supplied normalized filter', () => {
      const r = {
        id: 'id',
        normalized: {}
      };

      sinon.stub(dsl.storage, 'store');

      dsl.store(r);

      should(dsl.storage.store.calledOnce).be.true();
      should(dsl.storage.store.calledWith(r.normalized, r.id)).be.true();
    });
  });
});
