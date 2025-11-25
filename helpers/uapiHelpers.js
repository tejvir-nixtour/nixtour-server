const combineListsWithCommonKeyValue = (list1, key1, list2, key2) => {
  return list1.map((item1) => ({
    ...item1,
    [key1]: list2.find((item2) => item2[key2] === item1[key1]) || null,
  }));
};

module.exports = {
  combineListsWithCommonKeyValue,
};
