/* istanbul ignore file */
import Serverless from 'serverless';

import StepFunctionsOfflinePlugin from '../../index';
import { ServerlessWithError } from '../../types';
import Logging from './logging';

export default function setup(): {
  stepFunctionsOfflinePlugin: StepFunctionsOfflinePlugin;
  serverless: ServerlessWithError;
  StepFunctionsOfflinePlugin: typeof StepFunctionsOfflinePlugin;
} {
  const serverless = new Serverless({
    commands: [],
    options: {},
  });
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
    stepFunctionsOfflinePlugin: new StepFunctionsOfflinePlugin(
      serverless as ServerlessWithError,
      global['options'],
      Logging
    ),
  };
}
