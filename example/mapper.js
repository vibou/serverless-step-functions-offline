exports.handler = async function (event) {
  const { item } = event;

  return item * 2;
};
