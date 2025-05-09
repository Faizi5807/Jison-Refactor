const Set = require('./util/set').Set;

// Constants for parser tokens and states
class Constants {
  static get EOF() { return '$end'; }
  static get ERROR_TOKEN() { return 'error'; }
  static get ACCEPT_STATE() { return 3; }
  static get SHIFT_STATE() { return 1; }
  static get REDUCE_STATE() { return 2; }
  static get NONASSOC() { return 0; }
  static get TERROR() { return 2; }
  static get EOF_TOKEN() { return 1; }
}

// Centralized logging and debugging
class Logger {
  static debug = false;

  static print(...args) {
    if (typeof console !== 'undefined' && console.log) {
      console.log(...args);
    } else if (typeof puts !== 'undefined') {
      puts(args.join(' '));
    } else if (typeof print !== 'undefined') {
      print(...args);
    }
  }

  static trace(...args) {
    if (this.debug) this.print(...args);
  }

  static warn(...args) {
    this.print(...args);
  }

  static error(msg) {
    throw new Error(msg);
  }

  static setDebug(enabled) {
    this.debug = enabled;
  }
}

// Generates unique variable names for code generation
class VariableGenerator {
  #nextId = 0;
  #tokens = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$';

  createVariable() {
    let id = this.#nextId++;
    let name = '$V';
    do {
      name += this.#tokens[id % this.#tokens.length];
      id = Math.floor(id / this.#tokens.length);
    } while (id !== 0);
    return name;
  }

  createObjectCode() {
    return 'o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o}';
  }
}

// Represents a nonterminal in the grammar
class Nonterminal {
  constructor(symbol) {
    this.symbol = symbol;
    this.productions = new Set();
    this.first = [];
    this.follows = [];
    this.nullable = false;
  }

  toString() {
    return `${this.symbol}\n${this.nullable ? 'nullable' : 'not nullable'}\nFirsts: ${this.first.join(', ')}\nFollows: ${this.follows.join(', ')}\nProductions:\n  ${this.productions.join('\n  ')}`;
  }
}

// Represents a production rule
class Production {
  constructor(symbol, handle, id) {
    this.symbol = symbol;
    this.handle = handle;
    this.nullable = false;
    this.id = id;
    this.first = [];
    this.precedence = 0;
  }

  toString() {
    return `${this.symbol} -> ${this.handle.join(' ')}`;
  }
}

// Represents an LR parsing item
class Item {
  constructor(production, dotPosition = 0, follows = [], predecessor) {
    this.production = production;
    this.dotPosition = dotPosition;
    this.follows = follows;
    this.predecessor = predecessor;
    this.id = `${production.id}a${dotPosition}`;
    this.markedSymbol = production.handle[dotPosition];
  }

  remainingHandle() {
    return this.production.handle.slice(this.dotPosition + 1);
  }

  eq(other) {
    return other.id === this.id;
  }

  handleToString() {
    const handle = this.production.handle.slice(0);
    handle[this.dotPosition] = '.' + (handle[this.dotPosition] || '');
    return handle.join(' ');
  }

  toString() {
    return `${this.production.symbol} -> ${this.handleToString()}${this.follows.length ? ' #lookaheads= ' + this.follows.join(' ') : ''}`;
  }
}

// Represents a set of LR items
class ItemSet {
  constructor() {
    this._items = [];
    this.reductions = [];
    this.goes = {};
    this.edges = {};
    this.shifts = false;
    this.inadequate = false;
    this.hash_ = {};
  }

  concat(set) {
    const items = set._items || set;
    items.forEach(item => {
      this.hash_[item.id] = true;
      this._items.push(item);
    });
    return this;
  }

  push(item) {
    this.hash_[item.id] = true;
    return this._items.push(item);
  }

  contains(item) {
    return !!this.hash_[item.id];
  }

  valueOf() {
    const v = this._items.map(a => a.id).sort().join('|');
    this.valueOf = () => v;
    return v;
  }

  isEmpty() {
    return this._items.length === 0;
  }
}

module.exports = { Constants, Logger, VariableGenerator, Nonterminal, Production, Item, ItemSet };