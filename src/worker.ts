function* arrayGenerator<I>(array: I[]): Generator<[I, number, I[]]> {
  for (let index = 0; index < array.length; index++) {
    const currentValue = array[index];
    yield [currentValue, index, array];
  }
}

type MapFn<I, O> = (item: I, index: number, array: I[]) => Promise<O>;

interface WorkerResult<O> {
  status: 'rejected' | 'fulfilled';
  reason?: Error;
  value?: O;
}

async function mapItem<I, O>(
  mapFn: MapFn<I, O>,
  currentValue: I,
  index: number,
  array: I[],
  propagateError = true
): Promise<WorkerResult<O>> {
  try {
    return {
      status: 'fulfilled',
      value: await mapFn(currentValue, index, array),
    };
  } catch (error) {
    if (propagateError) {
      throw error;
    }
    return {
      status: 'rejected',
      reason: error as Error,
    };
  }
}

async function worker<I, O>(
  id: number,
  gen: Generator<[I, number, I[]]>,
  mapFn: MapFn<I, O>,
  result: WorkerResult<O>[],
  logger?: Logger
) {
  for (const [currentValue, index, array] of gen) {
    if (logger) {
      logger(`Worker ${id} --- index ${index} start`);
    }

    result[index as number] = await mapItem(mapFn, currentValue, index, array);

    if (logger) {
      logger(`Worker ${id} --- index ${index} ends`);
    }
  }
}

export type Logger = (string) => void;
export async function withWorkers<I, O>(
  arr: I[],
  mapFn: MapFn<I, O>,
  limit = arr.length,
  logger?: Logger
): Promise<WorkerResult<O>[]> {
  const result: WorkerResult<O>[] = [];

  if (arr.length === 0) {
    return result;
  }

  const gen = arrayGenerator(arr);

  limit = Math.min(limit, arr.length);

  const workers = new Array(limit);
  for (let i = 0; i < limit; i++) {
    workers.push(worker(i, gen, mapFn, result, logger));
  }

  await Promise.all(workers);

  return result;
}
