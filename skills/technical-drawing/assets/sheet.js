(function (root) {
  'use strict';
  const api = {
    width: 420,
    height: 297,
    margin: 28,
    axisDash: '6 1 1 1',
    linework: {
      technical: {outline: .35, edge: .22, detail: .13, texture: .09, axis: .13},
      patent: {outline: .24, edge: .15, detail: .10, texture: .065, axis: .1},
      service: {outline: .5, edge: .28, detail: .16, texture: 0, axis: .16}
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TechnicalSheet = api;
})(globalThis);
