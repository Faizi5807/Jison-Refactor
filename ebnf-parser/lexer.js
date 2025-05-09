class Lexer {
  constructor(options = {}) {
    this.options = options;
    this.EOF = 1;
    this.reset();
  }

  reset() {
    this._input = '';
    this._more = this._backtrack = this.done = false;
    this.yylineno = this.yyleng = 0;
    this.yytext = this.matched = this.match = '';
    this.conditionStack = ['INITIAL'];
    this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 };
    this.offset = 0;
    return this;
  }

  setInput(input) {
    this._input = input;
    return this.reset();
  }

  input() {
    const ch = this._input[0];
    this.yytext += ch;
    this.yyleng++;
    this.offset++;
    this.match += ch;
    this.matched += ch;

    if (/\r?\n/.test(ch)) {
      this.yylineno++;
      this.yylloc.last_line++;
    } else {
      this.yylloc.last_column++;
    }
    this._input = this._input.slice(1);
    return ch;
  }

  unput(ch) {
    const len = ch.length;
    this._input = ch + this._input;
    this.yytext = this.yytext.slice(0, -len);
    this.offset -= len;
    return this;
  }

  more() {
    this._more = true;
    return this;
  }

  reject() {
    if (this.options.backtrack_lexer) {
      this._backtrack = true;
    } else {
      throw new Error(`Lexical error on line ${this.yylineno + 1}`);
    }
    return this;
  }

  next() {
    if (this.done) return this.EOF;
    if (!this._input) {
      this.done = true;
      return this.EOF;
    }
    const token = this.lex();
    return token || this.next();
  }

  lex() {
    // Integrate lexical rules here
    // Example: Use an array of rules or external configuration
    return this.EOF;
  }
}

module.exports = Lexer;
