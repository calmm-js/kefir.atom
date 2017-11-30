import { always, array0, assocPartialU, id, identicalU, inherit, isArray, isObject } from 'infestines';
import { Observable, Property, combine, constant } from 'kefir';
import { get, modify, set } from 'partial.lenses';

//

var empty = /*#__PURE__*/constant(array0);

var ERROR = 'error';
var VALUE = void 0;
empty.onAny(function (e) {
  return VALUE = VALUE || e.type;
});

var header = 'kefir.atom: ';

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
  console.error(header + m + ' - given:', o);
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

    if (!identicalU(prev, next)) _atom._emitValue(next);
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

function maybeEmitValue(self, next) {
  var prev = self._currentEvent;
  if (!prev || !identicalU(prev.value, next)) self._emitValue(next);
}

var AbstractMutable = /*#__PURE__*/inherit(function () {
  Property.call(this);
}, Property, {
  set: function set$$1(value) {
    this.modify(always(value));
  },
  remove: function remove() {
    this.set();
  },

  view: (process.env.NODE_ENV === 'production' ? id : function (method) {
    return function (lens) {
      if (arguments.length !== 1) errorGiven('The `view` method takes exactly 1 argument', arguments.length);
      return method.call(this, lens);
    };
  })(function (lens) {
    return new LensedAtom(this, lens);
  })
});

//

var MutableWithSource = /*#__PURE__*/inherit((process.env.NODE_ENV === 'production' ? id : function (constructor) {
  return function (source) {
    if (!(source instanceof Observable)) errorGiven('Expected an Observable', source);
    constructor.call(this, source);
  };
})(function (source) {
  AbstractMutable.call(this);
  this._source = source;
  this._$onAny = void 0;
}), AbstractMutable, {
  get: function get$$1() {
    var current = this._currentEvent;
    if (current && !lock) return current.value;else return this._getFromSource();
  },
  _onActivation: function _onActivation() {
    var _this = this;

    this._source.onAny(this._$onAny = function (e) {
      var t = e.type;
      if (t === VALUE) maybeEmitValue(_this, _this._getFromSource());else if (t === ERROR) _this._emitError(e.value);else {
        _this._$onAny = void 0;
        _this._emitEnd();
      }
    });
  },
  _onDeactivation: function _onDeactivation() {
    var onAny = this._$onAny;
    if (onAny) this._source.offAny(onAny);
    this._$onAny = void 0;
  }
});

//

var LensedAtom = /*#__PURE__*/inherit(function (source, lens) {
  MutableWithSource.call(this, source);
  this._lens = lens;
}, MutableWithSource, {
  set: function set$$1(v) {
    this._source.set(set(this._lens, v, this._source.get()));
  },
  modify: function modify$$1(fn) {
    this._source.modify(modify(this._lens, fn));
  },
  _getFromSource: function _getFromSource() {
    return get(this._lens, this._source.get());
  }
});

//

function setAtom(self, current, prev, next) {
  if (lock) {
    if (atoms.indexOf(self) < 0) {
      prevs.push(current ? prev : error /* <- just needs to be unique */);
      atoms.push(self);
    }
    if (current) current.value = next;else self._currentEvent = { type: VALUE, value: next };
  } else {
    maybeEmitValue(self, next);
  }
}

var Atom = /*#__PURE__*/inherit(function () {
  AbstractMutable.call(this);
  if (arguments.length) this._emitValue(arguments[0]);
}, AbstractMutable, {
  get: function get$$1() {
    var current = this._currentEvent;
    return current ? current.value : void 0;
  },
  set: function set$$1(v) {
    var current = this._currentEvent;
    setAtom(this, current, current ? current.value : void 0, v);
  },
  modify: function modify$$1(fn) {
    var current = this._currentEvent;
    var prev = current ? current.value : void 0;
    setAtom(this, current, prev, fn(prev));
  }
});

//

function maybeUnsubSource(self) {
  var onSource = self._$onSource;
  if (onSource) self._source.offAny(onSource);
  self._source = self._$onSource = void 0;
}

var Join = /*#__PURE__*/inherit((process.env.NODE_ENV === 'production' ? id : function (constructor) {
  return function (sources) {
    if (!(sources instanceof Observable)) errorGiven('Expected an Observable', sources);
    constructor.call(this, sources);
  };
})(function (sources) {
  AbstractMutable.call(this);
  this._sources = sources;
  this._source = this._$onSources = this._$onSource = void 0;
}), AbstractMutable, {
  get: (process.env.NODE_ENV === 'production' ? id : function (method) {
    return function () {
      if (!this._$onSource) warn(this.get, 'Join without subscription may not work correctly');
      return method.call(this);
    };
  })(function () {
    var source = this._source;
    return source && source.get();
  }),
  modify: (process.env.NODE_ENV === 'production' ? id : function (method) {
    return function (fn) {
      if (!this._$onSource) warn(this.modify, 'Join without subscription may not work correctly');
      return method.call(this, fn);
    };
  })(function (fn) {
    var source = this._source;
    source && source.modify(fn);
  }),
  _onActivation: function _onActivation() {
    var _this2 = this;

    var sources = this._sources;
    sources && sources.onAny(this._$onSources = function (e) {
      var t = e.type;
      if (t === VALUE) {
        maybeUnsubSource(_this2);(_this2._source = e.value).onAny(_this2._$onSource = function (e) {
          var t = e.type;
          if (t === VALUE) maybeEmitValue(_this2, _this2._source.get());else if (t === ERROR) _this2._emitError(e.value);else _this2._emitEnd();
        });
      } else if (t === ERROR) _this2._emitError(e.value);else _this2._$onSources = void 0;
    });
  },
  _onDeactivation: function _onDeactivation() {
    maybeUnsubSource(this);
    var onSources = this._$onSources;
    if (onSources) this._sources.offAny(onSources);
    this._$onSources = void 0;
  }
});

//

function pushMutables(template, mutables) {
  if (template instanceof AbstractMutable && mutables.indexOf(template) < 0) {
    mutables.push(template);
  } else {
    if (isArray(template)) for (var i = 0, n = template.length; i < n; ++i) {
      pushMutables(template[i], mutables);
    } else if (isObject(template)) for (var k in template) {
      pushMutables(template[k], mutables);
    }
  }
}

function molecule(template) {
  if (template instanceof AbstractMutable) {
    return template.get();
  } else {
    if (isArray(template)) {
      var n = template.length;
      var next = template;
      for (var i = 0; i < n; ++i) {
        var v = molecule(template[i]);
        if (!identicalU(next[i], v)) {
          if (next === template) next = template.slice(0);
          next[i] = v;
        }
      }
      return next;
    } else if (isObject(template)) {
      var _next = template;
      for (var k in template) {
        var _v = molecule(template[k]);
        if (!identicalU(_next[k], _v)) {
          if (_next === template) _next = assocPartialU(void 0, void 0, template); // Avoid Object.assign
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
    template.set(value);
  } else {
    if (isArray(template) && isArray(value)) for (var i = 0, n = template.length; i < n; ++i) {
      setMutables(template[i], value[i]);
    } else if (isObject(template) && isObject(value)) for (var k in template) {
      setMutables(template[k], value[k]);
    } else if (!identicalU(template, value)) error('Molecule cannot change the template.');
  }
}

var Molecule = /*#__PURE__*/inherit(function (template) {
  var mutables = [];
  pushMutables(template, mutables);
  MutableWithSource.call(this, mutables.length ? combine(mutables) : empty);
  this._template = template;
}, MutableWithSource, {
  _getFromSource: function _getFromSource() {
    return molecule(this._template);
  },
  modify: function modify$$1(fn) {
    var _this3 = this;

    var next = fn(this.get());
    holding(function () {
      return setMutables(_this3._template, next);
    });
  }
});

//

function atom() {
  if (arguments.length) return new Atom(arguments[0]);else return new Atom();
}

export { holding, AbstractMutable, MutableWithSource, LensedAtom, Atom, Join, Molecule };
export default atom;
