const Generator = require('./generator');
const Set = require('./util/set').Set;

class LLGenerator extends Generator {
  constructor(grammar, opt) {
    super(grammar, opt);
    this.lookaheadCalculator.computeLookaheads();
    this.table = this.parseTable(this.productions);
  }

  createParser() {
    const parser = eval(this.codeGenerator.generateModuleCode().moduleCode);
    parser.productions = this.productions;
    parser.lexer = this.lexer;
    parser.generate = opt => this.codeGenerator.generate(opt);
    return parser;
  }

  parseTable(productions) {
    const table = {};
    productions.forEach((production, i) => {
      const row = table[production.symbol] || {};
      let tokens = production.first;
      if (this.lookaheadCalculator.nullable(production.handle)) {
        Set.union(tokens, this.nonterminals[production.symbol].follows);
      }
      tokens.forEach(token => {
        if (row[token]) {
          row[token].push(i);
          this.conflicts++;
        } else {
          row[token] = [i];
        }
      });
      table[production.symbol] = row;
    });
    return table;
  }
}

module.exports = LLGenerator;