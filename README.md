[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Maintainability](https://api.codeclimate.com/v1/badges/b321644ef368976aee12/maintainability)](https://codeclimate.com/github/vibou/serverless-step-functions-offline/maintainability)

[![NPM](https://nodei.co/npm/@vibou/serverless-step-functions-offline.png)](https://nodei.co/npm/@vibou/serverless-step-functions-offline/)

## Documentation

- [Install](#install)
- [Setup](#setup)
- [Requirements](#requirements)
- [Usage](#usage)
- [Run Plugin](#run-plugin)
  - [Run the workflow](#run-the-workflow)
  - [Run the workflow using the AWS-SDK from a lambda function](#run-the-workflow-using-the-aws-sdk-from-a-lambda-function)
- [Other Information](#other-information)
  - [IS_OFFLINE information](#is_offline-information)
  - [What does plugin support?](#what-does-plugin-support)

# Install

Using NPM:

```bash
npm install @vibou/serverless-step-functions-offline serverless-step-functions serverless-offline serverless --save-dev
```

or Yarn:

```bash
yarn add @vibou/serverless-step-functions-offline serverless-step-functions serverless-offline serverless --dev
```

# Setup

Add the plugin to your `serverless.yml`:

```yaml
# serverless.yml

plugins:
  - serverless-offline
  - serverless-step-functions
  - '@vibou/serverless-step-functions-offline'
```

To verify that the plugin works, run this in your command line:

```bash
sls step-functions-offline
```

It should rise an error like that:

> Serverless plugin "serverless-step-functions-offline" initialization errored: Please add ENV_VARIABLES to section
> "custom"

# Requirements

This plugin uses the power of `serverless-offline` and `awscli` to run the lambda within the step function. The plugin
can be used with any kind of serverless-offline runtime compatible lambda.

This plugin works only with:

- [serverless-step-functions](https://github.com/horike37/serverless-step-functions).
- [serverless-offline](https://github.com/horike37/serverless-offline).
- [install aws cli](https://aws.amazon.com/cli/)

You must have this plugin installed and correctly specified statemachine definition using Amazon States Language. You
need the

Example of statemachine definition you can see [here](https://github.com/horike37/serverless-step-functions#setup).

# Usage

After all steps are done, need to add to section **custom** in serverless.yml the key **stepFunctionsOffline** with
properties _stateName_: name of lambda function.

For example:

```yaml
service: ServerlessStepPlugin
plugins:
  - serverless-offline
  - serverless-step-functions
  - '@vibou/serverless-step-functions-offline'

# ...

custom:
  stepFunctionsOffline:
    Producer: producer
    Reducer: reducer
    Finish: reducer
    MappingFunction: mapper

functions:
  producer:
    handler: build/function/workflow/producer/index.handler
    timeout: 30

  mapper:
    handler: build/function/workflow/mapper/index.handler
    timeout: 300

  reducer:
    handler: build/function/workflow/reducer/index.handler
    timeout: 300

stepFunctions:
  stateMachines:
    mapReduceExample:
      definition:
        Comment: 'MapReduceExample'
        StartAt: Producer
        States:
          Producer:
            Type: Task
            Resource: arn:aws:lambda:eu-west-1:123456789:function:producer
            ResultPath: '$.producer'
            Next: Mapper

          Mapper:
            Type: Map
            Next: Reducer
            ItemsPath: '$.producer.requests'
            Parameters:
              input.$: '$.input'
              producer.$: '$.producer'
              item.$: '$$.Map.Item.Value'

            MaxConcurrency: 10
            ResultPath: '$.mapper'
            Iterator:
              StartAt: MappingFunction
              States:
                MappingFunction:
                  Type: Task
                  Resource: arn:aws:lambda:eu-west-1:123456789:function:mapper
                  End: true

          Reducer:
            Type: Task
            Resource: arn:aws:lambda:eu-west-1:123456789:function:reducer
            ResultPath: '$.reducer'
            End: true
```

# Run Plugin

## Run the workflow

I recommand to add the following script to the `package.json`.

```json
"scripts": {
  "start": "sls offline start",
  "workflow": "sls step-functions-offline --stateMachine=mapReduceExample",
}
```

You need to start a serverless server in one terminal:

```shell
yarn start
```

And start a workflow execution by using the following command:

```shell
yarn workflow --event=<input.json>
```

## Run the workflow using the AWS-SDK from a lambda function

Add the `workflow` command from the previous section and add the following dependency.

`yarn add -D aws-sdk-mock`

mock the AWS Service when working offline:

```typescript
import { AWSError, StepFunctions } from 'aws-sdk'
import fs from 'fs'


type Callback<T = any> = (err: AWSError | null, output: T) => void

export function MockLocalServices(awsSDK) {
  if (!isOffline()) return

  const AWSMock = require('aws-sdk-mock')
  AWSMock.setSDKInstance(sdk)


  AWSMock.mock(
    'StepFunctions',
    'startExecution',
    (
      params: StepFunctions.StartExecutionInput,
      cb: Callback<StepFunctions.Types.StartExecutionOutput>,
    ) => {
        // save input to file
        const file = `/tmp/stepfunction-${v4()}.json`
        fs.writeFileSync(file, params.input || JSON.stringify({}))

        // run child process with the yarn command
        execute('yarn', ['workflow', `--event=${file}`], {}, true).then(() =>
          cb(null, {
            executionArn: v4(),
            startDate: new Date(),
          }),
        )
    }
}
```

Here is the code for the `execute` function:

```typescript
import { SpawnOptionsWithoutStdio, spawn } from 'child_process';
export async function execute(
  process: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio,
  logOutput = false
): Promise<string> {
  return new Promise((r, f) => {
    const execution = spawn(process, args, options);
    let error: Error | null = null;

    let dataStr = '';
    execution.stdout.on('data', data => {
      if (logOutput) {
        console.log(data.toString().replace(/\n$/, ''));
      }
      dataStr += data.toString();
    });

    execution.stderr.on('error', err => {
      error = err;
    });

    execution.stderr.on('data', data => {
      console.log(data.toString().replace(/\n$/, ''));
    });

    execution.on('close', code => {
      if (error) {
        f(error);
        return;
      }

      if (code) {
        return f(new Error('failed with code ' + code));
      }

      r(dataStr);
    });
  });
}
```

# Other Information

## IS_OFFLINE information

If you want to know where you are (in offline mode or not) you can use env variable `STEP_IS_OFFLINE`.

By default `process.env.STEP_IS_OFFLINE = true`.

## What does plugin support?

| States         | Support                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **_Task_**     | Supports _Retry_, _ResultsPath_ but at this moment **does not support fields** _Catch_, _TimeoutSeconds_, _HeartbeatSeconds_ |
| **_Choice_**   | All comparison operators except: _And_, _Not_, _Or_                                                                          |
| **_Wait_**     | All following fields: _Seconds_, _SecondsPath_, _Timestamp_, _TimestampPath_                                                 |
| **_Parallel_** | Only _Branches_                                                                                                              |
| **_Map_**      | Supports _Iterator_ and the following fields: _ItemsPath_, _ResultsPath_, _Parameters_, _MaxConcurrency_                     |
| **_Pass_**     | Result, ResultPath                                                                                                           |
| **_Fail_**     | Cause, Error                                                                                                                 |
| **_Succeed_**  |                                                                                                                              |
