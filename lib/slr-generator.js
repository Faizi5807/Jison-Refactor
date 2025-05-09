const Generator = require('./generator');

class SLRGenerator extends Generator {
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
    return this.nonterminals[item.production.symbol].follows;
  }
}

module.exports = SLRGenerator;