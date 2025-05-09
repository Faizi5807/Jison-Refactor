const { Constants, Item, ItemSet } = require('./core');

class LRTableBuilder {
  constructor(generator) {
    this.generator = generator;
  }

  buildTable() {
    this.generator.trace('Building parse table.');
    this.generator.states = this.canonicalCollection();
    this.generator.table = this.parseTable(this.generator.states);
    this.generator.defaultActions = this.findDefaults(this.generator.table);
    if (this.generator.conflicts > 0) {
      this.generator.resolutions.forEach((r, i) => {
        if (r[2].bydefault) {
          this.generator.warn('Conflict at state: ', r[0], ', token: ', r[1], "\n  ", this.printAction(r[2].r), "\n  ", this.printAction(r[2].s));
        }
      });
      this.generator.trace(`\n${this.generator.conflicts} Conflict(s) found in grammar.`);
    }
    this.generator.trace('Done.');
  }

  canonicalCollection() {
    const item1 = new Item(this.generator.productions[0], 0, [Constants.EOF]);
    const firstState = this.closureOperation(new ItemSet().push(item1));
    const states = new Set(firstState);
    states.has = { [firstState.valueOf()]: 0 };
    let marked = 0;

    while (marked !== states.size()) {
      const itemSet = states.item(marked++);
      itemSet.forEach(item => {
        if (item.markedSymbol && item.markedSymbol !== Constants.EOF) {
          this.canonicalCollectionInsert(item.markedSymbol, itemSet, states, marked - 1);
        }
      });
    }
    this.generator.trace('\nItem sets\n------');
    states.forEach((state, i) => {
      this.generator.trace(`\nitem set ${i}\n${state.join('\n')}\ntransitions -> ${JSON.stringify(state.edges)}`);
    });
    return states;
  }

  canonicalCollectionInsert(symbol, itemSet, states, stateNum) {
    const g = this.gotoOperation(itemSet, symbol);
    if (!g.predecessors) g.predecessors = {};
    if (!g.isEmpty()) {
      const gv = g.valueOf();
      let i = states.has[gv];
      if (i === -1 || i === undefined) {
        states.has[gv] = states.size();
        itemSet.edges[symbol] = states.size();
        states.push(g);
        g.predecessors[symbol] = [stateNum];
      } else {
        itemSet.edges[symbol] = i;
        states.item(i).predecessors[symbol].push(stateNum);
      }
    }
  }

  closureOperation(itemSet) {
    const closureSet = new ItemSet();
    let set = itemSet;
    do {
      const itemQueue = new Set();
      closureSet.concat(set);
      set.forEach(item => {
        const symbol = item.markedSymbol;
        if (symbol && this.generator.nonterminals[symbol]) {
          this.generator.nonterminals[symbol].productions.forEach(prod => {
            const newItem = new Item(prod, 0);
            if (!closureSet.contains(newItem)) itemQueue.push(newItem);
          });
        } else if (!symbol) {
          closureSet.reductions.push(item);
          closureSet.inadequate = closureSet.reductions.length > 1 || closureSet.shifts;
        } else {
          closureSet.shifts = true;
          closureSet.inadequate = closureSet.reductions.length > 0;
        }
      });
      set = itemQueue;
    } while (!itemQueue.isEmpty());
    return closureSet;
  }

  gotoOperation(itemSet, symbol) {
    const gotoSet = new ItemSet();
    itemSet.forEach((item, n) => {
      if (item.markedSymbol === symbol) {
        gotoSet.push(new Item(item.production, item.dotPosition + 1, item.follows, n));
      }
    });
    return gotoSet.isEmpty() ? gotoSet : this.closureOperation(gotoSet);
  }

  parseTable(itemSets) {
    const states = [];
    itemSets.forEach((itemSet, k) => {
      const state = (states[k] = {});
      for (const stackSymbol in itemSet.edges) {
        itemSet.forEach(item => {
          if (item.markedSymbol === stackSymbol) {
            const gotoState = itemSet.edges[stackSymbol];
            if (this.generator.nonterminals[stackSymbol]) {
              state[this.generator.symbolTable[stackSymbol]] = gotoState;
            } else {
              state[this.generator.symbolTable[stackSymbol]] = [Constants.SHIFT_STATE, gotoState];
            }
          }
        });
      }
      itemSet.forEach(item => {
        if (item.markedSymbol === Constants.EOF) {
          state[this.generator.symbolTable[Constants.EOF]] = [Constants.ACCEPT_STATE];
        }
      });
      const terminals = this.generator.lookAheads ? this.generator.lookAheads(itemSet) : this.generator.terminals;
      itemSet.reductions.forEach(item => {
        terminals.forEach(stackSymbol => {
          let action = state[this.generator.symbolTable[stackSymbol]];
          const op = this.generator.operators[stackSymbol];
          if (action) {
            const sol = this.resolveConflict(item.production, op, [Constants.REDUCE_STATE, item.production.id], action[0] instanceof Array ? action[0] : action);
            this.generator.resolutions.push([k, stackSymbol, sol]);
            if (sol.bydefault) {
              this.generator.conflicts++;
              if (!this.generator.options.debug) {
                Logger.warn(`Conflict in state ${k}, token: ${stackSymbol}\n- ${this.printAction(sol.r)}\n- ${this.printAction(sol.s)}`);
              }
              if (this.generator.options.noDefaultResolve) {
                action = Array.isArray(action[0]) ? action : [action];
                action.push(sol.r);
              } else {
                action = sol.action;
              }
            } else {
              action = sol.action;
            }
          } else {
            action = [Constants.REDUCE_STATE, item.production.id];
          }
          if (action && action.length) {
            state[this.generator.symbolTable[stackSymbol]] = action;
          } else if (action === Constants.NONASSOC) {
            state[this.generator.symbolTable[stackSymbol]] = undefined;
          }
        });
      });
    });
    return states;
  }

  findDefaults(states) {
    const defaults = {};
    states.forEach((state, k) => {
      let count = 0;
      for (const act in state) {
        if (Object.prototype.hasOwnProperty.call(state, act)) count++;
      }
      if (count === 1 && state[act][0] === Constants.REDUCE_STATE) {
        defaults[k] = state[act];
      }
    });
    return defaults;
  }

  resolveConflict(production, op, reduce, shift) {
    const sln = { production, operator: op, r: reduce, s: shift };
    if (shift[0] === Constants.REDUCE_STATE) {
      sln.msg = 'Resolve R/R conflict (use first production)';
      sln.action = shift[1] < reduce[1] ? shift : reduce;
      if (shift[1] !== reduce[1]) sln.bydefault = true;
      return sln;
    }
    if (production.precedence === 0 || !op) {
      sln.msg = 'Resolve S/R conflict (shift by default)';
      sln.bydefault = true;
      sln.action = shift;
    } else if (production.precedence < op.precedence) {
      sln.msg = 'Resolve S/R conflict (shift for higher precedence)';
      sln.action = shift;
    } else if (production.precedence === op.precedence) {
      if (op.assoc === 'right') {
        sln.msg = 'Resolve S/R conflict (shift for right associative)';
        sln.action = shift;
      } else if (op.assoc === 'left') {
        sln.msg = 'Resolve S/R conflict (reduce for left associative)';
        sln.action = reduce;
      } else if (op.assoc === 'nonassoc') {
        sln.msg = 'Resolve S/R conflict (no action for non-associative)';
        sln.action = Constants.NONASSOC;
      }
    } else {
      sln.msg = 'Resolve conflict (reduce for higher precedence)';
      sln.action = reduce;
    }
    return sln;
  }

  printAction(a) {
    return a[0] === Constants.SHIFT_STATE ? `shift token (then go to state ${a[1]})` :
           a[0] === Constants.REDUCE_STATE ? `reduce by rule: ${this.generator.productions[a[1]]}` :
           'accept';
  }
}

module.exports = LRTableBuilder;