import Serverless from 'serverless';
import PluginManager from 'serverless/classes/PluginManager';
import Service from 'serverless/classes/Service';

// from https://stackoverflow.com/a/49725198/3296811
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type StateMachine = {
  definition: {
    Comment: string;
    StartAt: string;
    States: {
      [key: string]: StateDefinition;
    };
  };
};

export type Maybe<T> = null | undefined | T;

export type Event = Record<string, any>;

export type Choice = {
  Next?: string;
  Variable?: string;
  NumericGreaterThanEquals?: number;
  NumericLessThan?: number;
  NumericEquals?: number;
  BooleanEquals?: boolean;
  StringEquals?: string;
  StringGreaterThan?: string;
  StringGreaterThanEquals?: string;
  StringLessThan?: string;
  StringLessThanEquals?: string;
  And?: Choice[];
  Not?: Choice;
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

export type Branch = StateMachine['definition'];

export const definitionIsHandler = (
  value: Maybe<Serverless.FunctionDefinitionHandler | Serverless.FunctionDefinitionImage>
): value is Serverless.FunctionDefinitionHandler => Object.prototype.hasOwnProperty.call(value, 'handler');

export const stateIsChoiceConditional = (value: Maybe<ChoiceConditional | StateHandler>): value is ChoiceConditional =>
  Object.prototype.hasOwnProperty.call(value, 'choice');

export type StateDefinition = {
  Type: string;
  Resource: string;
  ItemsPath?: string;
  Parameters?: {
    [key: string]: string | number;
  };
  Iterator?: StateMachine['definition'];
  Next?: string;
  End?: boolean;
  ErrorEquals?: string[];
  ResultPath?: string;
  Choices: Choice[];
  Result?: Event;
  Default?: string;
  Branches?: Branch[];
  Cause?: string;
  Error?: string;
};

export type Failure = {
  Cause?: unknown;
  Error?: unknown;
};

export type Callback = (event, context: ContextObject, done: ContextObject['cb']) => void;

export type StateHandler = {
  waitState?: boolean;
  name?: string;
  f: (event: Event) => Callback | Promise<void>;
  choice?: Choice;
};

export type ContextObject = {
  cb: (err: Maybe<Error>, result: Event) => void | Callback | Promise<void>;
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
        [key: string]: StateMachine;
      };
    };
  };
};
