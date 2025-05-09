const version = require('../package.json').version;
const LR0Generator = require('./lr0-generator');
const SLRGenerator = require('./slr-generator');
const LALRGenerator = require('./lalr-generator');
const LR1Generator = require('./lr1-generator');
const LLGenerator = require('./ll-generator');

// Main Jison class
class Jison {
  static version = version;

  static createParser(grammar, options) {
    const opt = { ...grammar.options, ...options };
    switch (opt.type) {
      case 'lr0':
        return new LR0Generator(grammar, opt).createParser();
      case 'slr':
        return new SLRGenerator(grammar, opt).createParser();
      case 'lalr':
        return new LALRGenerator(grammar, opt).createParser();
      case 'lr1':
      case 'lr':
        return new LR1Generator(grammar, opt).createParser();
      case 'll':
        return new LLGenerator(grammar, opt).createParser();
      default:
        return new LALRGenerator(grammar, opt).createParser();
    }
  }

  static commonjsMain(args) {
    if (!args[1]) {
      console.log('Usage: ' + args[0] + ' FILE');
      process.exit(1);
    }
    const source = require('fs').readFileSync(require('path').normalize(args[1]), 'utf8');
    return Jison.createParser(source).parse(source);
  }
}

module.exports = Jison;