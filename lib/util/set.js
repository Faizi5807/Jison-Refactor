'use strict';


const typal = require("./typal").typal;

const setMixin = {
  constructor: function (set, raw) {
    this._items = [];
    if (Array.isArray(set)) {
      this._items = raw ? set : [...set];
    } else if (arguments.length) {
      this._items = [...arguments];
    }
  },


  concat: function (setB) {
    this._items.push(...(setB._items || setB));
    return this;
  },


  eq: function (set) {
    return this._items.length === set._items.length && this.subset(set);
  },


  indexOf: function (item) {
    if (item && typeof item.eq === "function") {
      for (let k = 0; k < this._items.length; k++) {
        if (item.eq(this._items[k])) {
          return k;
        }
      }
      return -1;
    }
    return this._items.indexOf(item);
  },

  union: function (set) {
    return new Set(this._items).concat(this.complement(set));
  },

  intersection: function (set) {
    return this.filter((elm) => set.contains(elm));
  },

  complement: function (set) {
    return set.filter((elm) => !this.contains(elm));
  },

  subset: function (set) {
    return this._items.every((item) => set.contains(item));
  },

  superset: function (set) {
    return set.subset(this);
  },

  joinSet: function (set) {
    return this.concat(this.complement(set));
  },

  contains: function (item) {
    return this.indexOf(item) !== -1;
  },

  item: function (index) {
    return this._items[index];
  },


  i: function (index) {
    return this._items[index];
  },

  first: function () {
    return this._items[0];
  },

  last: function () {
    return this._items[this._items.length - 1];
  },


  size: function () {
    return this._items.length;
  },


  isEmpty: function () {
    return this._items.length === 0;
  },


  copy: function () {
    return new Set(this._items);
  },

  toString: function () {
    return this._items.toString();
  }
};

// Dynamically add Array methods
const directArrayMethods = [
  "push",
  "shift",
  "unshift",
  "forEach",
  "some",
  "every",
  "join",
  "sort"
];
const wrappedArrayMethods = ["filter", "slice", "map"];

[...directArrayMethods, ...wrappedArrayMethods].forEach((method) => {
  setMixin[method] = function (...args) {
    const result = Array.prototype[method].apply(this._items, args);
    return wrappedArrayMethods.includes(method) ? new Set(result, true) : result;
  };
});

const Set = typal.construct(setMixin).mix({

  union: function (a, b) {
    const seen = {};
    for (let k = a.length - 1; k >= 0; k--) {
      seen[a[k]] = true;
    }
    for (let i = b.length - 1; i >= 0; i--) {
      if (!seen[b[i]]) {
        a.push(b[i]);
      }
    }
    return a;
  }
});

module.exports = { Set };