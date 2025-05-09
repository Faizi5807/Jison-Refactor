const bnf = require("./parser").parser;
const ebnf = require("./ebnf-transform");
const jisonlex = require("lex-parser");
const fs = require("fs");
const path = require("path");

// CLI Entry Point
function main() {
  const [, , file] = process.argv;
  if (!file) {
    console.error("Usage: node index.js <file>");
    process.exit(1);
  }
  const source = fs.readFileSync(path.resolve(file), "utf8");
  const parser = new bnf.yy.Parser({ ebnf: true });
  const result = parser.parse(source);
  console.log(result);
}

if (require.main === module) {
  main();
}

// Module API
exports.parse = function parse(grammar) {
  return bnf.parse(grammar);
};

exports.transform = ebnf.transform;

// Adds a declaration to the grammar
bnf.yy.addDeclaration = (grammar, decl) => {
  if (decl.start) {
    grammar.start = decl.start;
  } else if (decl.lex) {
    grammar.lex = parseLex(decl.lex);
  } else if (decl.operator) {
    if (!grammar.operators) grammar.operators = [];
    grammar.operators.push(decl.operator);
  } else if (decl.parseParam) {
    if (!grammar.parseParams) grammar.parseParams = [];
    grammar.parseParams = grammar.parseParams.concat(decl.parseParam);
  } else if (decl.include) {
    if (!grammar.moduleInclude) grammar.moduleInclude = "";
    grammar.moduleInclude += decl.include;
  } else if (decl.options) {
    if (!grammar.options) grammar.options = {};
    for (let i = 0; i < decl.options.length; i++) {
      grammar.options[decl.options[i]] = true;
    }
  }
};

// Parse an embedded lex section
function parseLex(text) {
  return jisonlex.parse(text.replace(/(?:^%lex)|(?:\/lex$)/g, ""));
}
