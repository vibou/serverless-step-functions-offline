import setup from './setup';

const { stepFunctionsOfflinePlugin, StepFunctionsOfflinePlugin, serverless } = setup();

describe('index.js', () => {
  afterEach(() => {
    // sandbox.restore();
  });

  describe('Constructor()', () => {
    it('should have hooks', () => expect(Object.keys(stepFunctionsOfflinePlugin.hooks)).not.toHaveLength(0));

    it('should have commands', () =>
      expect(Object.keys(stepFunctionsOfflinePlugin?.commands ?? {})).not.toHaveLength(0));
  });

  describe('#checkVariableInYML', () => {
    it('should throw error - custom.stepFunctionsOffline does not exist', () => {
      expect(stepFunctionsOfflinePlugin.hooks[global['hooks'].start]).toThrowError(/ENV_VARIABLES/);
    });

    it('should exists custom.stepFunctionsOffline', () => {
      stepFunctionsOfflinePlugin.serverless.service.custom = {
        stepFunctionsOffline: { FirstLambda: 'firstLamda/index.handler' },
      };
      expect(stepFunctionsOfflinePlugin.hooks[global['hooks'].start]).not.toThrowError();
    });
  });

  describe('#start', () => {
    it('should run function without error', () => {
      expect(stepFunctionsOfflinePlugin.hooks[global['hooks'].start]).not.toThrowError();
    });

    it('should throw err - unsupportable serverless version', () => {
      const version = '0.5';
      stepFunctionsOfflinePlugin.serverless.version = version;
      const error = `Serverless step offline requires Serverless v1.x.x but found ${version}`;
      expect(stepFunctionsOfflinePlugin.hooks[global['hooks'].start]).toThrowError(error);
    });

    it('should be acceptable serverless version', () => {
      const version = '1.14';
      stepFunctionsOfflinePlugin.serverless.version = version;
      expect(stepFunctionsOfflinePlugin.hooks[global['hooks'].start]).not.toThrowError();
    });
  });

  describe('#isInstalledPluginSLSStepFunctions', () => {
    it('should throw err: sls step functions plugin does not installed', () => {
      const error = 'Error: Please install plugin "serverless-step-functions". Package does not work without it';
      expect(stepFunctionsOfflinePlugin.hooks[global['hooks'].isInstalledPluginSLSStepFunctions]).toThrowError(error);
    });

    it('should accept it - package exists', () => {
      stepFunctionsOfflinePlugin.serverless.service.plugins = ['serverless-step-functions'];
      expect(stepFunctionsOfflinePlugin.hooks[global['hooks'].isInstalledPluginSLSStepFunctions]).not.toThrowError();
    });
  });

  describe('#loadEventFile', () => {
    it('should return undefined', async () => {
      const result = await stepFunctionsOfflinePlugin.hooks[global['hooks'].loadEventFile]();
      expect(result).toBeUndefined();
    });

    it('should apply event file ', async () => {
      const SFOP = new StepFunctionsOfflinePlugin(serverless, { e: 'src/__tests__/eventFile.json' });
      await SFOP.hooks[global['hooks'].loadEventFile]();
      expect(SFOP.loadedEventFile).toMatchObject({ foo: 1, bar: 2 });
    });

    it('should throw error - incorrect path to event file ', () => {
      const SFOP = new StepFunctionsOfflinePlugin(serverless, { event: '../__tests__/eventFile2.json' });
      expect(SFOP.hooks[global['hooks'].loadEventFile]).rejects.toEqual({ error: /Cannot find module/ });
    });
  });

  describe('#loadEnvVariables', () => {
    it('should return empty object', () => {
      const result = stepFunctionsOfflinePlugin.hooks[global['hooks'].loadEnvVariables]();
      expect(result).toBeUndefined();
    });
  });

  describe('#findState', () => {
    it('should throw err - serverless.yml not exists', () => {
      // stepFunctionsOfflinePlugin.serverless.config = process.cwd() + '/serverless.test.yml';
      stepFunctionsOfflinePlugin.hooks[global['hooks'].findState]().catch(e =>
        expect(e.message).toEqual('Could not find serverless manifest')
      );
    });

    it('should throw error - incorrect path to event file ', () => {
      const SFOP = new StepFunctionsOfflinePlugin(serverless, { event: '..__tests__/eventFile.json' });
      expect(SFOP.hooks[global['hooks'].loadEventFile]).rejects.toEqual({ error: /Cannot find module/ });
    });
    describe('trying to load serverless file', () => {
      it('should throw err - state does not exist', () => {
        stepFunctionsOfflinePlugin.stateMachine = undefined;
        const error = 'State Machine undefined does not exist in yaml file';
        stepFunctionsOfflinePlugin.serverless.config.servicePath = process.cwd() + '/src/__tests__';
        return stepFunctionsOfflinePlugin.hooks[global['hooks'].findState]().catch(err =>
          expect(err).toBeInstanceOf(Error)
        );
      });

      it('should parse serverless.yml and find state', () => {
        stepFunctionsOfflinePlugin.stateMachine = 'foo';
        return stepFunctionsOfflinePlugin.hooks[global['hooks'].findState]()
          .then(() => {
            expect(stepFunctionsOfflinePlugin.stateDefinition).toHaveProperty('Comment');
          })
          .catch(err => {
            expect(err).toBeUndefined();
          });
      });
    });
  });
});
