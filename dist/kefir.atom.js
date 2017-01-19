(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.kefir || (g.kefir = {})).atom = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.holding = holding;
exports.AbstractMutable = AbstractMutable;
exports.MutableWithSource = MutableWithSource;
exports.SettableProperty = SettableProperty;
exports.LensedAtom = LensedAtom;
exports.Atom = Atom;
exports.Molecule = Molecule;
exports.default = atom;

var _infestines = require("infestines");

var _kefir = require("kefir");

var _partial = require("partial.lenses");

//

var lock = 0;

var prevs = [];
var atoms = [];

function release() {
  while (prevs.length) {
    var prev = prevs.shift();
    var _atom = atoms.shift();
    var next = _atom._currentEvent.value;

    if (!(0, _infestines.identicalU)(prev, next)) _atom._emitValue(next);
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
  _kefir.Property.call(this);
}

(0, _infestines.inherit)(AbstractMutable, _kefir.Property, {
  set: function set(value) {
    this.modify((0, _infestines.always)(value));
  },
  remove: function remove() {
    this.set();
  },
  view: function view(lens) {
    if ("dev" !== "production" && arguments.length !== 1) throw new Error("kefir.atom: The `view` method takes exactly 1 argument.");
    return new LensedAtom(this, lens);
  },
  _maybeEmitValue: function _maybeEmitValue(next) {
    var prev = this._currentEvent;
    if (!prev || !(0, _infestines.identicalU)(prev.value, next)) this._emitValue(next);
  }
});

//

function MutableWithSource(source) {
  if ("dev" !== "production" && !(source instanceof _kefir.Observable)) throw new Error("kefir.atom: Expected an Observable.");
  AbstractMutable.call(this);
  this._source = source;
  this._$onAny = null;
}

(0, _infestines.inherit)(MutableWithSource, AbstractMutable, {
  get: function get() {
    var current = this._currentEvent;
    if (current && !lock) return current.value;else return this._getFromSource();
  },
  _onAny: function _onAny() {
    this._maybeEmitValue(this._getFromSource());
  },
  _onActivation: function _onActivation() {
    var _this = this;

    var onAny = function onAny() {
      return _this._onAny();
    };
    this._$onAny = onAny;
    this._source.onAny(onAny);
  },
  _onDeactivation: function _onDeactivation() {
    this._source.offAny(this._$onAny);
    this._$onAny = null;
    this._currentEvent = null;
  }
});

//

function SettableProperty(property, setter) {
  if ("dev" !== "production" && !(property instanceof _kefir.Property)) throw new Error("kefir.atom: Expected a Property.");
  MutableWithSource.call(this, property);
  this._setter = setter;
}

(0, _infestines.inherit)(SettableProperty, MutableWithSource, {
  _getFromSource: function _getFromSource() {
    var current = this._source._currentEvent;
    return current && current.value;
  },
  set: function set(value) {
    (0, this._setter)(value);
  },
  modify: function modify(fn) {
    this.set(fn(this._getFromSource()));
  }
});

//

function LensedAtom(source, lens) {
  MutableWithSource.call(this, source);
  this._lens = lens;
}

(0, _infestines.inherit)(LensedAtom, MutableWithSource, {
  set: function set(v) {
    this._source.set((0, _partial.set)(this._lens, v, this._source.get()));
  },
  modify: function modify(fn) {
    this._source.modify((0, _partial.modify)(this._lens, fn));
  },
  _getFromSource: function _getFromSource() {
    return (0, _partial.get)(this._lens, this._source.get());
  }
});

//

function Atom() {
  AbstractMutable.call(this);
  if (arguments.length) this._emitValue(arguments[0]);
}

(0, _infestines.inherit)(Atom, AbstractMutable, {
  get: function get() {
    var current = this._currentEvent;
    return current ? current.value : undefined;
  },
  set: function set(v) {
    var current = this._currentEvent;
    this._set(current, current ? current.value : undefined, v);
  },
  modify: function modify(fn) {
    var current = this._currentEvent;
    var prev = current ? current.value : undefined;
    this._set(current, prev, fn(prev));
  },
  _set: function _set(current, prev, next) {
    if (lock) {
      if (atoms.indexOf(this) < 0) {
        prevs.push(current ? prev : mismatch);
        atoms.push(this);
      }
      if (current) current.value = next;else this._currentEvent = { type: "value", value: next };
    } else {
      this._maybeEmitValue(next);
    }
  }
});

//

function pushMutables(template, mutables) {
  if (template instanceof AbstractMutable && mutables.indexOf(template) < 0) {
    mutables.push(template);
  } else {
    if ((0, _infestines.isArray)(template)) for (var i = 0, n = template.length; i < n; ++i) {
      pushMutables(template[i], mutables);
    } else if ((0, _infestines.isObject)(template)) for (var k in template) {
      pushMutables(template[k], mutables);
    }
  }
}

function molecule(template) {
  if (template instanceof AbstractMutable) {
    return template.get();
  } else {
    if ((0, _infestines.isArray)(template)) {
      var n = template.length;
      var next = Array(n);
      for (var i = 0; i < n; ++i) {
        next[i] = molecule(template[i]);
      }return next;
    } else if ((0, _infestines.isObject)(template)) {
      var _next = {};
      for (var k in template) {
        _next[k] = molecule(template[k]);
      }return _next;
    } else {
      return template;
    }
  }
}

function mismatch() {
  throw new Error("Molecule cannot change the template.");
}

function setMutables(template, value) {
  if (template instanceof AbstractMutable) {
    return template.set(value);
  } else {
    if ((0, _infestines.isArray)(template) && (0, _infestines.isArray)(value)) for (var i = 0, n = template.length; i < n; ++i) {
      setMutables(template[i], value[i]);
    } else if ((0, _infestines.isObject)(template) && (0, _infestines.isObject)(value)) for (var k in template) {
      setMutables(template[k], value[k]);
    } else if (!(0, _infestines.identicalU)(template, value)) mismatch();
  }
}

function Molecule(template) {
  var mutables = [];
  pushMutables(template, mutables);
  MutableWithSource.call(this, (0, _kefir.combine)(mutables));
  this._template = template;
}

(0, _infestines.inherit)(Molecule, MutableWithSource, {
  _getFromSource: function _getFromSource() {
    return molecule(this._template);
  },
  modify: function modify(fn) {
    var _this2 = this;

    var next = fn(this.get());
    holding(function () {
      return setMutables(_this2._template, next);
    });
  }
});

//

function atom() {
  if (arguments.length) return new Atom(arguments[0]);else return new Atom();
}

},{"infestines":undefined,"kefir":undefined,"partial.lenses":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMva2VmaXIuYXRvbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O1FDc0JnQixPLEdBQUEsTztRQVlBLGUsR0FBQSxlO1FBeUJBLGlCLEdBQUEsaUI7UUFpQ0EsZ0IsR0FBQSxnQjtRQXNCQSxVLEdBQUEsVTtRQW1CQSxJLEdBQUEsSTtRQTBGQSxRLEdBQUEsUTtrQkFtQlEsSTs7QUFsUHhCOztBQUNBOztBQUNBOztBQUVBOztBQUVBLElBQUksT0FBTyxDQUFYOztBQUVBLElBQU0sUUFBUSxFQUFkO0FBQ0EsSUFBTSxRQUFRLEVBQWQ7O0FBRUEsU0FBUyxPQUFULEdBQW1CO0FBQ2pCLFNBQU8sTUFBTSxNQUFiLEVBQXFCO0FBQ25CLFFBQU0sT0FBTyxNQUFNLEtBQU4sRUFBYjtBQUNBLFFBQU0sUUFBTyxNQUFNLEtBQU4sRUFBYjtBQUNBLFFBQU0sT0FBTyxNQUFLLGFBQUwsQ0FBbUIsS0FBaEM7O0FBRUEsUUFBSSxDQUFDLDRCQUFXLElBQVgsRUFBaUIsSUFBakIsQ0FBTCxFQUNFLE1BQUssVUFBTCxDQUFnQixJQUFoQjtBQUNIO0FBQ0Y7O0FBRU0sU0FBUyxPQUFULENBQWlCLEVBQWpCLEVBQXFCO0FBQzFCLElBQUUsSUFBRjtBQUNBLE1BQUk7QUFDRixXQUFPLElBQVA7QUFDRCxHQUZELFNBRVU7QUFDUixRQUFJLENBQUMsR0FBRSxJQUFQLEVBQ0U7QUFDSDtBQUNGOztBQUVEOztBQUVPLFNBQVMsZUFBVCxHQUEyQjtBQUNoQyxrQkFBUyxJQUFULENBQWMsSUFBZDtBQUNEOztBQUVELHlCQUFRLGVBQVIsbUJBQW1DO0FBQ2pDLEtBRGlDLGVBQzdCLEtBRDZCLEVBQ3RCO0FBQ1QsU0FBSyxNQUFMLENBQVksd0JBQU8sS0FBUCxDQUFaO0FBQ0QsR0FIZ0M7QUFJakMsUUFKaUMsb0JBSXhCO0FBQ1AsU0FBSyxHQUFMO0FBQ0QsR0FOZ0M7QUFPakMsTUFQaUMs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QUFOLENBQXpCO0FBREYsS0FERyxNQUdBLElBQUksQ0FBQyw0QkFBVyxRQUFYLEVBQXFCLEtBQXJCLENBQUwsRUFDSDtBQUNIO0FBQ0Y7O0FBRU0sU0FBUyxRQUFULENBQWtCLFFBQWxCLEVBQTRCO0FBQ2pDLE1BQU0sV0FBVyxFQUFqQjtBQUNBLGVBQWEsUUFBYixFQUF1QixRQUF2QjtBQUNBLG9CQUFrQixJQUFsQixDQUF1QixJQUF2QixFQUE2QixvQkFBUSxRQUFSLENBQTdCO0FBQ0EsT0FBSyxTQUFMLEdBQWlCLFFBQWpCO0FBQ0Q7O0FBRUQseUJBQVEsUUFBUixFQUFrQixpQkFBbEIsRUFBcUM7QUFDbkMsZ0JBRG1DLDRCQUNsQjtBQUNmLFdBQU8sU0FBUyxLQUFLLFNBQWQsQ0FBUDtBQUNELEdBSGtDO0FBSW5DLFFBSm1DLGtCQUk1QixFQUo0QixFQUl4QjtBQUFBOztBQUNULFFBQU0sT0FBTyxHQUFHLEtBQUssR0FBTCxFQUFILENBQWI7QUFDQSxZQUFRO0FBQUEsYUFBTSxZQUFZLE9BQUssU0FBakIsRUFBNEIsSUFBNUIsQ0FBTjtBQUFBLEtBQVI7QUFDRDtBQVBrQyxDQUFyQzs7QUFVQTs7QUFFZSxTQUFTLElBQVQsR0FBZ0I7QUFDN0IsTUFBSSxVQUFVLE1BQWQsRUFDRSxPQUFPLElBQUksSUFBSixDQUFTLFVBQVUsQ0FBVixDQUFULENBQVAsQ0FERixLQUdFLE9BQU8sSUFBSSxJQUFKLEVBQVA7QUFDSCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJpbXBvcnQge2Fsd2F5cywgaWRlbnRpY2FsVSwgaW5oZXJpdCwgaXNBcnJheSwgaXNPYmplY3R9IGZyb20gXCJpbmZlc3RpbmVzXCJcbmltcG9ydCB7T2JzZXJ2YWJsZSwgUHJvcGVydHksIGNvbWJpbmV9IGZyb20gXCJrZWZpclwiXG5pbXBvcnQge2dldCwgbW9kaWZ5LCBzZXR9IGZyb20gXCJwYXJ0aWFsLmxlbnNlc1wiXG5cbi8vXG5cbmxldCBsb2NrID0gMFxuXG5jb25zdCBwcmV2cyA9IFtdXG5jb25zdCBhdG9tcyA9IFtdXG5cbmZ1bmN0aW9uIHJlbGVhc2UoKSB7XG4gIHdoaWxlIChwcmV2cy5sZW5ndGgpIHtcbiAgICBjb25zdCBwcmV2ID0gcHJldnMuc2hpZnQoKVxuICAgIGNvbnN0IGF0b20gPSBhdG9tcy5zaGlmdCgpXG4gICAgY29uc3QgbmV4dCA9IGF0b20uX2N1cnJlbnRFdmVudC52YWx1ZVxuXG4gICAgaWYgKCFpZGVudGljYWxVKHByZXYsIG5leHQpKVxuICAgICAgYXRvbS5fZW1pdFZhbHVlKG5leHQpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvbGRpbmcoZWYpIHtcbiAgKytsb2NrXG4gIHRyeSB7XG4gICAgcmV0dXJuIGVmKClcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoIS0tbG9jaylcbiAgICAgIHJlbGVhc2UoKVxuICB9XG59XG5cbi8vXG5cbmV4cG9ydCBmdW5jdGlvbiBBYnN0cmFjdE11dGFibGUoKSB7XG4gIFByb3BlcnR5LmNhbGwodGhpcylcbn1cblxuaW5oZXJpdChBYnN0cmFjdE11dGFibGUsIFByb3BlcnR5LCB7XG4gIHNldCh2YWx1ZSkge1xuICAgIHRoaXMubW9kaWZ5KGFsd2F5cyh2YWx1ZSkpXG4gIH0sXG4gIHJlbW92ZSgpIHtcbiAgICB0aGlzLnNldCgpXG4gIH0sXG4gIHZpZXcobGVucykge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIgJiYgYXJndW1lbnRzLmxlbmd0aCAhPT0gMSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImtlZmlyLmF0b206IFRoZSBgdmlld2AgbWV0aG9kIHRha2VzIGV4YWN0bHkgMSBhcmd1bWVudC5cIilcbiAgICByZXR1cm4gbmV3IExlbnNlZEF0b20odGhpcywgbGVucylcbiAgfSxcbiAgX21heWJlRW1pdFZhbHVlKG5leHQpIHtcbiAgICBjb25zdCBwcmV2ID0gdGhpcy5fY3VycmVudEV2ZW50XG4gICAgaWYgKCFwcmV2IHx8ICFpZGVudGljYWxVKHByZXYudmFsdWUsIG5leHQpKVxuICAgICAgdGhpcy5fZW1pdFZhbHVlKG5leHQpXG4gIH1cbn0pXG5cbi8vXG5cbmV4cG9ydCBmdW5jdGlvbiBNdXRhYmxlV2l0aFNvdXJjZShzb3VyY2UpIHtcbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSBcInByb2R1Y3Rpb25cIiAmJiAhKHNvdXJjZSBpbnN0YW5jZW9mIE9ic2VydmFibGUpKVxuICAgIHRocm93IG5ldyBFcnJvcihcImtlZmlyLmF0b206IEV4cGVjdGVkIGFuIE9ic2VydmFibGUuXCIpXG4gIEFic3RyYWN0TXV0YWJsZS5jYWxsKHRoaXMpXG4gIHRoaXMuX3NvdXJjZSA9IHNvdXJjZVxuICB0aGlzLl8kb25BbnkgPSBudWxsXG59XG5cbmluaGVyaXQoTXV0YWJsZVdpdGhTb3VyY2UsIEFic3RyYWN0TXV0YWJsZSwge1xuICBnZXQoKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIGlmIChjdXJyZW50ICYmICFsb2NrKVxuICAgICAgcmV0dXJuIGN1cnJlbnQudmFsdWVcbiAgICBlbHNlXG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RnJvbVNvdXJjZSgpXG4gIH0sXG4gIF9vbkFueSgpIHtcbiAgICB0aGlzLl9tYXliZUVtaXRWYWx1ZSh0aGlzLl9nZXRGcm9tU291cmNlKCkpXG4gIH0sXG4gIF9vbkFjdGl2YXRpb24oKSB7XG4gICAgY29uc3Qgb25BbnkgPSAoKSA9PiB0aGlzLl9vbkFueSgpXG4gICAgdGhpcy5fJG9uQW55ID0gb25BbnlcbiAgICB0aGlzLl9zb3VyY2Uub25Bbnkob25BbnkpXG4gIH0sXG4gIF9vbkRlYWN0aXZhdGlvbigpIHtcbiAgICB0aGlzLl9zb3VyY2Uub2ZmQW55KHRoaXMuXyRvbkFueSlcbiAgICB0aGlzLl8kb25BbnkgPSBudWxsXG4gICAgdGhpcy5fY3VycmVudEV2ZW50ID0gbnVsbFxuICB9XG59KVxuXG4vL1xuXG5leHBvcnQgZnVuY3Rpb24gU2V0dGFibGVQcm9wZXJ0eShwcm9wZXJ0eSwgc2V0dGVyKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIgJiYgIShwcm9wZXJ0eSBpbnN0YW5jZW9mIFByb3BlcnR5KSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJrZWZpci5hdG9tOiBFeHBlY3RlZCBhIFByb3BlcnR5LlwiKVxuICBNdXRhYmxlV2l0aFNvdXJjZS5jYWxsKHRoaXMsIHByb3BlcnR5KVxuICB0aGlzLl9zZXR0ZXIgPSBzZXR0ZXJcbn1cblxuaW5oZXJpdChTZXR0YWJsZVByb3BlcnR5LCBNdXRhYmxlV2l0aFNvdXJjZSwge1xuICBfZ2V0RnJvbVNvdXJjZSgpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5fc291cmNlLl9jdXJyZW50RXZlbnRcbiAgICByZXR1cm4gY3VycmVudCAmJiBjdXJyZW50LnZhbHVlXG4gIH0sXG4gIHNldCh2YWx1ZSkge1xuICAgICgwLHRoaXMuX3NldHRlcikodmFsdWUpXG4gIH0sXG4gIG1vZGlmeShmbikge1xuICAgIHRoaXMuc2V0KGZuKHRoaXMuX2dldEZyb21Tb3VyY2UoKSkpXG4gIH1cbn0pXG5cbi8vXG5cbmV4cG9ydCBmdW5jdGlvbiBMZW5zZWRBdG9tKHNvdXJjZSwgbGVucykge1xuICBNdXRhYmxlV2l0aFNvdXJjZS5jYWxsKHRoaXMsIHNvdXJjZSlcbiAgdGhpcy5fbGVucyA9IGxlbnNcbn1cblxuaW5oZXJpdChMZW5zZWRBdG9tLCBNdXRhYmxlV2l0aFNvdXJjZSwge1xuICBzZXQodikge1xuICAgIHRoaXMuX3NvdXJjZS5zZXQoc2V0KHRoaXMuX2xlbnMsIHYsIHRoaXMuX3NvdXJjZS5nZXQoKSkpXG4gIH0sXG4gIG1vZGlmeShmbikge1xuICAgIHRoaXMuX3NvdXJjZS5tb2RpZnkobW9kaWZ5KHRoaXMuX2xlbnMsIGZuKSlcbiAgfSxcbiAgX2dldEZyb21Tb3VyY2UoKSB7XG4gICAgcmV0dXJuIGdldCh0aGlzLl9sZW5zLCB0aGlzLl9zb3VyY2UuZ2V0KCkpXG4gIH1cbn0pXG5cbi8vXG5cbmV4cG9ydCBmdW5jdGlvbiBBdG9tKCkge1xuICBBYnN0cmFjdE11dGFibGUuY2FsbCh0aGlzKVxuICBpZiAoYXJndW1lbnRzLmxlbmd0aClcbiAgICB0aGlzLl9lbWl0VmFsdWUoYXJndW1lbnRzWzBdKVxufVxuXG5pbmhlcml0KEF0b20sIEFic3RyYWN0TXV0YWJsZSwge1xuICBnZXQoKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIHJldHVybiBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZFxuICB9LFxuICBzZXQodikge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICB0aGlzLl9zZXQoY3VycmVudCwgY3VycmVudCA/IGN1cnJlbnQudmFsdWUgOiB1bmRlZmluZWQsIHYpXG4gIH0sXG4gIG1vZGlmeShmbikge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBjb25zdCBwcmV2ID0gY3VycmVudCA/IGN1cnJlbnQudmFsdWUgOiB1bmRlZmluZWRcbiAgICB0aGlzLl9zZXQoY3VycmVudCwgcHJldiwgZm4ocHJldikpXG4gIH0sXG4gIF9zZXQoY3VycmVudCwgcHJldiwgbmV4dCkge1xuICAgIGlmIChsb2NrKSB7XG4gICAgICBpZiAoYXRvbXMuaW5kZXhPZih0aGlzKSA8IDApIHtcbiAgICAgICAgcHJldnMucHVzaChjdXJyZW50ID8gcHJldiA6IG1pc21hdGNoKVxuICAgICAgICBhdG9tcy5wdXNoKHRoaXMpXG4gICAgICB9XG4gICAgICBpZiAoY3VycmVudClcbiAgICAgICAgY3VycmVudC52YWx1ZSA9IG5leHRcbiAgICAgIGVsc2VcbiAgICAgICAgdGhpcy5fY3VycmVudEV2ZW50ID0ge3R5cGU6IFwidmFsdWVcIiwgdmFsdWU6IG5leHR9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX21heWJlRW1pdFZhbHVlKG5leHQpXG4gICAgfVxuICB9XG59KVxuXG4vL1xuXG5mdW5jdGlvbiBwdXNoTXV0YWJsZXModGVtcGxhdGUsIG11dGFibGVzKSB7XG4gIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIEFic3RyYWN0TXV0YWJsZSAmJlxuICAgICAgbXV0YWJsZXMuaW5kZXhPZih0ZW1wbGF0ZSkgPCAwKSB7XG4gICAgbXV0YWJsZXMucHVzaCh0ZW1wbGF0ZSlcbiAgfSBlbHNlIHtcbiAgICBpZiAoaXNBcnJheSh0ZW1wbGF0ZSkpXG4gICAgICBmb3IgKGxldCBpPTAsIG49dGVtcGxhdGUubGVuZ3RoOyBpPG47ICsraSlcbiAgICAgICAgcHVzaE11dGFibGVzKHRlbXBsYXRlW2ldLCBtdXRhYmxlcylcbiAgICBlbHNlIGlmIChpc09iamVjdCh0ZW1wbGF0ZSkpXG4gICAgICBmb3IgKGNvbnN0IGsgaW4gdGVtcGxhdGUpXG4gICAgICAgIHB1c2hNdXRhYmxlcyh0ZW1wbGF0ZVtrXSwgbXV0YWJsZXMpXG4gIH1cbn1cblxuZnVuY3Rpb24gbW9sZWN1bGUodGVtcGxhdGUpIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlKSB7XG4gICAgcmV0dXJuIHRlbXBsYXRlLmdldCgpXG4gIH0gZWxzZSB7XG4gICAgaWYgKGlzQXJyYXkodGVtcGxhdGUpKSB7XG4gICAgICBjb25zdCBuID0gdGVtcGxhdGUubGVuZ3RoXG4gICAgICBjb25zdCBuZXh0ID0gQXJyYXkobilcbiAgICAgIGZvciAobGV0IGk9MDsgaTxuOyArK2kpXG4gICAgICAgIG5leHRbaV0gPSBtb2xlY3VsZSh0ZW1wbGF0ZVtpXSlcbiAgICAgIHJldHVybiBuZXh0XG4gICAgfSBlbHNlIGlmIChpc09iamVjdCh0ZW1wbGF0ZSkpIHtcbiAgICAgIGNvbnN0IG5leHQgPSB7fVxuICAgICAgZm9yIChjb25zdCBrIGluIHRlbXBsYXRlKVxuICAgICAgICBuZXh0W2tdID0gbW9sZWN1bGUodGVtcGxhdGVba10pXG4gICAgICByZXR1cm4gbmV4dFxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGVtcGxhdGVcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbWlzbWF0Y2goKSB7dGhyb3cgbmV3IEVycm9yKFwiTW9sZWN1bGUgY2Fubm90IGNoYW5nZSB0aGUgdGVtcGxhdGUuXCIpfVxuXG5mdW5jdGlvbiBzZXRNdXRhYmxlcyh0ZW1wbGF0ZSwgdmFsdWUpIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlKSB7XG4gICAgcmV0dXJuIHRlbXBsYXRlLnNldCh2YWx1ZSlcbiAgfSBlbHNlIHtcbiAgICBpZiAoaXNBcnJheSh0ZW1wbGF0ZSkgJiYgaXNBcnJheSh2YWx1ZSkpXG4gICAgICBmb3IgKGxldCBpPTAsIG49dGVtcGxhdGUubGVuZ3RoOyBpPG47ICsraSlcbiAgICAgICAgc2V0TXV0YWJsZXModGVtcGxhdGVbaV0sIHZhbHVlW2ldKVxuICAgIGVsc2UgaWYgKGlzT2JqZWN0KHRlbXBsYXRlKSAmJiBpc09iamVjdCh2YWx1ZSkpXG4gICAgICBmb3IgKGNvbnN0IGsgaW4gdGVtcGxhdGUpXG4gICAgICAgIHNldE11dGFibGVzKHRlbXBsYXRlW2tdLCB2YWx1ZVtrXSlcbiAgICBlbHNlIGlmICghaWRlbnRpY2FsVSh0ZW1wbGF0ZSwgdmFsdWUpKVxuICAgICAgbWlzbWF0Y2goKVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBNb2xlY3VsZSh0ZW1wbGF0ZSkge1xuICBjb25zdCBtdXRhYmxlcyA9IFtdXG4gIHB1c2hNdXRhYmxlcyh0ZW1wbGF0ZSwgbXV0YWJsZXMpXG4gIE11dGFibGVXaXRoU291cmNlLmNhbGwodGhpcywgY29tYmluZShtdXRhYmxlcykpXG4gIHRoaXMuX3RlbXBsYXRlID0gdGVtcGxhdGVcbn1cblxuaW5oZXJpdChNb2xlY3VsZSwgTXV0YWJsZVdpdGhTb3VyY2UsIHtcbiAgX2dldEZyb21Tb3VyY2UoKSB7XG4gICAgcmV0dXJuIG1vbGVjdWxlKHRoaXMuX3RlbXBsYXRlKVxuICB9LFxuICBtb2RpZnkoZm4pIHtcbiAgICBjb25zdCBuZXh0ID0gZm4odGhpcy5nZXQoKSlcbiAgICBob2xkaW5nKCgpID0+IHNldE11dGFibGVzKHRoaXMuX3RlbXBsYXRlLCBuZXh0KSlcbiAgfVxufSlcblxuLy9cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYXRvbSgpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpXG4gICAgcmV0dXJuIG5ldyBBdG9tKGFyZ3VtZW50c1swXSlcbiAgZWxzZVxuICAgIHJldHVybiBuZXcgQXRvbSgpXG59XG4iXX0=
