const Lexer = require('./lexer');
const { transform } = require('./ebnf-transform');
const {table}= require('./table');
const {productions} = require('./productions_');
const {defaultActions} = require('./defaultActions');

class Parser {
  constructor(options = {}) {
    this.lexer = new Lexer(options);
    this.yy = {};
    this.table = table;        // load from generated table.jsoon
    this.productions = productions;  // load from generated productions.json
    this.defaultActions = defaultActions;
  }

  parse(input) {
    this.lexer.setInput(input);
    this.yy.parser = this;
    let stack = [0];
    let vstack = [null];
    let symbol;

    while (true) {
      const state = stack[stack.length - 1];
      const action = this._getAction(state, symbol);
      switch (action[0]) {
        case 1:
          stack.push(symbol, action[1]);
          symbol = null;
          break;
        case 2:
          const len = this.productions[action[1]][1];
          const result = this._performAction(action[1], vstack.slice(-len));
          stack = stack.slice(0, -2 * len);
          vstack = vstack.slice(0, -len).concat(result);
          stack.push(this.productions[action[1]][0]);
          break;
        case 3:
          return true;
        default:
          throw new Error('Parse error');
      }
    }
  }

  _getAction(state, symbol) {
    // lookup in table
    return this.table[state][symbol] || this.defaultActions[state];
  }

  _performAction (yytext, yyleng, yylineno, yy, yystate, $$, _$) {
    var $0 = $$.length - 1;
switch (yystate) {
case 1:
          this.$ = $$[$0-4];
          return extend(this.$, $$[$0-2]);
        
break;
case 2:
          this.$ = $$[$0-5];
          yy.addDeclaration(this.$, { include: $$[$0-1] });
          return extend(this.$, $$[$0-3]);
        
break;
case 5:this.$ = $$[$0-1]; yy.addDeclaration(this.$, $$[$0]);
break;
case 6:this.$ = {};
break;
case 7:this.$ = {start: $$[$0]};
break;
case 8:this.$ = {lex: $$[$0]};
break;
case 9:this.$ = {operator: $$[$0]};
break;
case 10:this.$ = {include: $$[$0]};
break;
case 11:this.$ = {parseParam: $$[$0]};
break;
case 12:this.$ = {options: $$[$0]};
break;
case 13:this.$ = $$[$0];
break;
case 14:this.$ = $$[$0];
break;
case 15:this.$ = [$$[$0-1]]; this.$.push.apply(this.$, $$[$0]);
break;
case 16:this.$ = 'left';
break;
case 17:this.$ = 'right';
break;
case 18:this.$ = 'nonassoc';
break;
case 19:this.$ = $$[$0-1]; this.$.push($$[$0]);
break;
case 20:this.$ = [$$[$0]];
break;
case 21:this.$ = $$[$0];
break;
case 22:
            this.$ = $$[$0-1];
            if ($$[$0][0] in this.$) 
                this.$[$$[$0][0]] = this.$[$$[$0][0]].concat($$[$0][1]);
            else
                this.$[$$[$0][0]] = $$[$0][1];
        
break;
case 23:this.$ = {}; this.$[$$[$0][0]] = $$[$0][1];
break;
case 24:this.$ = [$$[$0-3], $$[$0-1]];
break;
case 25:this.$ = $$[$0-2]; this.$.push($$[$0]);
break;
case 26:this.$ = [$$[$0]];
break;
case 27:
            this.$ = [($$[$0-2].length ? $$[$0-2].join(' ') : '')];
            if($$[$0]) this.$.push($$[$0]);
            if($$[$0-1]) this.$.push($$[$0-1]);
            if (this.$.length === 1) this.$ = this.$[0];
        
break;
case 28:this.$ = $$[$0-1]; this.$.push($$[$0])
break;
case 29:this.$ = [];
break;
case 30:this.$ = $$[$0-2]; this.$.push($$[$0].join(' '));
break;
case 31:this.$ = [$$[$0].join(' ')];
break;
case 32:this.$ = $$[$0-2] + $$[$0-1] + "[" + $$[$0] + "]"; 
break;
case 33:this.$ = $$[$0-1] + $$[$0]; 
break;
case 34:this.$ = $$[$0]; 
break;
case 35:this.$ = ebnf ? "'" + $$[$0] + "'" : $$[$0]; 
break;
case 36:this.$ = '(' + $$[$0-1].join(' | ') + ')'; 
break;
case 37:this.$ = ''
break;
case 41:this.$ = {prec: $$[$0]};
break;
case 42:this.$ = null;
break;
case 43:this.$ = $$[$0];
break;
case 44:this.$ = yytext;
break;
case 45:this.$ = yytext;
break;
case 46:this.$ = $$[$0-1];
break;
case 47:this.$ = $$[$0];
break;
case 48:this.$ = '$$ =' + $$[$0] + ';';
break;
case 49:this.$ = '';
break;
case 50:this.$ = '';
break;
case 51:this.$ = $$[$0];
break;
case 52:this.$ = $$[$0-4] + $$[$0-3] + $$[$0-2] + $$[$0-1] + $$[$0];
break;
case 53:this.$ = $$[$0-3] + $$[$0-2] + $$[$0-1] + $$[$0];
break;
case 54: this.$ = yytext; 
break;
case 55: this.$ = $$[$0-1]+$$[$0]; 
break;

    
        default:
           throw new Error(`Unknown state: ${yystate}`);
    }
}

}

module.exports = Parser;