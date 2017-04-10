(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('infestines'), require('kefir'), require('partial.lenses')) :
	typeof define === 'function' && define.amd ? define(['exports', 'infestines', 'kefir', 'partial.lenses'], factory) :
	(factory((global.kefir = global.kefir || {}, global.kefir.atom = global.kefir.atom || {}),global.I,global.kefir,global.L));
}(this, (function (exports,infestines,kefir,partial_lenses) { 'use strict';

//

var header = "kefir.atom: ";

function warn(f, m) {
  if (!f.warned) {
    f.warned = 1;
    console.warn(header + m);
  }
}

function error(m) {
  throw new Error(header + m);
}

function errorGiven(m, o) {
  console.error(header + m + " - given:", o);
  error(m);
}

//

var lock = 0;

var prevs = [];
var atoms = [];

function release() {
  while (prevs.length) {
    var prev = prevs.shift();
    var _atom = atoms.shift();
    var next = _atom._currentEvent.value;

    if (!infestines.identicalU(prev, next)) _atom._emitValue(next);
  }
}

function holding(ef) {
  ++lock;
  try {
    return ef();
  } finally {
    if (! --lock) release();
  }
}

//

function AbstractMutable() {
  kefir.Property.call(this);
}

infestines.inherit(AbstractMutable, kefir.Property, {
  set: function set$$1(value) {
    this.modify(infestines.always(value));
  },
  remove: function remove() {
    this.set();
  },
  view: function view(lens) {
    if (arguments.length !== 1) errorGiven("The `view` method takes exactly 1 argument", arguments.length);
    return new LensedAtom(this, lens);
  },
  _maybeEmitValue: function _maybeEmitValue(next) {
    var prev = this._currentEvent;
    if (!prev || !infestines.identicalU(prev.value, next)) this._emitValue(next);
  }
});

//

function MutableWithSource(source) {
  if (!(source instanceof kefir.Observable)) errorGiven("Expected an Observable", source);
  AbstractMutable.call(this);
  this._source = source;
  this._$onAny = void 0;
}

infestines.inherit(MutableWithSource, AbstractMutable, {
  get: function get$$1() {
    var current = this._currentEvent;
    if (current && !lock) return current.value;else return this._getFromSource();
  },
  _onAny: function _onAny(e) {
    switch (e.type) {
      case "value":
        return this._maybeEmitValue(this._getFromSource());
      case "error":
        return this._emitError(e.value);
      default:
        this._$onAny = void 0;
        return this._emitEnd();
    }
  },
  _onActivation: function _onActivation() {
    var _this = this;

    this._source.onAny(this._$onAny = function (e) {
      return _this._onAny(e);
    });
  },
  _onDeactivation: function _onDeactivation() {
    var onAny = this._$onAny;
    if (onAny) this._source.offAny(onAny);
    this._$onAny = void 0;
  }
});

//

function LensedAtom(source, lens) {
  MutableWithSource.call(this, source);
  this._lens = lens;
}

infestines.inherit(LensedAtom, MutableWithSource, {
  set: function set$$1(v) {
    this._source.set(partial_lenses.set(this._lens, v, this._source.get()));
  },
  modify: function modify$$1(fn) {
    this._source.modify(partial_lenses.modify(this._lens, fn));
  },
  _getFromSource: function _getFromSource() {
    return partial_lenses.get(this._lens, this._source.get());
  }
});

//

function Atom() {
  AbstractMutable.call(this);
  if (arguments.length) this._emitValue(arguments[0]);
}

infestines.inherit(Atom, AbstractMutable, {
  get: function get$$1() {
    var current = this._currentEvent;
    return current ? current.value : void 0;
  },
  set: function set$$1(v) {
    var current = this._currentEvent;
    this._set(current, current ? current.value : void 0, v);
  },
  modify: function modify$$1(fn) {
    var current = this._currentEvent;
    var prev = current ? current.value : void 0;
    this._set(current, prev, fn(prev));
  },
  _set: function _set(current, prev, next) {
    if (lock) {
      if (atoms.indexOf(this) < 0) {
        prevs.push(current ? prev : error /* <- just needs to be unique */);
        atoms.push(this);
      }
      if (current) current.value = next;else this._currentEvent = { type: "value", value: next };
    } else {
      this._maybeEmitValue(next);
    }
  }
});

//

function Join(sources) {
  warn(Join, "Join is an experimental feature and might be removed");
  if (!(sources instanceof kefir.Observable)) errorGiven("Expected an Observable", sources);
  AbstractMutable.call(this);
  this._sources = sources;
  this._source = this._$onSources = this._$onSource = void 0;
}

infestines.inherit(Join, AbstractMutable, {
  get: function get$$1() {
    if (!this._$onSource) warn(this.get, "Join without subscription may not work correctly");
    var source = this._source;
    return source && source.get();
  },
  modify: function modify$$1(fn) {
    if (!this._$onSource) warn(this.modify, "Join without subscription may not work correctly");
    var source = this._source;
    source && source.modify(fn);
  },
  _onSources: function _onSources(e) {
    var _this2 = this;

    switch (e.type) {
      case "value":
        this._maybeUnsubSource();
        return (this._source = e.value).onAny(this._$onSource = function (e) {
          return _this2._onSource(e);
        });
      case "error":
        return this._emitError(e.value);
      default:
        this._$onSources = void 0;
        break;
    }
  },
  _onSource: function _onSource(e) {
    switch (e.type) {
      case "value":
        return this._maybeEmitValue(this._source.get());
      case "error":
        return this._emitError(e.value);
      default:
        return this._emitEnd();
    }
  },
  _onActivation: function _onActivation() {
    var _this3 = this;

    var sources = this._sources;
    sources && sources.onAny(this._$onSources = function (e) {
      return _this3._onSources(e);
    });
  },
  _onDeactivation: function _onDeactivation() {
    this._maybeUnsubSource();
    var onSources = this._$onSources;
    if (onSources) this._sources.offAny(onSources);
    this._$onSources = void 0;
  },
  _maybeUnsubSource: function _maybeUnsubSource() {
    var onSource = this._$onSource;
    if (onSource) this._source.offAny(onSource);
    this._source = this._$onSource = void 0;
  }
});

//

function pushMutables(template, mutables) {
  if (template instanceof AbstractMutable && mutables.indexOf(template) < 0) {
    mutables.push(template);
  } else {
    if (infestines.isArray(template)) for (var i = 0, n = template.length; i < n; ++i) {
      pushMutables(template[i], mutables);
    } else if (infestines.isObject(template)) for (var k in template) {
      pushMutables(template[k], mutables);
    }
  }
}

function molecule(template) {
  if (template instanceof AbstractMutable) {
    return template.get();
  } else {
    if (infestines.isArray(template)) {
      var n = template.length;
      var next = template;
      for (var i = 0; i < n; ++i) {
        var v = molecule(template[i]);
        if (!infestines.identicalU(next[i], v)) {
          if (next === template) next = template.slice(0);
          next[i] = v;
        }
      }
      return next;
    } else if (infestines.isObject(template)) {
      var _next = template;
      for (var k in template) {
        var _v = molecule(template[k]);
        if (!infestines.identicalU(_next[k], _v)) {
          if (_next === template) _next = infestines.assocPartialU(void 0, void 0, template); // Avoid Object.assign
          _next[k] = _v;
        }
      }
      return _next;
    } else {
      return template;
    }
  }
}

function setMutables(template, value) {
  if (template instanceof AbstractMutable) {
    return template.set(value);
  } else {
    if (infestines.isArray(template) && infestines.isArray(value)) for (var i = 0, n = template.length; i < n; ++i) {
      setMutables(template[i], value[i]);
    } else if (infestines.isObject(template) && infestines.isObject(value)) for (var k in template) {
      setMutables(template[k], value[k]);
    } else if (!infestines.identicalU(template, value)) error("Molecule cannot change the template.");
  }
}

var empty = kefir.constant(infestines.array0);

function Molecule(template) {
  var mutables = [];
  pushMutables(template, mutables);
  MutableWithSource.call(this, mutables.length ? kefir.combine(mutables) : empty);
  this._template = template;
}

infestines.inherit(Molecule, MutableWithSource, {
  _getFromSource: function _getFromSource() {
    return molecule(this._template);
  },
  modify: function modify$$1(fn) {
    var _this4 = this;

    var next = fn(this.get());
    holding(function () {
      return setMutables(_this4._template, next);
    });
  }
});

//

function atom() {
  if (arguments.length) return new Atom(arguments[0]);else return new Atom();
}

exports.holding = holding;
exports.AbstractMutable = AbstractMutable;
exports.MutableWithSource = MutableWithSource;
exports.LensedAtom = LensedAtom;
exports.Atom = Atom;
exports.Join = Join;
exports.Molecule = Molecule;
exports['default'] = atom;

Object.defineProperty(exports, '__esModule', { value: true });

})));
