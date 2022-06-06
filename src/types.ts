import Serverless from 'serverless';
import PluginManager from 'serverless/classes/PluginManager';
import Service from 'serverless/classes/Service';

import { StateMachine, Choice, State, Parallel, Task, Map, Wait } from 'asl-types';

// from https://stackoverflow.com/a/49725198/3296811
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type StateMachineBase = {
  definition: StateMachine;
};

export type Maybe<T> = null | undefined | T;

export type Event = Record<string, any>;

export type NotCompletedState = Parallel | Task | Map | Wait | Choice;

export const isNotCompletedState = (state: State): state is NotCompletedState => {
  if (isType('Parallel')<Parallel>(state)) return true;
  if (isType('Task')<Task>(state)) return true;
  if (isType('Map')<Map>(state)) return true;
  if (isType('Wait')<Wait>(state)) return true;
  if (isType('Choice')<Choice>(state)) return true;
  return false;
};

export type StateValueReturn = void | Promise<'Fail' | 'Succeed'> | StateHandler | ChoiceConditional;

export type ChoiceInstance = {
  variable: string;
  condition: Partial<Choice>;
  choiceFunction?: string;
  compareWithValue: unknown;
  checkFunction: <T>(value: T, secondValue: T) => boolean;
};

export type ChoiceConditional = {
  choice: ChoiceInstance[];
  defaultFunction?: string;
};

export type Branch = StateMachine;

export const notEmpty = <TValue>(value: Maybe<TValue>): value is TValue => value !== null && value !== undefined;

interface StateType {
  Type: string;
}

export const isType =
  (type: string) =>
  <T extends StateType>(state: State | T): state is T =>
    state.Type === type;

export const definitionIsHandler = (
  value: Maybe<Serverless.FunctionDefinitionHandler | Serverless.FunctionDefinitionImage>
): value is Serverless.FunctionDefinitionHandler => Object.prototype.hasOwnProperty.call(value, 'handler');

export const stateIsChoiceConditional = (value: Maybe<ChoiceConditional | StateHandler>): value is ChoiceConditional =>
  Object.prototype.hasOwnProperty.call(value, 'choice');

export type Failure = {
  Cause?: unknown;
  Error?: unknown;
};

export type Callback = (event, context: ContextObject, done: ContextObject['cb']) => void;
export type AsyncCallback = (event, context: ContextObject, done?: ContextObject['cb']) => Promise<void | Event>;

export type StateHandler = {
  waitState?: boolean;
  name?: string;
  f: (event: Event) => Callback | Promise<void | AsyncCallback>;
  choice?: Choice;
};

export type ContextObject = {
  name: string;
  attempt: number;
  cb: (err: Maybe<Error>, result?: Event) => void | Callback | Promise<void | Callback>;
  done: ContextObject['cb'];
  succeed: (result: Event) => void;
  fail: (err: Error) => void;
};

export type Options = {
  location?: Maybe<string>;
  stateMachine?: Maybe<string>;
  detailedLog?: boolean;
  l?: boolean;
  [key: string]: unknown;
  stage?: string;
  region?: string;
} & RequireAtLeastOne<
  {
    event?: Maybe<string>;
    e?: Options['event'];
  },
  'event' | 'e'
>;

export class SLSError extends Error {
  statusCode?: string;
  constructor(msg: string, statusCode?: string) {
    super(msg);
    this.statusCode = statusCode;
  }
}

export type ServerlessWithError = Serverless & {
  classes: {
    Error: typeof SLSError;
  };
  pluginManager: PluginManager & {
    cliOptions: {
      stage?: string;
      region?: string;
    };
  };
  service: Service & {
    stepFunctions?: {
      activities?: [];
      stateMachines?: {
        [key: string]: StateMachineBase;
      };
    };
  };
};
