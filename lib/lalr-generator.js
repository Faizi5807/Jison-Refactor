const Generator = require('./generator');
const { Nonterminal, Production } = require('./core');
const LookaheadCalculator = require('./lookahead');

class LALRGenerator extends Generator {
  constructor(grammar, opt) {
    super(grammar, opt);
    this.onDemandLookahead = opt.onDemandLookahead || false;
    this.states = this.tableBuilder.canonicalCollection();
    this.terms_ = {};
    this.inadequateStates = [];
    this.newg = {
      nonterminals: {},
      productions: [],
      nterms_: {},
      go: (r, B) => {
        r = r.split(':')[0];
        B = B.map(b => b.slice(b.indexOf(':') + 1));
        return this.go(r, B);
      }
    };
    this.trace('Building lookahead grammar.');
    this.buildNewGrammar();
    this.trace('Computing lookaheads.');
    new LookaheadCalculator(this.newg).computeLookaheads();
    this.unionLookaheads();
    this.tableBuilder.buildTable();
  }

  lookAheads(state, item) {
    return this.onDemandLookahead && !state.inadequate ? this.terminals : item.follows;
  }

  go(p, w) {
    let q = parseInt(p, 10);
    for (const wi of w) {
      q = this.states.item(q).edges[wi] || q;
    }
    return q;
  }

  goPath(p, w) {
    let q = parseInt(p, 10);
    const path = [];
    for (const wi of w) {
      const t = wi ? `${q}:${wi}` : '';
      if (t) this.newg.nterms_[t] = q;
      path.push(t);
      q = this.states.item(q).edges[wi] || q;
      this.terms_[t] = wi;
    }
    return { path, endState: q };
  }

  buildNewGrammar() {
    this.states.forEach((state, i) => {
      state.forEach(item => {
        if (item.dotPosition === 0) {
          const symbol = `${i}:${item.production.symbol}`;
          this.terms_[symbol] = item.production.symbol;
          this.newg.nterms_[symbol] = i;
          if (!this.newg.nonterminals[symbol]) {
            this.newg.nonterminals[symbol] = new Nonterminal(symbol);
          }
          const pathInfo = this.goPath(i, item.production.handle);
          const p = new Production(symbol, pathInfo.path, this.newg.productions.length);
          this.newg.productions.push(p);
          this.newg.nonterminals[symbol].productions.push(p);
          const handle = item.production.handle.join(' ');
          const goes = this.states.item(pathInfo.endState).goes;
          goes[handle] = goes[handle] || [];
          goes[handle].push(symbol);
        }
      });
      if (state.inadequate) this.inadequateStates.push(i);
    });
  }

  unionLookaheads() {
    const states = this.onDemandLookahead ? this.inadequateStates : this.states;
    states.forEach(i => {
      const state = typeof i === 'number' ? this.states.item(i) : i;
      if (state.reductions.length) {
        state.reductions.forEach(item => {
          const follows = {};
          item.follows.forEach(f => follows[f] = true);
          state.goes[item.production.handle.join(' ')].forEach(symbol => {
            this.newg.nonterminals[symbol].follows.forEach(term => {
              const terminal = this.terms_[term];
              if (!follows[terminal]) {
                follows[terminal] = true;
                item.follows.push(terminal);
              }
            });
          });
        });
      }
    });
  }

  createParser() {
    const parser = eval(this.codeGenerator.generateModuleCode().moduleCode);
    parser.productions = this.productions;
    parser.lexer = this.lexer;
    parser.generate = opt => this.codeGenerator.generate(opt);
    return parser;
  }

  trace(...args) {
    Logger.trace(...args);
  }
}

module.exports = LALRGenerator;