const should = require('should/as-function');

const Canonical = require('../../lib/transform/canonical');

describe('api/dsl/transform/canonical', () => {
  let canonical;

  beforeEach(() => {
    canonical = new Canonical({});
  });

  describe('_removeImpossiblePredicates', () => {
    it ('foo === A && foo === B', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {equals: {foo: 'bar'}, not: false},
          {equals: {foo: 'baz'}, not: false},
          {exists: {path: 'anotherfield', array: false}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo === A && foo does not exist', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {equals: {foo: 'bar'}, not: false},
          {exists: {path: 'foo', array: true, value: 'bar'}, not: true},
          {exists: 'anotherField', not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo does not exist && foo === A', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {exists: {path: 'foo', array: false, value: null}, not: true},
          {equals: {foo: 'bar'}, not: false},
          {exists: 'anotherField', not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo exists && foo does not exist', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {exists: {path: 'foo', array: true, value: 42}, not: false},
          {exists: {path: 'foo', array: false, value: null}, not: true},
          {exists: 'anotherField', not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo does not exist && foo exists', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {exists: {path: 'foo', array: true, value: 42}, not: true},
          {exists: {path: 'foo', array: false, value: null}, not: false},
          {exists: 'anotherField', not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo === A && foo !== A', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {equals: {foo: 'bar'}, not: true},
          {equals: {foo: 'bar'}, not: false},
          {exists: {path: 'foo', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo !== A && foo === A', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {equals: {foo: 'bar'}, not: false},
          {equals: {foo: 'bar'}, not: true},
          {exists: {path: 'foo', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo === 9 && foo < 5', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {range: {foo: {lt: 5}}, not: false},
          {equals: {foo: 9}, not: false},
          {exists: {path: 'anotherfield', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo < 5 && foo === 9', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {equals: {foo: 9}, not: false},
          {range: {foo: {lt: 5}}, not: false},
          {exists: {path: 'anotherfield', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo === 9 && foo <= 5', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {range: {foo: {lte: 5}}, not: false},
          {equals: {foo: 9}, not: false},
          {exists: {path: 'anotherfield', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo <= 5 && foo === 9', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {equals: {foo: 9}, not: false},
          {range: {foo: {lte: 5}}, not: false},
          {exists: {path: 'anotherfield', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo == 9 && foo > 10', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {range: {foo: {gt: 10}}, not: false},
          {equals: {foo: 9}, not: false},
          {exists: {path: 'anotherfield', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo > 10 && foo == 9', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {equals: {foo: 9}, not: false},
          {range: {foo: {gt: 10}}, not: false},
          {exists: {path: 'anotherfield', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo == 9 && foo >= 10', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {range: {foo: {gte: 10}}, not: false},
          {equals: {foo: 9}, not: false},
          {exists: {path: 'anotherfield', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('foo >= 10 && foo == 9', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [ {equals: {foo: 'bar'}, not: false} ],
        [
          {equals: {foo: 9}, not: false},
          {range: {foo: {gte: 10}}, not: false},
          {exists: {path: 'anotherfield', array: false, value: null}, not: false}
        ]
      ]);

      should(filtered)
        .eql([
          [ {equals: {foo: 'bar'}, not: false} ]
        ]);
    });

    it('should return a single "nothing" operator if all clauses are anti-totologies', () => {
      const filtered = canonical._removeImpossiblePredicates([
        [
          {equals: {foo: 1}, not: false},
          {equals: {foo: 2}, not: false}
        ],
        [
          {exists: {path: 'bar', array: false, value: null}, not: false},
          {exists: {path: 'bar', array: true, value: 'qux'}, not: true}
        ]
      ]);

      should(filtered)
        .eql([[{nothing: true}]]);
    });
  });

});
