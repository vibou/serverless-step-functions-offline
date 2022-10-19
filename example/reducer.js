exports.handler = async function (event) {
  const { mapper } = event;

  console.log('computes: ' + mapper.join(' + '));
  console.log('Sum of doubles: ' + mapper.reduce((acc, v) => acc + v, 0));
};
