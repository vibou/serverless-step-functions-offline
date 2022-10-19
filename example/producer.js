exports.handler = async function (event) {
  console.log('producer started', event);

  const { input } = event;

  const numbers = [];
  for (let i = 1; i < input.numberOfValues; i++) {
    numbers.push(i);
  }
  return { values: numbers };
};
