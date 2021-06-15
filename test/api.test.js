const should = require('should').noConflict();
const sinon = require('sinon');

const { Koncorde } = require('../');
const { hash } = require('../lib/util/hash');

describe('Koncorde API', () => {
  let koncorde;
  let defaultEngine;

  beforeEach(() => {
    koncorde = new Koncorde();
    defaultEngine = koncorde.engines.get(null);
  });

  describe('#prototypes', () => {
    it('should expose the expected methods', () => {
      should(koncorde.validate).be.a.Function();
      should(koncorde.register).be.a.Function();
      should(koncorde.getFilterIds).be.a.Function();
      should(koncorde.test).be.a.Function();
      should(koncorde.remove).be.a.Function();
      should(koncorde.normalize).be.a.Function();
      should(koncorde.store).be.a.Function();
    });
  });

  describe('#constructor', () => {
    it('should throw if an invalid argument is supplied', () => {
      should(() => new Koncorde('foobar')).throw(/Invalid argument: expected an object/);
      should(() => new Koncorde(['foo', 'bar'])).throw(/Invalid argument: expected an object/);

      should(() => new Koncorde({
        seed: 'not a buffer'
      }))
        .throw({message: 'Invalid seed: expected a 32 bytes long Buffer'});

      should(() => new Koncorde({
        seed: require('crypto').randomBytes(24)
      }))
        .throw({message: 'Invalid seed: expected a 32 bytes long Buffer'});

      should(() => new Koncorde({ regExpEngine: 'foo' }))
        .throw({message: 'Invalid configuration value for "regExpEngine". Supported: re2, js'});

      should(() => new Koncorde({ maxConditions: 'foo' }))
        .throw({message: 'Invalid maxConditions configuration: positive or nul integer expected'});

      should(() => new Koncorde({ maxConditions: -1 }))
        .throw({message: 'Invalid maxConditions configuration: positive or nul integer expected'});

      {
        // valid params
        const seed = Buffer.from('01234567890123456789012345678901');
        const engine = new Koncorde({
          seed,
          maxConditions: 3,
          regExpEngine: 'js',
        });

        should(engine.config).eql({
          seed,
          maxConditions: 3,
          regExpEngine: 'js',
        });
      }

    });
  });

  describe('#validate', () => {
    it('should resolve to "true" if a filter is valid', () => {
      should(() => koncorde.validate({ equals: { foo: 'bar' } })).not.throw();
    });

    it('should reject if a filter is not valid', () => {
      should(() => koncorde.validate({ equals: { foo: 'bar' }, exists: 'qux'}))
        .throw();
    });
  });

  describe('#register', () => {
    it('should reject if a filter is not valid', () => {
      should(() => koncorde.register({ foo: 'bar' })).throw();
    });

    it('should resolve to a cluster diff object if the registration succeeds', () => {
      const result = koncorde.register({
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
      const id1 = koncorde.register({
        not: {
          and: [
            { exists: 'bar' },
            { equals: { foo: 'bar' } },
          ],
        },
      });

      const id2 = koncorde.register({
        or: [
          { not: { exists: 'bar' } },
          { not: { equals: { foo: 'bar' } } },
        ],
      });

      const id3 = koncorde.register({
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

      ids.push(koncorde.register({
        or: [
          { equals: { foo: 'bar' } },
          { exists: 'bar' },
        ],
      }));

      const id = koncorde.register({ equals: { foo: 'bar' } });

      const sfs = defaultEngine.filters.get(id).subfilters;

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

      ids.push(koncorde.register({ equals: { foo: 'bar' } }));
      ids.push(koncorde.register({ exists: 'foo' }));

      should(koncorde.getFilterIds().sort()).match(ids.sort());
    });

    it('should return an empty array if the default index is empty', () => {
      should(koncorde.getFilterIds()).be.an.Array().and.be.empty();
    });

    it('should return an empty array if the named index does not exist', () => {
      should(koncorde.getFilterIds('foobar')).be.an.Array().and.be.empty();
    });
  });

  describe('#hasFilterId', () => {
    it('should return false if the filter does not exist', () => {
      should(koncorde.hasFilterId('i dont exist')).be.false();
    });

    it('should return true if the filter exists', () => {
      const id = koncorde.register({ equals: { foo: 'bar' } });
      should(koncorde.hasFilterId(id)).be.true();
    });
  });

  describe('#test', () => {
    it('should return an empty array if the named index does not exist', () => {
      should(koncorde.test({ foo: 'bar' }, 'foobar'))
        .be.an.Array()
        .and.be.empty();
    });

    it('should flatten submitted documents', () => {
      const stub = sinon.stub(defaultEngine, 'match');

      koncorde.register({});
      koncorde.test({
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
    it('should do nothing if the target index does not exist', () => {
      should(koncorde.engines).have.key(null);
      should(koncorde.engines.size).eql(1);

      should(() => koncorde.remove('foo', 'bar')).not.throw();

      should(koncorde.engines).have.key(null);
      should(koncorde.engines.size).eql(1);
    });

    it('should unsubscribe a filter from a multi-filter subfilter', () => {
      const ids = [];

      ids.push(koncorde.register({
        or: [
          { equals: { foo: 'bar' } },
          { exists: { field: 'bar' } },
        ],
      }));

      const id = koncorde.register({ equals: { foo: 'bar' } });
      ids.push(id);

      const sfs = defaultEngine.filters.get(id).subfilters;
      should(sfs).instanceOf(Set);
      should(sfs.size).be.eql(1);

      const sf = Array.from(sfs.values())[0];
      should(sf.filters.size).be.eql(2);

      const filterIds = Array.from(sf.filters).map(f => f.id);
      should(filterIds.sort()).match(Array.from(ids).sort());

      koncorde.remove(id);

      should(sf.filters.size).be.eql(1);
      const fid = Array.from(sf.filters)[0].id;
      should(fid).match(ids[0]);
    });

    it('should unsubscribe from a named index', () => {
      const id1 = koncorde.register({ equals: { foo: 'bar' } }, 'foobar');
      const id2 = koncorde.register({ equals: { foo: 'qux' } }, 'foobar');

      should(koncorde.getFilterIds('foobar')).match([ id1, id2 ]);
      should(koncorde.engines).have.keys(null, 'foobar');
      should(koncorde.engines.size).eql(2);

      // wrong index
      koncorde.remove(id1);

      should(koncorde.getFilterIds('foobar').length).eql(2);
      should(koncorde.engines).have.keys(null, 'foobar');
      should(koncorde.engines.size).eql(2);

      koncorde.remove(id1, 'foobar');

      should(koncorde.getFilterIds('foobar')).match([ id2 ]);
      should(koncorde.engines).have.keys(null, 'foobar');
      should(koncorde.engines.size).eql(2);
    });

    it('should remove an index when the last filter in it is deleted', () => {
      const id1 = koncorde.register({ equals: { foo: 'bar' } }, 'foobar');
      const id2 = koncorde.register({ equals: { foo: 'qux' } }, 'foobar');

      should(koncorde.getFilterIds('foobar')).match([ id1, id2 ]);
      should(koncorde.engines).have.keys(null, 'foobar');
      should(koncorde.engines.size).eql(2);

      // wrong index
      koncorde.remove(id1);

      should(koncorde.getFilterIds('foobar').length).eql(2);
      should(koncorde.engines).have.keys(null, 'foobar');
      should(koncorde.engines.size).eql(2);

      koncorde.remove(id1, 'foobar');
      koncorde.remove(id2, 'foobar');

      should(koncorde.engines).have.keys(null);
      should(koncorde.engines.size).eql(1);
    });

    it('should never remove the default index', () => {
      const id = koncorde.register({ equals: { foo: 'bar' } });

      should(koncorde.getFilterIds()).match([ id ]);
      should(koncorde.engines).have.keys(null);
      should(koncorde.engines.size).eql(1);

      // wrong index
      koncorde.remove(id);

      should(koncorde.getFilterIds().length).eql(0);
      should(koncorde.engines).have.keys(null);
      should(koncorde.engines.size).eql(1);
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
      const n = [];

      sinon.stub(koncorde.transformer, 'normalize').returns(n);

      const normalized = koncorde.normalize(f);

      should(normalized).match({
        filter: n,
        id: hash(koncorde.config.seed, { filter: n, index: null }),
        index: null,
      });

      should(normalized.constructor.name).eql('NormalizedFilter');

      should(koncorde.transformer.normalize.calledOnce).be.true();
      should(koncorde.transformer.normalize.calledWith(f)).be.true();
    });

    it('should return a normalized object taking the provided index into account', () => {
      const n = [];

      sinon.stub(koncorde.transformer, 'normalize').returns(n);

      const normalized = koncorde.normalize({}, 'foobar');

      should(normalized).match({
        filter: n,
        id: hash(koncorde.config.seed, { filter: n, index: 'foobar' }),
        index: 'foobar',
      });

      should(normalized.constructor.name).eql('NormalizedFilter');
    });

    it('should throw if an invalid index name is provided', () => {
      for (const ohnoes of [true, false, 0, 123, {}, []]) {
        // eslint-disable-next-line no-loop-func
        should(() => koncorde.normalize({}, ohnoes))
          .throw('Invalid "index" argument: must be a string');
      }
    });
  });

  describe('#store', () => {
    it('should store the supplied normalized filter', () => {
      const r = koncorde.normalize({});

      sinon.stub(defaultEngine, 'store');

      koncorde.store(r);

      should(defaultEngine.store.calledOnce).be.true();
      should(defaultEngine.store.calledWith(r)).be.true();
    });

    it('should throw when receiving a non-NormalizedFilter object', () => {
      should(() => koncorde.store({}))
        .throw(/Invalid argument/);
    });

    it('should create a new index when subscribing to one for the first time', () => {
      const r = koncorde.normalize({}, 'foo');

      sinon.stub(defaultEngine, 'store');

      koncorde.store(r);

      should(koncorde.engines).have.key('foo');
    });
  });

  describe('#getIndexes', () => {
    it('should always return the default index, and rename it', () => {
      should(koncorde.getIndexes()).match(['(default)']);
    });

    it('should return the list of named indexes alongwith the default one', () => {
      koncorde.register({}, 'foo');
      koncorde.register({}, 'bar');
      koncorde.register({}, 'qux');

      should(koncorde.getIndexes()).match(['(default)', 'foo', 'bar', 'qux']);
    });
  });
});
