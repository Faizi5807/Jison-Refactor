const Generator = require('./generator');

class LR0Generator extends Generator {
  constructor(grammar, opt) {
    super(grammar, opt);
    this.tableBuilder.buildTable();
  }

  createParser() {
    const parser = eval(this.codeGenerator.generateModuleCode().moduleCode);
    parser.productions = this.productions;
    parser.lexer = this.lexer;
    parser.generate = opt => this.codeGenerator.generate(opt);
    return parser;
  }
}

module.exports = LR0Generator;