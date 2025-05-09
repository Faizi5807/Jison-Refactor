// typal.js

'use strict';

const position = /^(before|after)/;

function create(o) {
  function F() {}
  F.prototype = o;
  return new F();
}

function layerMethod(k, fn) {
  const pos = k.match(position)[0];
  const key = k.replace(position, '');
  const original = this[key];

  if (pos === 'after') {
    this[key] = function () {
      const ret = original.apply(this, arguments);
      const args = [ret, ...arguments];
      fn.apply(this, args);
      return ret;
    };
  } else if (pos === 'before') {
    this[key] = function () {
      fn.apply(this, arguments);
      return original.apply(this, arguments);
    };
  }
}

function typalMix() {
  for (let i = 0; i < arguments.length; i++) {
    const o = arguments[i];
    if (!o) continue;

    if (Object.prototype.hasOwnProperty.call(o, 'constructor')) {
      this.constructor = o.constructor;
    }

    if (Object.prototype.hasOwnProperty.call(o, 'toString')) {
      this.toString = o.toString;
    }

    for (const k in o) {
      if (Object.prototype.hasOwnProperty.call(o, k)) {
        if (k.match(position) && typeof this[k.replace(position, '')] === 'function') {
          layerMethod.call(this, k, o[k]);
        } else {
          this[k] = o[k];
        }
      }
    }
  }
  return this;
}

const typal = {
  mix: typalMix,

  beget: function () {
    return arguments.length ? typalMix.apply(create(this), arguments) : create(this);
  },

	construct: function () {
		const o = typalMix.apply(create(this), arguments);
		const constructor = o.constructor || function () {};
		const Klass = function TypalConstructedClass() {
			return constructor.apply(this, arguments);
		};
		Klass.prototype = o;
		Klass.mix = typalMix;
		return Klass;
	}
	,

  constructor: function () {
    return this;
  },
};

module.exports = { typal };
