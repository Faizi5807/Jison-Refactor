// set.js

'use strict';

const typal = require('./typal').typal;

const setMixin = {
  constructor: function SetConstructor(set, raw) {
    this._items = [];

    if (Array.isArray(set)) {
      this._items = raw ? set : set.slice();
    } else if (arguments.length) {
      this._items = Array.prototype.slice.call(arguments, 0);
    }
  },

  concat: function (setB) {
    const itemsToAdd = setB._items || setB;
    for (let i = 0; i < itemsToAdd.length; i++) {
      if (!this.contains(itemsToAdd[i])) {
        this._items.push(itemsToAdd[i]);
      }
    }
    return this;
  },

  eq: function (set) {
    return this._items.length === set._items.length && this.subset(set);
  },

  indexOf: function (item) {
    if (item && typeof item.eq === 'function') {
      for (let i = 0; i < this._items.length; i++) {
        if (item.eq(this._items[i])) {
          return i;
        }
      }
      return -1;
    }
    return this._items.indexOf(item);
  },

  union: function (set) {
    return new Set(this._items).concat(set);
  },

  intersection: function (set) {
    return this.filter(function (elm) {
      return set.contains(elm);
    });
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
  },
};

// Delegate array methods
['push', 'shift', 'unshift', 'forEach', 'some', 'every', 'join', 'sort'].forEach(function (method) {
  setMixin[method] = function () {
    return Array.prototype[method].apply(this._items, arguments);
  };
});

['filter', 'slice', 'map'].forEach(function (method) {
  setMixin[method] = function () {
    return new Set(Array.prototype[method].apply(this._items, arguments), true);
  };
});

const Set = typal.construct(setMixin);
// will be removed when we update the jison.js file
Set.union = function (setA, setB) {
  return new Set(setA._items).concat(setB);
};

module.exports = { Set };
