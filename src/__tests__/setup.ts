/* istanbul ignore file */
import Serverless from 'serverless/lib/Serverless';
import CLI from 'serverless/lib/classes/CLI';
import { ServerlessWithError } from '../types';
import StepFunctionsOfflinePlugin from '..';

export default function setup(): {
  stepFunctionsOfflinePlugin: StepFunctionsOfflinePlugin;
  serverless: ServerlessWithError;
  StepFunctionsOfflinePlugin: typeof StepFunctionsOfflinePlugin;
} {
  const serverless = new Serverless();
  serverless.cli = new CLI();
  // serverless.setProvider('aws', new AwsProvider(serverless));
  serverless.service.functions = {
    firstLambda: {
      handler: 'examples/firstLambda/index.handler',
      name: 'TheFirstLambda',
    },
  };
  return {
    serverless: serverless as any,
    StepFunctionsOfflinePlugin,
    stepFunctionsOfflinePlugin: new StepFunctionsOfflinePlugin(serverless as any, global['options']),
  };
}
