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
      should(dsl.exists).be.a.Function();
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
        const
          seed = Buffer.from('01234567890123456789012345678901'),
          engine = new Dsl({
            seed,
            maxMinTerms: 3,
            regExpEngine: 'js'
          });

        should(engine.config)
          .eql({
            seed,
            maxMinTerms: 3,
            regExpEngine: 'js'
          });
      }

    });
  });

  describe('#validate', () => {
    it('should resolve to "true" if a filter is valid', () => {
      should(() => dsl.validate({equals: {foo: 'bar'}})).not.throw();
    });

    it('should reject if a filter is not valid', () => {
      should(() => dsl.validate({equals: {foo: 'bar'}, exists: 'qux'})).throw();
    });
  });

  describe('#register', () => {
    it('should reject if a filter is not valid', () => {
      should(() => dsl.register('i', 'c', {foo: 'bar'})).throw();
    });

    it('should resolve to a cluster diff object if the registration succeeds', () => {
      const result = dsl.register('i', 'c', {
        not: {
          and: [
            {exists: 'bar'},
            {equals: {foo: 'bar'}},
          ],
        },
      });

      should(result).be.an.Object();
      should(result.diff).be.an.Object().and.match({
        index: 'i',
        collection: 'c',
        filters: [
          [ { exists: { path: 'bar', array: false, value: null }, not: true } ],
          [ { equals: { foo: 'bar' }, not: true } ]
        ]
      });

      should(result.id).be.a.String();
    });

    it('should resolve to a "no diff" object if the room already exists', () => {
      let result = dsl.register('i', 'c', {
        not: {
          and: [
            {exists: 'bar'},
            {equals: {foo: 'bar'}},
          ],
        },
      });

      const id = result.id;

      result = dsl.register('i', 'c', {
        or: [
          {not: { exists: 'bar'}},
          {not: { equals: { foo: 'bar' }}},
        ],
      });

      const bool = {
        bool: {
          should_not: [
            {exists: { field: 'bar' }},
            {equals: { foo: 'bar' }}
          ]
        }
      };

      should(result.diff)
        .eql({
          index: 'i',
          collection: 'c',
          filters: [
            [ {exists: {path: 'bar', array: false, value: null}, not: true}],
            [ {equals: {foo: 'bar'}, not: true}],
          ],
        });
      should(result.id).be.eql(id);

      result = dsl.register('i', 'c', bool);

      should(result.id).be.eql(id);
    });

    it('should not recreate an already existing subfilter', () => {
      let ids = [];

      let subscription = dsl.register('i', 'c', {
        or: [
          {equals: {foo: 'bar'}},
          {exists: 'bar'},
        ],
      });

      ids.push(subscription.id);

      subscription = dsl.register('i', 'c', {equals: {foo: 'bar'}});

      const sfs = dsl.storage.filters.get(subscription.id).subfilters;

      ids.push(subscription.id);
      should(sfs).instanceOf(Set);
      should(sfs.size).be.eql(1);

      const filterIds = [];

      for (const sf of sfs.values()) {
        sf.filters.forEach(f => filterIds.push(f.id));
      }

      should(filterIds.sort()).match(ids.sort());
    });
  });

  describe('#exists', () => {
    it('should return true if a filter exists on the provided index and collection', () => {
      should(dsl.exists('i', 'c')).be.false();

      dsl.register('i', 'c', {equals: {foo: 'bar'}});
      should(dsl.exists('i', 'c')).be.true();
    });

    it('should return false if no filter exists on a provided collection', () => {
      dsl.register('i', 'c', {equals: {foo: 'bar'}});
      should(dsl.exists('i', 'foo')).be.false();
    });

    it('should return false if no filter exists on a provided index', () => {
      dsl.register('i', 'c', {equals: {foo: 'bar'}});
      should(dsl.exists('foo', 'c')).be.false();
    });
  });

  describe('#getFilterIds', () => {
    it('should return an empty array if no filter exist on the provided index and collection', () => {
      dsl.register('i', 'c', {equals: {foo: 'bar'}});
      should(dsl.getFilterIds('foo', 'bar')).be.an.Array().and.be.empty();
    });

    it('should return the list of registered filter IDs on the provided index and collection', () => {
      let ids = [];

      let result = dsl.register('i', 'c', {equals: {foo: 'bar'}});
      ids.push(result.id);

      result = dsl.register('i', 'c', {exists: 'foo'});
      ids.push(result.id);

      should(dsl.getFilterIds('i', 'c').sort()).match(ids.sort());
    });
  });

  describe('#getIndexes', () => {
    it('should return an empty array if no filter exist on the provided index and collection', () => {
      should(dsl.getIndexes()).be.an.Array().and.be.empty();
    });

    it('should return the list of registered indexes on the provided index and collection', () => {
      dsl.register('i', 'c', {equals: {foo: 'bar'}});
      dsl.register('i', 'c', {exists: 'foo'});
      dsl.register('i2', 'c', {exists: 'foo'});

      should(dsl.getIndexes().sort()).match(['i', 'i2']);
    });
  });

  describe('#getCollections', () => {
    it('should return an empty array if no filter exist on the provided index and collection', () => {
      dsl.register('i', 'c', {equals: {foo: 'bar'}});
      should(dsl.getCollections('foo')).be.an.Array().and.be.empty();
    });

    it('should return the list of registered collections on the provided index and collection', () => {
      dsl.register('i', 'c', {equals: {foo: 'bar'}});
      dsl.register('i', 'c', {exists: 'foo'});
      dsl.register('i', 'c2', {exists: 'foo'});
      should(dsl.getCollections('i').sort()).match(['c', 'c2']);
    });
  });

  describe('#hasFilter', () => {
    it('should return false if the filter does not exist', () => {
      should(dsl.hasFilter('i dont exist')).be.false();
    });

    it('should return true if the filter exists', () => {
      const response = dsl.register('i', 'c', {equals: {foo: 'bar'}});
      should(dsl.hasFilter(response.id)).be.true();
    });
  });

  describe('#test', () => {
    /*
     we only check the special case of no registered filter on the provided
     index and collection, as all other checks are performed in
     test/api/dsl/keywords unit tests files
     */
    it('should return an empty array if there is no filter registered on an index or collection', () => {
      should(dsl.test('i', 'c', {foo: 'bar'})).be.an.Array().and.be.empty();
    });

    it('should flatten submitted documents', () => {
      const stub = sinon.stub(dsl.matcher, 'match');

      dsl.register('i', 'c', {});
      dsl.test('i', 'c', {
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

      should(stub.calledWith('i', 'c', {
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
      should(dsl._removeFromTestTables)
        .have.callCount(0);
    });

    it('should unsubscribe a filter from a multi-filter subfilter', () => {
      const ids = [];

      let subscription = dsl.register('i', 'c', {
        or: [
          {equals: {foo: 'bar'}},
          {exists: {field: 'bar'}},
        ],
      });

      ids.push(subscription.id);
      subscription = dsl.register('i', 'c', {equals: {foo: 'bar'}});

      const sfs = dsl.storage.filters.get(subscription.id).subfilters;

      ids.push(subscription.id);
      should(sfs).instanceOf(Set);
      should(sfs.size).be.eql(1);

      const sf = Array.from(sfs.values())[0];
      should(sf.filters.size).be.eql(2);

      const filterIds = Array.from(sf.filters).map(f => f.id);
      should(filterIds.sort()).match(Array.from(ids).sort());

      dsl.remove(subscription.id);

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
            {exists: {field: 'bar'}},
            {equals: {foo: 'bar'}},
          ],
        },
      };
      const n = {};

      sinon.stub(dsl.transformer, 'normalize').returns(n);
      sinon.stub(dsl.storage, 'getFilterId');

      dsl.normalize('i', 'c', f);

      should(dsl.transformer.normalize.calledOnce).be.true();
      should(dsl.transformer.normalize.calledWith(f)).be.true();

      should(dsl.storage.getFilterId.calledOnce).be.true();
      should(dsl.storage.getFilterId).calledWith('i', 'c', n);
    });
  });

  describe('#store', () => {
    it('should store the supplied normalized filter', () => {
      const r = {
        index: 'i',
        collection: 'c',
        id: 'id',
        normalized: {}
      };

      sinon.stub(dsl.storage, 'store');

      dsl.store(r);

      should(dsl.storage.store.calledOnce).be.true();
      should(dsl.storage.store.calledWith(r.index, r.collection, r.normalized, r.id)).be.true();
    });
  });
});
