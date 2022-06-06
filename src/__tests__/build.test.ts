/* istanbul ignore file */
import setup from './setup';

const { stepFunctionsOfflinePlugin, StepFunctionsOfflinePlugin, serverless } = setup();

describe('build.js', () => {
  describe('#findFunctionsPathAndHandler()', () => {
    stepFunctionsOfflinePlugin.serverless.config.servicePath = process.cwd() + '/src/__tests__';
    it('should throw err - can not read property', async () => {
      stepFunctionsOfflinePlugin.variables = { FirstLambda: 'firstLamda' };
      await stepFunctionsOfflinePlugin.hooks[global['hooks'].findState]();
      await stepFunctionsOfflinePlugin.hooks[global['hooks'].loadEventFile]();
      try {
        const res = await stepFunctionsOfflinePlugin.hooks[global['hooks'].buildStepWorkFlow]();
        console.log(res);
        expect(res).toBeUndefined();
      } catch (err) {
        expect((err as Error).message).toEqual('Function "FirstLambda" does not presented in serverless manifest');
      }
    });

    it('should not throw err', async () => {
      const SFOP = new StepFunctionsOfflinePlugin(
        serverless,
        {
          ...global['options'],
          location: '/src/__tests__',
        },
        logging
      );
      SFOP.variables = { FirstLambda: 'firstLambda' };
      SFOP._getLocation();
      await SFOP.hooks[global['hooks'].findState]();
      await SFOP.hooks[global['hooks'].loadEventFile]();
      await SFOP.hooks[global['hooks'].buildStepWorkFlow]();
    });
  });

  // describe('#buildStepWorkFlow()', () => {
  //
  //
  //
  // });
});
