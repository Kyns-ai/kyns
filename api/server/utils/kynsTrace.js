const noop = () => {};
const noopObj = () => ({});
const noopNull = () => null;
const noopZero = () => 0;
const noopFalse = () => false;

module.exports = {
  isKynsTraceEnabled: noopFalse,
  summarizeText: noopObj,
  summarizeError: noopObj,
  truncateText: (v) => v,
  ensureKynsTrace: noopNull,
  logKynsTrace: noop,
  getKynsTrace: noopNull,
  snapshotKynsTrace: noopNull,
  summarizeMessages: noopObj,
  summarizeParsedBody: noopObj,
  incrementKynsTraceCounter: noopZero,
  summarizeContentParts: noopObj,
  summarizeEndpointOption: noopObj,
};
