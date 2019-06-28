'use strict';

/* eslint-disable no-console */

const
  Benchmark = require('benchmark'),
  georandom = require('geojson-random'),
  {
    MersenneTwister19937,
    string: randomStringEngine,
    integer: randomIntegerEngine
  } = require('random-js'),
  Bluebird = require('bluebird'),
  Koncorde = require('.'),
  v8 = require('v8');

const
  max = 10000,
  engine = MersenneTwister19937.autoSeed(),
  rgen = {
    string: randomStringEngine(),
    int: randomIntegerEngine(-10000, 10000)
  };

let filters = [];
const koncorde = new Koncorde();

const matching = (name, document) => {
  const suite = new Benchmark.Suite();

  suite
    .add('\tMatching', () => {
      koncorde.test('i', name, document);
    })
    .on('cycle', event => {
      console.log(String(event.target));
      removeFilters();
    })
    .run({async: false});
};

function removeFilters() {
  const removalStart = Date.now();

  for (const filter of filters) {
    koncorde.remove(filter);
  }

  filters = [];
  console.log(`\tFilters removal: time = ${(Date.now() - removalStart)/1000}s`);
}

const test = Bluebird.coroutine(function *_register(name, generator, document) {
  let i,
    filterStartTime,
    filterEndTime;

  const baseHeap = v8.getHeapStatistics().total_heap_size;

  console.log(`\n> Benchmarking keyword: ${name}`);
  filterStartTime = Date.now();

  for (i = 0;i < max; i++) {
    // Using the filter name as a collection to isolate
    // benchmark calculation per keyword
    filters.push((yield koncorde.register('i', name, generator())).id);
  }

  filterEndTime = (Date.now() - filterStartTime) / 1000;
  console.log(`\tIndexation: time = ${filterEndTime}s, mem = +${Math.round((v8.getHeapStatistics().total_heap_size - baseHeap) / 1024 / 1024)}MB`);

  matching(name, document);
});

console.log(`Filter count per tested keyword: ${max}`);

test('equals', () => ({equals: {str: rgen.string(engine, 20)}}), {str: rgen.string(engine, 20)})
  .then(() => test('exists', () => ({exists: {field: rgen.string(engine, 20)}}), {[rgen.string(engine, 20)]: true}))
  .then(() => {
    return test('geoBoundingBox', () => {
      const pos = georandom.position();

      return {
        geoBoundingBox: {
          point: {
            top: pos[1],
            left: pos[0],
            right: pos[0] + .5,
            bottom: pos[1] - .5
          }
        }
      };
    }, {
      point: [0, 0]
    });
  })
  .then(() => {
    return test('geoDistance', () => {
      const pos = georandom.position();

      return {
        geoDistance: {
          point: [pos[1], pos[0]],
          distance: '500m'
        }
      };
    }, {
      point: [0, 0]
    });
  })
  .then(() => {
    return test('geoDistanceRange', () => {
      const pos = georandom.position();

      return {
        geoDistanceRange: {
          point: [pos[1], pos[0]],
          from: '500m',
          to: '1km'
        }
      };
    }, {
      point: [0, 0]
    });
  })
  .then(() => {
    return test('geoPolygon (10 vertices)', () => {
      const polygon = georandom.polygon(1).features[0].geometry.coordinates[0].map(c => [c[1], c[0]]);

      return {
        geoPolygon: {
          point: {
            points: polygon
          }
        }
      };
    }, {
      point: [0, 0]
    });
  })
  .then(() => {
    return test('in (5 random values)', () => {
      const values = [];
      let i;

      for(i = 0; i < 5; i++) {
        values.push(rgen.string(engine, 20));
      }

      return {in: {str: values}};
    }, {
      str: rgen.string(engine, 20)
    });
  })
  .then(() => {
    return test('range (random bounds)', () => {
      const bound = rgen.int(engine);

      return {
        range: {
          integer: {
            gte: bound,
            lte: bound + 100
          }
        }
      };
    }, {
      integer: rgen.int(engine)
    });
  });
