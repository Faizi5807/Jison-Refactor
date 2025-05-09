const { Constants, Logger, Nonterminal, Production } = require('./core');
const Lexer = require('jison-lex');
const ebnfParser = require('ebnf-parser');
const LookaheadCalculator = require('./lookahead');
const LRTableBuilder = require('./table-builder');
const CodeGenerator = require('./code-generator');

class Generator {
  constructor(grammar, opt) {
    this.options = { ...grammar.options, ...opt };
    this.terms = {};
    this.operators = {};
    this.productions = [];
    this.productions_ = [0];
    this.conflicts = 0;
    this.resolutions = [];
    this.parseParams = grammar.parseParams;
    this.yy = {};
    this.actionInclude = typeof grammar.actionInclude === 'function' ? String(grammar.actionInclude).replace(/^\s*function \(\) \{/, '').replace(/\}\s*$/, '') : grammar.actionInclude || '';
    this.moduleInclude = grammar.moduleInclude || '';
    this.symbolTable = {};
    this.terminals = [];
    this.nonterminals = {};
    this.symbols = [];
    Logger.setDebug(this.options.debug || false);
    this.processGrammar(grammar);
    if (grammar.lex) {
      this.lexer = new Lexer(grammar.lex, null, this.terminals);
    }
    this.lookaheadCalculator = new LookaheadCalculator(this);
    this.tableBuilder = new LRTableBuilder(this);
    this.codeGenerator = new CodeGenerator(this);
  }

  processGrammar(grammar) {
    let bnf = grammar.bnf;
    if (!bnf && grammar.ebnf) {
      bnf = grammar.bnf = ebnfParser.transform(grammar.ebnf);
    }
    let tokens = grammar.tokens;
    if (tokens) {
      tokens = typeof tokens === 'string' ? tokens.trim().split(' ') : tokens.slice(0);
    }
    this.operators = this.processOperators(grammar.operators);
    this.buildProductions(bnf);
    if (tokens && this.terminals.length !== tokens.length) {
      Logger.warn('Warning: declared tokens differ from tokens found in rules.');
      Logger.warn(this.terminals, tokens);
    }
    this.augmentGrammar(grammar);
  }

  processOperators(ops) {
    if (!ops) return {};
    const operators = {};
    ops.forEach((prec, i) => {
      for (let k = 1; k < prec.length; k++) {
        operators[prec[k]] = { precedence: i + 1, assoc: prec[0] };
      }
    });
    return operators;
  }

  buildProductions(bnf) {
    const actions = ['/* this == yyval */', this.actionInclude, 'var $0 = $$.length - 1;', 'switch (yystate) {'];
    const actionGroups = {};
    let symbolId = 1;
    this.symbolTable = {};

    const addSymbol = s => {
      if (s && !this.symbolTable[s]) {
        this.symbolTable[s] = ++symbolId;
        this.symbols.push(s);
      }
    };

    addSymbol(Constants.ERROR_TOKEN);
    for (const symbol in bnf) {
      if (!bnf.hasOwnProperty(symbol)) continue;
      addSymbol(symbol);
      this.nonterminals[symbol] = new Nonterminal(symbol);
      const prods = typeof bnf[symbol] === 'string' ? bnf[symbol].split(/\s*\|\s*/g) : bnf[symbol].slice(0);
      prods.forEach(prod => this.buildProduction(symbol, prod, actions, actionGroups, addSymbol));
    }
    for (const action in actionGroups) {
      actions.push(actionGroups[action].join(' '), action, 'break;');
    }
    const terms = [];
    const terms_ = {};
    for (const sym in this.symbolTable) {
      if (!this.nonterminals[sym]) {
        terms.push(sym);
        terms_[this.symbolTable[sym]] = sym;
      }
    }
    this.terminals = terms;
    this.hasErrorRecovery = actions.some(a => a.includes('error'));
    actions.push('}');
    const parameters = 'yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */';
    this.performAction = `function(${this.parseParams ? parameters + ', ' + this.parseParams.join(', ') : parameters}) {\n${actions.join('\n').replace(/YYABORT/g, 'return false').replace(/YYACCEPT/g, 'return true')}\n}`;
  }

  buildProduction(symbol, handle, actions, actionGroups, addSymbol) {
    let rhs, action;
    if (Array.isArray(handle)) {
      rhs = typeof handle[0] === 'string' ? handle[0].trim().split(' ') : handle[0].slice(0);
      rhs.forEach(s => {
        if (s === Constants.ERROR_TOKEN) this.hasErrorRecovery = true;
        addSymbol(s);
      });
      if (typeof handle[1] === 'string' || handle.length === 3) {
        const label = `case ${this.productions.length + 1}:`;
        action = handle[1];
        if (action.match(/[$@][a-zA-Z][a-zA-Z0-9_]*/)) {
          const count = {};
          const names = {};
          rhs.forEach((r, i) => {
            let rhs_i = r.match(/\[[a-zA-Z][a-zA-Z0-9_-]*\]/);
            if (rhs_i) {
              rhs_i = rhs_i[0].slice(1, -1);
              rhs[i] = r.slice(0, r.indexOf('['));
            } else {
              rhs_i = r;
            }
            if (names[rhs_i]) {
              names[rhs_i + (++count[rhs_i])] = i + 1;
            } else {
              names[rhs_i] = i + 1;
              names[rhs_i + '1'] = i + 1;
              count[rhs_i] = 1;
            }
          });
          action = action.replace(/\$([a-zA-Z][a-zA-Z0-9_]*)/g, (str, pl) => names[pl] ? `$${names[pl]}` : str)
                         .replace(/@([a-zA-Z][a-zA-Z0-9_]*)/g, (str, pl) => names[pl] ? `@${names[pl]}` : str);
        }
        action = action.replace(/([^'"])\$\$|^\$\$/g, '$1this.$').replace(/@[0$]/g, 'this._$')
                       .replace(/\$(-?\d+)/g, (_, n) => `$$[$0${parseInt(n, 10) - rhs.length || ''}]`)
                       .replace(/@(-?\d+)/g, (_, n) => `_$[$0${n - rhs.length || ''}]`);
        actionGroups[action] = actionGroups[action] || [];
        actionGroups[action].push(label);
        rhs = rhs.map(e => e.replace(/\[[a-zA-Z_][a-zA-Z0-9_-]*\]/g, ''));
        const prod = new Production(symbol, rhs, this.productions.length + 1);
        if (handle[2] && this.operators[handle[2].prec]) {
          prod.precedence = this.operators[handle[2].prec].precedence;
        }
        this.addProduction(prod);
      } else {
        rhs = rhs.map(e => e.replace(/\[[a-zA-Z_][a-zA-Z0-9_-]*\]/g, ''));
        const prod = new Production(symbol, rhs, this.productions.length + 1);
        if (this.operators[handle[1].prec]) {
          prod.precedence = this.operators[handle[1].prec].precedence;
        }
        this.addProduction(prod);
      }
    } else {
      rhs = handle.trim().split(' ');
      rhs.forEach(s => {
        if (s === Constants.ERROR_TOKEN) this.hasErrorRecovery = true;
        addSymbol(s);
      });
      const prod = new Production(symbol, rhs, this.productions.length + 1);
      this.addProduction(prod);
    }
  }

  addProduction(prod) {
    if (prod.precedence === 0) {
      for (let i = prod.handle.length - 1; i >= 0; i--) {
        if (!(prod.handle[i] in this.nonterminals) && prod.handle[i] in this.operators) {
          prod.precedence = this.operators[prod.handle[i]].precedence;
        }
      }
    }
    this.productions.push(prod);
    this.productions_.push([this.symbolTable[prod.symbol], prod.handle[0] === '' ? 0 : prod.handle.length]);
    this.nonterminals[prod.symbol].productions.push(prod);
  }

  augmentGrammar(grammar) {
    if (this.productions.length === 0) {
      Logger.error('Grammar error: must have at least one rule.');
    }
    this.startSymbol = grammar.start || grammar.startSymbol || this.productions[0].symbol;
    if (!this.nonterminals[this.startSymbol]) {
      Logger.error('Grammar error: startSymbol must be a non-terminal.');
    }
    const acceptProduction = new Production('$accept', [this.startSymbol, Constants.EOF], 0);
    this.productions.unshift(acceptProduction);
    this.symbols.unshift('$accept', Constants.EOF);
    this.symbolTable['$accept'] = 0;
    this.symbolTable[Constants.EOF] = 1;
    this.terminals.unshift(Constants.EOF);
    this.nonterminals['$accept'] = new Nonterminal('$accept');
    this.nonterminals['$accept'].productions.push(acceptProduction);
    this.nonterminals[this.startSymbol].follows.push(Constants.EOF);
  }

  parse(input) {
    const stack = [0];
    const tstack = [];
    const vstack = [null];
    const lstack = [];
    let yytext = '';
    let yylineno = 0;
    let yyleng = 0;
    let recovering = 0;
    let symbol = null;
    let preErrorSymbol = null;
    const lexer = Object.create(this.lexer);
    const sharedState = { yy: { ...this.yy, lexer, parser: this } };
    lexer.setInput(input, sharedState.yy);
    let yyloc = lexer.yylloc || {};
    lstack.push(yyloc);
    const ranges = lexer.options && lexer.options.ranges;
    const parseError = sharedState.yy.parseError || this.parseError || this.defaultParseError;

    const lex = () => {
      let token = tstack.pop() || lexer.lex() || Constants.EOF_TOKEN;
      if (typeof token !== 'number') {
        if (Array.isArray(token)) {
          tstack.push(...token);
          token = tstack.pop();
        }
        token = this.symbolTable[token] || token;
      }
      return token;
    };

    const popStack = n => {
      stack.length -= 2 * n;
      vstack.length -= n;
      lstack.length -= n;
    };

    while (true) {
      const state = stack[stack.length - 1];
      let action = this.defaultActions[state] || (symbol === null || symbol === undefined ? (symbol = lex()) : undefined, this.table[state] && this.table[state][symbol]);

      if (!action || !action.length || !action[0]) {
        let errStr = '';
        const expected = [];
        for (const p in this.table[state]) {
          if (this.terminals[p] && p > Constants.TERROR) {
            expected.push(`'${this.terminals[p]}'`);
          }
        }
        if (lexer.showPosition) {
          errStr = `Parse error on line ${yylineno + 1}:\n${lexer.showPosition()}\nExpecting ${expected.join(', ')}, got '${this.terminals[symbol] || symbol}'`;
        } else {
          errStr = `Parse error on line ${yylineno + 1}: Unexpected ${symbol === Constants.EOF_TOKEN ? 'end of input' : `'${this.terminals[symbol] || symbol}'`}`;
        }
        const errorRuleDepth = this.locateNearestErrorRecoveryRule(state, stack);
        if (!recovering) {
          parseError(errStr, {
            text: lexer.match,
            token: this.terminals[symbol] || symbol,
            line: lexer.yylineno,
            loc: yyloc,
            expected,
            recoverable: errorRuleDepth !== false
          });
        } else if (preErrorSymbol !== Constants.EOF_TOKEN) {
          errorRuleDepth = this.locateNearestErrorRecoveryRule(state, stack);
        }
        if (recovering === 3) {
          if (symbol === Constants.EOF_TOKEN || preErrorSymbol === Constants.EOF_TOKEN) {
            throw new Error(errStr || 'Parsing halted while recovering from another error.');
          }
          yyleng = lexer.yyleng;
          yytext = lexer.yytext;
          yylineno = lexer.yylineno;
          yyloc = lexer.yylloc;
          symbol = lex();
        }
        if (errorRuleDepth === false) {
          throw new Error(errStr || 'Parsing halted. No suitable error recovery rule available.');
        }
        popStack(errorRuleDepth);
        preErrorSymbol = symbol === Constants.TERROR ? null : symbol;
        symbol = Constants.TERROR;
        action = this.table[state] && this.table[state][Constants.TERROR];
        recovering = 3;
      }

      if (Array.isArray(action[0]) && action.length > 1) {
        throw new Error(`Parse Error: multiple actions possible at state: ${state}, token: ${symbol}`);
      }

      switch (action[0]) {
        case Constants.SHIFT_STATE:
          stack.push(symbol);
          vstack.push(lexer.yytext);
          lstack.push(lexer.yylloc);
          stack.push(action[1]);
          symbol = null;
          if (!preErrorSymbol) {
            yyleng = lexer.yyleng;
            yytext = lexer.yytext;
            yylineno = lexer.yylineno;
            yyloc = lexer.yylloc;
            if (recovering > 0) recovering--;
          } else {
            symbol = preErrorSymbol;
            preErrorSymbol = null;
          }
          break;
        case Constants.REDUCE_STATE:
          const len = this.productions_[action[1]][1];
          const yyval = {
            $: vstack[vstack.length - len] || null,
            _: {
              first_line: lstack[lstack.length - (len || 1)].first_line,
              last_line: lstack[lstack.length - 1].last_line,
              first_column: lstack[lstack.length - (len || 1)].first_column,
              last_column: lstack[lstack.length - 1].last_column,
              ...(ranges ? { range: [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]] } : {})
            }
          };
          const r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack].concat(this.parseParams || []));
          if (r !== undefined) return r;
          if (len) {
            stack.length -= 2 * len;
            vstack.length -= len;
            lstack.length -= len;
          }
          stack.push(this.productions_[action[1]][0]);
          vstack.push(yyval.$);
          lstack.push(yyval._);
          stack.push(this.table[stack[stack.length - 2]][stack[stack.length - 1]]);
          break;
        case Constants.ACCEPT_STATE:
          return true;
      }
    }
  }

  locateNearestErrorRecoveryRule(state, stack) {
    let stackProbe = stack.length - 1;
    let depth = 0;
    while (true) {
      if (Constants.TERROR.toString() in this.table[state]) {
        return depth;
      }
      if (state === 0 || stackProbe < 2) {
        return false;
      }
      stackProbe -= 2;
      state = stack[stackProbe];
      depth++;
    }
  }

  defaultParseError(str, hash) {
    if (hash.recoverable) {
      Logger.trace(str);
    } else {
      const error = new Error(str);
      error.hash = hash;
      throw error;
    }
  }

  createParser() {
    throw new Error('Abstract method');
  }
}

module.exports = Generator;