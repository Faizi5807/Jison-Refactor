const Set = require('./util/set').Set;

class LookaheadCalculator {
  constructor(generator) {
    this.generator = generator;
  }

  computeLookaheads() {
    this.nullableSets();
    this.firstSets();
    this.followSets();
  }

  nullableSets() {
    let cont = true;
    while (cont) {
      cont = false;
      this.generator.productions.forEach(prod => {
        if (!prod.nullable) {
          let n = 0;
          for (const t of prod.handle) {
            if (this.nullable(t)) n++;
          }
          if (n === prod.handle.length) {
            prod.nullable = cont = true;
          }
        }
      });
      for (const symbol in this.generator.nonterminals) {
        if (!this.nullable(symbol)) {
          for (const prod of this.generator.nonterminals[symbol].productions) {
            if (prod.nullable) {
              this.generator.nonterminals[symbol].nullable = cont = true;
            }
          }
        }
      }
    }
  }

  firstSets() {
    let cont = true;
    while (cont) {
      cont = false;
      this.generator.productions.forEach(prod => {
        const firsts = this.first(prod.handle);
        if (firsts.length !== prod.first.length) {
          prod.first = firsts;
          cont = true;
        }
      });
      for (const symbol in this.generator.nonterminals) {
        const firsts = [];
        this.generator.nonterminals[symbol].productions.forEach(prod => {
          Set.union(firsts, prod.first);
        });
        if (firsts.length !== this.generator.nonterminals[symbol].first.length) {
          this.generator.nonterminals[symbol].first = firsts;
          cont = true;
        }
      }
    }
  }

  followSets() {
    let cont = true;
    while (cont) {
      cont = false;
      this.generator.productions.forEach(prod => {
        for (let i = 0; i < prod.handle.length; i++) {
          const t = prod.handle[i];
          if (!this.generator.nonterminals[t]) continue;
          let set = [];
          const part = prod.handle.slice(i + 1);
          set = this.first(part);
          if (this.nullable(part)) {
            set.push(...this.generator.nonterminals[prod.symbol].follows);
          }
          const oldCount = this.generator.nonterminals[t].follows.length;
          Set.union(this.generator.nonterminals[t].follows, set);
          if (oldCount !== this.generator.nonterminals[t].follows.length) {
            cont = true;
          }
        }
      });
    }
  }

  first(symbol) {
    if (symbol === '') return [];
    if (Array.isArray(symbol)) {
      const firsts = [];
      for (const t of symbol) {
        if (!this.generator.nonterminals[t]) {
          if (!firsts.includes(t)) firsts.push(t);
        } else {
          Set.union(firsts, this.generator.nonterminals[t].first);
        }
        if (!this.nullable(t)) break;
      }
      return firsts;
    }
    return this.generator.nonterminals[symbol] ? this.generator.nonterminals[symbol].first : [symbol];
  }

  nullable(symbol) {
    if (symbol === '') return true;
    if (Array.isArray(symbol)) {
      return symbol.every(t => this.nullable(t));
    }
    return this.generator.nonterminals[symbol] ? this.generator.nonterminals[symbol].nullable : false;
  }
}

module.exports = LookaheadCalculator;