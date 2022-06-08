import path from 'path';

import { Choice, Fail, Map, Parallel, Pass, State, StateMachine, Succeed, Task, Wait } from 'asl-types';
import _ from 'lodash';
import moment from 'moment';
import Plugin from 'serverless/classes/Plugin';

import enumList from './enum';
import {
  AsyncCallback,
  Branch,
  Callback,
  ChoiceConditional,
  ChoiceInstance,
  ContextObject,
  Event,
  Failure,
  Maybe,
  Options,
  ServerlessWithError,
  StateMachineBase,
  StateValueReturn,
  definitionIsHandler,
  isNotCompletedState,
  isType,
  notEmpty,
  stateIsChoiceConditional,
} from './types';
import { withWorkers } from './worker';

const delay = time => new Promise(resolve => setTimeout(resolve, time * 1000));
const isString = <T>(item: string | T): item is string => typeof item == 'string';
const fileReferenceRegex = /\$\{file\((.+)\)\}$/;

export default class StepFunctionsOfflinePlugin implements Plugin {
  private location: string;

  private functions: ServerlessWithError['service']['functions'];
  private detailedLog: Options['detailedLog'];
  eventFile: Options['event'] | Options['e'];
  loadedEventFile: Maybe<Event>;
  variables?: {
    [key: string]: string;
  };
  private environmentVariables: {
    [key: string]: string | undefined;
  } = {};
  private cliLog: (str: string) => void;
  stateDefinition?: StateMachine;

  private mapResults: unknown[] = [];
  private eventForParallelExecution?: Event;
  private currentStateName: Maybe<string>;
  private currentState: Maybe<State>;
  private contexts: {
    [key: string]: Maybe<ContextObject>;
  };
  private subStates: StateMachine['States'] = {};
  private states: StateMachine['States'] = {};
  private parallelBranch: Maybe<Branch>;
  private eventParallelResult: Event[] = [];

  shouldTerminate = true;
  serverless: ServerlessWithError;
  options: Options;
  commands: Plugin['commands'];
  hooks: Plugin['hooks'];
  stateMachine: Options['stateMachine'];

  environment = '';

  constructor(serverless: ServerlessWithError, options: Options) {
    this.location = process.cwd();
    this.serverless = serverless;
    this.options = options;
    this.stateMachine = this.options.stateMachine;
    this.detailedLog = (this.options.detailedLog || this.options.l) ?? false;
    this.eventFile = this.options.event || this.options.e;
    this.functions = this.serverless.service.functions;
    this.variables = this.serverless.service.custom?.stepFunctionsOffline;
    this.cliLog = this.serverless.cli.log.bind(this.serverless.cli);
    this.contexts = {};
    this.commands = {
      'step-functions-offline': {
        usage: 'Will run your step function locally',
        lifecycleEvents: [
          'checkVariableInYML',
          'start',
          'isInstalledPluginSLSStepFunctions',
          'findFunctionsPathAndHandler',
          'findState',
          'loadEventFile',
          'loadEnvVariables',
          'buildStepWorkFlow',
          'exit',
        ],
        options: {
          stateMachine: {
            usage: 'The stage used to execute.',
            required: true,
          },
          event: {
            usage: 'File where is values for execution in JSON format',
            shortcut: 'e',
          },
          detailedLog: {
            usage: 'Option which enables detailed logs',
            shortcut: 'l',
          },
        },
      },
    };

    this.hooks = {
      'step-functions-offline:start': this.start.bind(this),
      'step-functions-offline:isInstalledPluginSLSStepFunctions': this.isInstalledPluginSLSStepFunctions.bind(this),
      'step-functions-offline:findState': this.findState.bind(this),
      'step-functions-offline:loadEventFile': this.loadEventFile.bind(this),
      'step-functions-offline:loadEnvVariables': this.loadEnvVariables.bind(this),
      'step-functions-offline:buildStepWorkFlow': this.buildStepWorkFlow.bind(this),
      'step-functions-offline:exit': this.exit.bind(this),
    };
  }

  exit(): void {
    if (this.shouldTerminate) process.exit(0);
  }

  // Entry point for the plugin (sls step offline)
  start(): void {
    this.cliLog('Preparing....');

    this._getLocation();
    this._checkVersion();
    this._checkVariableInYML();
  }

  _getLocation(): void {
    if (this.options.location) {
      this.location = path.join(process.cwd(), this.options.location);
    }
    if (this.variables && this.variables.location) {
      this.location = path.join(process.cwd(), this.variables.location);
    }
  }

  _checkVersion(): void {
    const version = this.serverless.version;
    if (!version.startsWith('2.')) {
      throw new this.serverless.classes.Error(
        `Serverless step offline requires Serverless v2.x.x but found ${version}`
      );
    }
  }

  _checkVariableInYML(): void {
    if (!_.has(this.serverless.service, 'custom.stepFunctionsOffline')) {
      throw new this.serverless.classes.Error('Please add ENV_VARIABLES to section "custom"');
    }
    return;
  }

  isInstalledPluginSLSStepFunctions(): void {
    const plugins = this.serverless.service.plugins;
    if (plugins.indexOf('serverless-step-functions') < 0) {
      const error = 'Error: Please install plugin "serverless-step-functions". Package does not work without it';
      throw new this.serverless.classes.Error(error);
    }
  }

  async loadEventFile(): Promise<void> {
    if (!this.eventFile) {
      this.eventFile = '';
      return Promise.resolve();
    }
    try {
      this.loadedEventFile = path.isAbsolute(this.eventFile)
        ? await import(this.eventFile)
        : await import(path.join(process.cwd(), this.eventFile));
    } catch (err) {
      throw err;
    }
  }

  loadEnvVariables(): void {
    // this.environment = this.serverless.service.provider.environment;
    process.env.STEP_IS_OFFLINE = 'true';
    process.env = _.extend(process.env, this.environment);
    this.environmentVariables = Object.assign({}, process.env); //store global env variables;
    return;
  }

  findState(): Promise<void> {
    this.cliLog(`Trying to find state "${this.stateMachine}" in serverless manifest`);
    return this.parseConfig()
      .then(() => {
        if (!this.stateMachine) {
          throw new Error('unable to get state definition');
        }
        this.stateDefinition = this.getStateMachine(this.stateMachine).definition;
      })
      .catch((err: Error) => {
        throw new this.serverless.classes.Error(err.message);
      });
  }

  private parseYaml<T>(filename: string): Promise<T> {
    return this.serverless.yamlParser.parse(filename);
  }

  private serverlessFileExists(filename) {
    const serverlessPath = this.serverless.config.servicePath;
    if (!serverlessPath) {
      throw new this.serverless.classes.Error('Could not find serverless manifest');
    }
    const fullPath = path.join(serverlessPath, filename);
    return this.serverless.utils.fileExistsSync(fullPath);
  }

  async getRawConfig(): Promise<ServerlessWithError['service']> {
    const serverlessPath = this.serverless.config.servicePath;
    if (!serverlessPath) {
      throw new this.serverless.classes.Error('Could not find serverless manifest');
    }

    const manifestFilenames = ['serverless.yaml', 'serverless.yml', 'serverless.json', 'serverless.js'];

    const manifestFilename = manifestFilenames.find(name => this.serverlessFileExists(name));
    if (!manifestFilename) {
      throw new this.serverless.classes.Error(
        `Could not find serverless manifest at path ${serverlessPath}. If this path is incorreect you should adjust the 'servicePath' variable`
      );
    }
    const manifestPath = path.join(serverlessPath, manifestFilename);
    let fromFile: ServerlessWithError['service'];
    if (/\.json|\.js$/.test(manifestPath)) {
      try {
        fromFile = await import(manifestPath);
        return fromFile;
      } catch (err) {
        console.error(err);
        throw new Error(`Unable to import manifest at: ${manifestPath}`);
      }
    }
    return this.parseYaml<ServerlessWithError['service']>(manifestPath);
  }

  parseConfig(): Promise<void> {
    return this.getRawConfig().then(serverlessFileParam => {
      this.serverless.service.stepFunctions = {};
      this.serverless.service.stepFunctions.stateMachines =
        serverlessFileParam.stepFunctions && serverlessFileParam.stepFunctions.stateMachines
          ? serverlessFileParam.stepFunctions.stateMachines
          : {};
      this.serverless.service.stepFunctions.activities =
        serverlessFileParam.stepFunctions && serverlessFileParam.stepFunctions.activities
          ? serverlessFileParam.stepFunctions.activities
          : [];

      if (!this.serverless.pluginManager.cliOptions.stage) {
        this.serverless.pluginManager.cliOptions.stage =
          this.options.stage || (this.serverless.service.provider && this.serverless.service.provider.stage) || 'dev';
      }

      if (!this.serverless.pluginManager.cliOptions.region) {
        this.serverless.pluginManager.cliOptions.region =
          this.options.region ||
          (this.serverless.service.provider && this.serverless.service.provider.region) ||
          'us-east-1';
      }

      // this.serverless.variables.populateService(this.serverless.pluginManager.cliOptions);
      this.serverless.variables.populateService();
      return Promise.resolve();
    });
  }

  getStateMachine(stateMachineName: string): StateMachineBase {
    if (
      this.serverless.service.stepFunctions?.stateMachines &&
      stateMachineName in this.serverless.service.stepFunctions.stateMachines
    ) {
      return this.serverless.service.stepFunctions?.stateMachines[stateMachineName];
    }
    throw new this.serverless.classes.Error(`stateMachine "${stateMachineName}" doesn't exist in this Service`);
  }

  // findFunctionsPathAndHandler() {
  //     for (const functionName in this.variables) {
  //         const functionHandler = this.variables[functionName];
  //         const {handler, filePath} = this._findFunctionPathAndHandler(functionHandler);
  //
  //         this.variables[functionName] = {handler, filePath};
  //     }
  //     console.log('this.va', this.variables)
  // },
  //
  _findFunctionPathAndHandler(functionHandler: string): { handler: string; filePath: string } {
    const dir = path.dirname(functionHandler);
    const handler = path.basename(functionHandler);
    const splitHandler = handler.split('.');
    const filePath = `${dir}/${splitHandler[0]}.js`;
    const handlerName = `${splitHandler[1]}`;

    return { handler: handlerName, filePath };
  }

  async _loadStates(states: StateMachine['States'] | string): Promise<StateMachine['States']> {
    if (isString(states)) {
      const serverlessPath = this.serverless.config.servicePath;
      if (!serverlessPath) {
        throw new this.serverless.classes.Error('Could not find serverless manifest');
      }
      const match = states.match(fileReferenceRegex);
      if (!match) {
        throw new this.serverless.classes.Error(`couldn't understand string of States: ${states}`);
      }
      const fileName = match[1];
      if (!this.serverlessFileExists(fileName)) {
        throw new this.serverless.classes.Error(`Unable to find ${fileName} in serverless path`);
      }
      return this.parseYaml<StateMachine['States']>(path.join(serverlessPath, fileName));
    }
    return states;
  }

  async buildStepWorkFlow(): Promise<ReturnType<StepFunctionsOfflinePlugin['process']>> {
    this.cliLog('Building StepWorkFlow');
    if (!this.stateDefinition) throw new Error('Missing state definition');
    const event = this.loadedEventFile ?? {};
    if (!this.stateDefinition?.StartAt) {
      throw new Error('Missing `startAt` in definition');
    }
    if (typeof this.stateDefinition.States === 'string') {
      this.stateDefinition.States = await this._loadStates(this.stateDefinition.States);
    }
    this.addContextObject(this.stateDefinition.States, this.stateDefinition.StartAt, event);
    this.states = this.stateDefinition.States;
    return this.process(this.states[this.stateDefinition.StartAt], this.stateDefinition.StartAt, event);
  }

  async buildSubStepWorkFlow(
    stateDefinition: StateMachine,
    event: Event
  ): Promise<ReturnType<StepFunctionsOfflinePlugin['process']>> {
    this.cliLog('Building Iterator StepWorkFlow');

    if (typeof stateDefinition.States === 'string') {
      stateDefinition.States = await this._loadStates(stateDefinition.States);
    }
    this.addContextObject(stateDefinition.States, stateDefinition.StartAt, event);

    if (!stateDefinition.States) return;
    const state = stateDefinition.States[stateDefinition.StartAt];
    const result = await this.process(state, stateDefinition.StartAt, event);
    this.contexts[stateDefinition.StartAt] = null;
    return result;
  }

  process(state: State, stateName: string, event: Event): void | Promise<void | Callback> | Callback {
    if (state && state.Type === 'Parallel') {
      this.eventForParallelExecution = event;
    }
    const data = this._findStep(state, stateName);

    // if (data instanceof Promise) return Promise.resolve();
    if (!data || data instanceof Promise) {
      if ((!state || state.Type !== 'Parallel') && !this.mapResults) {
        this.cliLog('Serverless step function offline: Finished');
      }
      return Promise.resolve();
    }
    if (stateIsChoiceConditional(data) && data.choice) {
      return this._runChoice(data, event);
    } else if (!stateIsChoiceConditional(data)) {
      const callback = data.f(event);
      return this._run(callback, event, stateName);
    }
  }

  _findStep(currentState: State, currentStateName: string): StateValueReturn {
    // it means end of states
    if (!currentState) {
      this.currentState = null;
      this.currentStateName = null;
      return;
    }
    this.currentState = currentState;
    this.currentStateName = currentStateName;
    return this._states(currentState, currentStateName);
  }

  _run(
    func: Callback | Promise<void | AsyncCallback>,
    event: Event,
    name: string
  ): void | Promise<void | Callback> | Callback {
    if (!func) return; // end of states
    this.executionLog(`~~~~~~~~~~~~~~~~~~~~~~~~~~~ ${this.currentStateName} started ~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

    const contextObject = this.contexts[name];
    if (contextObject) {
      if (func instanceof Promise) {
        return func.then(async mod => {
          if (!mod) return contextObject.done(null, {});
          let res;
          let err;
          try {
            const done = (e, val) => {
              res = val;
              err = e;
            };
            const functionRes = await mod(event, contextObject, done);
            if (functionRes) res = functionRes;
            try {
              if (typeof res === 'string') res = JSON.parse(res);
            } catch (err) {}
          } catch (error) {
            err = error;
          }
          return contextObject.done(err, res || {});
        });
      }
      return func(event, contextObject, contextObject.done);
    }
  }

  _handleMap(currentState: Map, stateName: string): StateValueReturn {
    return {
      f: (event: Event): Promise<void | AsyncCallback> => {
        const items = _.get(event, currentState.ItemsPath?.replace(/^\$\./, '') ?? '', []);
        const mapItems: unknown[] = _.clone(items);
        this.mapResults = [];
        if (mapItems.length === 0) {
          this.cliLog(`State ${stateName} is being called with no items, skipping...`);
          if (currentState.End) return Promise.resolve();
        }

        const concurrency = currentState.MaxConcurrency || 1;

        const executeMapperPromise = withWorkers(
          mapItems,
          item => {
            const parseValue = (value: string) => {
              if (value === '$$.Map.Item.Value') {
                return item;
              }

              if (/^\$\./.test(value)) {
                return _.get(event, value.replace(/^\$\./, ''));
              }
            };

            const newEvent = currentState.Parameters
              ? Object.keys(currentState.Parameters).reduce((acc: { [key: string]: unknown }, key) => {
                  if (/\.\$$/.test(key) && currentState.Parameters) {
                    acc[key.replace(/\.\$$/, '')] = parseValue(currentState.Parameters[key].toString());
                  }

                  return acc;
                }, {})
              : {};

            return this.buildSubStepWorkFlow(currentState.Iterator, newEvent);
          },
          concurrency,
          v => this.executionLog(v)
        );

        return executeMapperPromise.then(async () => {
          const mappedResult = await Promise.all(this.mapResults);

          if (currentState.ResultPath) {
            _.set(event, currentState.ResultPath.replace(/\$\./, ''), mappedResult);
          }

          this.mapResults = [];

          if (currentState.Next) {
            this.addContextObject(this.states, currentState.Next, event);
            await this.process(this.states[currentState.Next], currentState.Next, event);
          }
          return;
        });
      },
    };
  }

  _handleTask(currentState: Task, stateName: string): StateValueReturn {
    // just push task to general array
    //before each task restore global default env variables
    process.env = Object.assign({}, this.environmentVariables);
    const functionName = this.variables?.[stateName];
    const f = functionName ? this.functions[functionName] : null;
    if (f === undefined || f === null) {
      this.cliLog(`Function "${stateName}" does not presented in serverless manifest`);
      throw new Error(`Function "${stateName}" does not presented in serverless manifest`);
    }
    if (!definitionIsHandler(f)) return;
    const { handler, filePath } = this._findFunctionPathAndHandler(f.handler);
    // if function has additional variables - attach it to function
    if (f.environment) {
      process.env = _.extend(process.env, f.environment);
    }
    return {
      name: stateName,
      f: () => import(path.join(this.location, filePath)).then(mod => mod[handler]),
    };
  }

  _handleParallel(currentState: Parallel): StateValueReturn {
    this.eventParallelResult = [];
    _.forEach(currentState.Branches, branch => {
      this.parallelBranch = branch;
      return this.eventForParallelExecution
        ? this.process(branch.States[branch.StartAt], branch.StartAt, this.eventForParallelExecution)
        : null;
    });
    if (currentState.Next) {
      this.process(this.states[currentState.Next], currentState.Next, this.eventParallelResult);
    }
    delete this.parallelBranch;
    this.eventParallelResult = [];
    return;
  }

  _handleChoice(currentState: Choice): ChoiceConditional {
    //push all choices. but need to store information like
    // 1) on which variable need to look: ${variable}
    // 2) find operator: ${condition}
    // 3) find function which will check data: ${checkFunction}
    // 4) value which we will use in order to compare data: ${compareWithValue}
    // 5) find target function - will be used if condition true: ${f}
    const choiceConditional: ChoiceConditional = {
      choice: [],
    };
    _.forEach(currentState.Choices, choice => {
      const variable = choice.Variable?.split('$.')[1];
      const condition = _.pick(choice, enumList.supportedComparisonOperator);
      if (!condition) {
        this.cliLog(`Sorry! At this moment we don't support operator '${choice}'`);
        process.exit(1);
      }
      const operator = Object.keys(condition)[0];
      const checkFunction = enumList.convertOperator[operator];
      const compareWithValue = condition[operator];

      if (variable) {
        const choiceObj: ChoiceInstance = {
          variable,
          condition,
          checkFunction,
          compareWithValue,
          choiceFunction: choice.Next,
        };
        choiceConditional.choice.push(choiceObj);
      }
    });
    // if exists default function - store it
    if (currentState.Default) {
      choiceConditional.defaultFunction = currentState.Default;
    }
    return choiceConditional;
  }

  _handleWait(currentState: Wait, stateName: string): StateValueReturn {
    // Wait State
    // works with parameter: seconds, timestamp, timestampPath, secondsPath;
    return {
      waitState: true,
      f: async event => {
        const waitTimer = this._waitState(event, currentState, stateName);
        this.cliLog(`Wait function ${stateName} - please wait ${waitTimer} seconds`);
        await delay(waitTimer);
        return (e, context, done) => done(null, e || event);
      },
    };
  }

  _handlePass(currentState: Pass): StateValueReturn {
    return {
      f: event => {
        return (arg1, arg2, cb) => {
          this.cliLog('!!! Pass State !!!');
          const eventResult = this._passStateFields(currentState, event);
          cb(null, eventResult);
        };
      },
    };
  }

  _states(currentState: State, currentStateName: string): StateValueReturn {
    if (isType('Map')<Map>(currentState)) {
      return this._handleMap(currentState, currentStateName);
    }
    if (isType('Task')<Task>(currentState)) {
      return this._handleTask(currentState, currentStateName);
    }
    if (isType('Parallel')<Parallel>(currentState)) {
      return this._handleParallel(currentState); // look through branches and push all of them
    }
    if (isType('Choice')<Choice>(currentState)) {
      return this._handleChoice(currentState);
    }
    if (isType('Wait')<Wait>(currentState)) {
      return this._handleWait(currentState, currentStateName);
    }
    if (isType('Pass')<Pass>(currentState)) {
      return this._handlePass(currentState);
    }
    if (isType('Fail')<Fail>(currentState)) {
      const obj: Failure = {};
      if (currentState.Cause) obj.Cause = currentState.Cause;
      if (currentState.Error) obj.Error = currentState.Error;
      this.cliLog('Fail');
      if (!_.isEmpty(obj)) {
        this.cliLog(JSON.stringify(obj));
      }
      return Promise.resolve('Fail');
    }
    if (isType('Succeed')<Succeed>(currentState)) {
      this.cliLog('Succeed');
      return Promise.resolve('Succeed');
    }
  }

  _passStateFields(currentState: Pass, event: Event): Event {
    if (!currentState.ResultPath) {
      return currentState.Result || event;
    } else {
      const variableName = currentState.ResultPath.split('$.')[1];
      console.log('variable name', { path: currentState.ResultPath, variableName, result: currentState.Result });
      if (!currentState.Result) {
        event[variableName] = event;
        return event;
      }
      event[variableName] = currentState.Result;
      return event;
    }
  }

  _runChoice(data: ChoiceConditional, result: Event): void | Promise<void | Callback> | Callback {
    let existsAnyMatches = false;
    if (!data?.choice) return;

    //look through choice and find appropriate
    _.forEach(data.choice, choice => {
      //check if result from previous function has of value which described in Choice
      const functionResultValue = _.get(result, choice.variable);
      if (!_.isNil(functionResultValue)) {
        //check condition
        const isConditionTrue = choice.checkFunction(functionResultValue, choice.compareWithValue);
        if (isConditionTrue && choice.choiceFunction) {
          existsAnyMatches = true;
          return this.process(this.states[choice.choiceFunction], choice.choiceFunction, result);
        }
      }
    });
    if (!existsAnyMatches && data.defaultFunction) {
      const fName = data.defaultFunction;
      return this.process(this.states[fName], fName, result);
    }
  }

  _waitState(event: Event, currentState: State, currentStateName: string): number {
    let waitTimer = 0,
      targetTime,
      timeDiff;
    const currentTime = moment();
    const waitListKeys = ['Seconds', 'Timestamp', 'TimestampPath', 'SecondsPath'];
    const waitField = _.omit(currentState, 'Type', 'Next', 'Result');
    const waitKey = Object.keys(waitField)[0];
    if (!waitListKeys.includes(waitKey)) {
      const error = `Plugin does not support wait operator "${waitKey}"`;
      throw new this.serverless.classes.Error(error);
    }
    switch (Object.keys(waitField)[0]) {
      case 'Seconds':
        waitTimer = waitField['Seconds'];
        break;
      case 'Timestamp':
        targetTime = moment(waitField['Timestamp']);
        timeDiff = targetTime.diff(currentTime, 'seconds');
        if (timeDiff > 0) waitTimer = timeDiff;
        break;
      case 'TimestampPath':
        const timestampPath = waitField['TimestampPath'].split('$.')[1];
        if (event[timestampPath] === undefined) {
          const error = `An error occurred while executing the state ${currentStateName}.
                     The TimestampPath parameter does not reference an input value: ${waitField['TimestampPath']}`;
          throw new this.serverless.classes.Error(error);
        }
        targetTime = moment(event[timestampPath]);
        timeDiff = targetTime.diff(currentTime, 'seconds');
        if (timeDiff > 0) waitTimer = timeDiff;
        break;
      case 'SecondsPath':
        const secondsPath = waitField['SecondsPath'].split('$.')[1];
        const waitSeconds = event[secondsPath];
        if (waitSeconds === undefined) {
          const error = `
                    An error occurred while executing the state ${currentStateName}.
                    The SecondsPath parameter does not reference an input value: ${waitField['SecondsPath']}`;
          throw new this.serverless.classes.Error(error);
        }
        waitTimer = waitSeconds;
        break;
    }
    return waitTimer;
  }

  addContextObject(states: StateMachine['States'], name: string, event: Event): void {
    if (this.contexts[name]) return;
    const contextObject = this.createContextObject(states, name, event);
    this.contexts[name] = contextObject;
  }

  createContextObject(states: StateMachine['States'], name: string, originalEvent: Event): ContextObject {
    let attempt = 0;
    const cb = (err: Maybe<Error>, result?: Event) => {
      if (!notEmpty(this.currentState)) return;
      if (err && !isType('Task')<Task>(this.currentState)) {
        throw `Error in function "${this.currentStateName}": ${JSON.stringify(err)}`;
      }
      if (err && isType('Task')<Task>(this.currentState)) {
        const matchingError = (this.currentState.Retry ?? []).find(condition =>
          condition.ErrorEquals.includes('HandledError')
        );
        if (!matchingError) throw `Error in function "${this.currentStateName}": ${JSON.stringify(err.message)}`;
        attempt += 1;
        if (attempt < (matchingError.MaxAttempts ?? 0)) {
          this.addContextObject(states, name, originalEvent);
          if (matchingError.IntervalSeconds !== undefined && matchingError.IntervalSeconds !== 0) {
            const backoffRate = matchingError?.BackoffRate ?? 2;
            const fullDelay =
              attempt === 1
                ? matchingError.IntervalSeconds
                : matchingError.IntervalSeconds * (attempt - 1) * backoffRate;
            return delay(fullDelay).then(() => this.process(states[name], name, originalEvent));
          }
          return this.process(states[name], name, originalEvent);
        }
        const newErr = `Error in function "${this.currentStateName}" after ${attempt} attempts: ${JSON.stringify(
          this.currentState
        )} - ${JSON.stringify(err)}`;
        attempt = 0;
        throw newErr;
      }
      attempt = 0;
      this.executionLog(`~~~~~~~~~~~~~~~~~~~~~~~~~~~ ${this.currentStateName} finished ~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
      let state = states;
      if (!isNotCompletedState(this.currentState)) return;
      if (this.parallelBranch && this.parallelBranch.States) {
        state = this.parallelBranch.States;
        if (!this.currentState?.Next) this.eventParallelResult.push(result ?? {}); // it means the end of execution of branch
      }

      if (this.mapResults && !this.currentState?.Next) {
        this.mapResults.push(result);
      }

      let nextEvent = result;
      if (isType('Task')<Task>(this.currentState) && this.currentState.ResultPath) {
        _.set(originalEvent, this.currentState.ResultPath.replace(/\$\./, ''), result);
        nextEvent = originalEvent;
      }

      if (this.currentState?.Next) {
        if (this.currentState) this.addContextObject(states, this.currentState.Next, nextEvent ?? originalEvent);
        return this.process(state[this.currentState.Next], this.currentState.Next, nextEvent ?? {});
      }
    };

    return {
      name,
      attempt,
      cb,
      done: cb,
      succeed: result => cb(null, result),
      fail: (err: Error) => cb(err),
    };
  }

  executionLog(log: string): void {
    if (this.detailedLog) this.cliLog(log);
  }
}
