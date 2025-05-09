const Generator = require('./generator');
const { Item } = require('./core');

class LR1Generator extends Generator {
  constructor(grammar, opt) {
    super(grammar, opt);
    this.lookaheadCalculator.computeLookaheads();
    this.tableBuilder.buildTable();
  }

  createParser() {
    const parser = eval(this.codeGenerator.generateModuleCode().moduleCode);
    parser.productions = this.productions;
    parser.lexer = this.lexer;
    parser.generate = opt => this.codeGenerator.generate(opt);
    return parser;
  }

  lookAheads(state, item) {
    return item.follows;
  }

  Item = class LR1Item extends Item {
    constructor(production, dotPosition, follows, predecessor) {
      super(production, dotPosition, follows, predecessor);
      this.id = `${production.id}a${dotPosition}a${follows.sort().join(',')}`;
    }

    eq(e) {
      return e.id === this.id;
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
        if (symbol && this.nonterminals[symbol]) {
          let r = item.remainingHandle();
          let b = this.lookaheadCalculator.first(r);
          if (b.length === 0 || item.production.nullable || this.lookaheadCalculator.nullable(r)) {
            b = b.concat(item.follows);
          }
          this.nonterminals[symbol].productions.forEach(production => {
            const newItem = new this.Item(production, 0, b);
            if (!closureSet.contains(newItem) && !itemQueue.contains(newItem)) {
              itemQueue.push(newItem);
            }
          });
        } else if (!symbol) {
          closureSet.reductions.push(item);
        }
      });
      set = itemQueue;
    } while (!itemQueue.isEmpty());
    return closureSet;
  }
}

module.exports = LR1Generator;