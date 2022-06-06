/* istanbul ignore file */
import Serverless from 'serverless';
import CLI from 'serverless/lib/classes/CLI';
import { ServerlessWithError } from '../types';
import StepFunctionsOfflinePlugin from '..';

export default function setup(): {
  stepFunctionsOfflinePlugin: StepFunctionsOfflinePlugin;
  serverless: ServerlessWithError;
  StepFunctionsOfflinePlugin: typeof StepFunctionsOfflinePlugin;
} {
  const serverless = new Serverless({
    commands: [],
    options: {},
  });
  serverless.cli = new CLI();
  // serverless.setProvider('aws', new AwsProvider(serverless));
  serverless.service.functions = {
    firstLambda: {
      handler: 'examples/firstLambda/index.handler',
      name: 'TheFirstLambda',
      events: [
        {
          http: {
            path: 'fake-path',
            method: 'get',
          },
        },
      ],
    },
  };
  return {
    serverless: serverless as ServerlessWithError,
    StepFunctionsOfflinePlugin,
    stepFunctionsOfflinePlugin: new StepFunctionsOfflinePlugin(serverless as ServerlessWithError, global['options']),
  };
}
