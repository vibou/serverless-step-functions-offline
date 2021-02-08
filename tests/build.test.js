'use strict';
const Serverless = require('serverless/lib/Serverless');
const CLI = require('serverless/lib/classes/CLI');

describe('build.js', () => {
  describe('#findFunctionsPathAndHandler()', () => {
    it('should throw err - can not read property', done => {
      stepFunctionsOfflinePlugin.variables = { FirstLambda: 'firstLamda' };
      stepFunctionsOfflinePlugin.hooks[hooks.buildStepWorkFlow]()
        .then(res => {
          expect(res).toBeUndefined();
        })
        .catch(err => {
          expect(err).toThrowError(/Cannot read property/);
        })
        .finally(done);
    });

    it('should throw err - goody', done => {
      stepFunctionsOfflinePlugin.variables = { FirstLambda: 'firstLambda' };
      stepFunctionsOfflinePlugin.hooks[hooks.buildStepWorkFlow]()
        .then(res => {
          console.log(111);
        })
        .catch(err => {
          console.log(222);
        })
        .finally(done);
    });
  });

  // describe('#buildStepWorkFlow()', () => {
  //
  //
  //
  // });
});
