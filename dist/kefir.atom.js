(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.kefir || (g.kefir = {})).atom = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.holding = holding;
exports.AbstractMutable = AbstractMutable;
exports.MutableWithSource = MutableWithSource;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMva2VmaXIuYXRvbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O1FDc0JnQixPLEdBQUEsTztRQVlBLGUsR0FBQSxlO1FBeUJBLGlCLEdBQUEsaUI7UUFpQ0EsVSxHQUFBLFU7UUFtQkEsSSxHQUFBLEk7UUEwRkEsUSxHQUFBLFE7a0JBbUJRLEk7O0FBNU54Qjs7QUFDQTs7QUFDQTs7QUFFQTs7QUFFQSxJQUFJLE9BQU8sQ0FBWDs7QUFFQSxJQUFNLFFBQVEsRUFBZDtBQUNBLElBQU0sUUFBUSxFQUFkOztBQUVBLFNBQVMsT0FBVCxHQUFtQjtBQUNqQixTQUFPLE1BQU0sTUFBYixFQUFxQjtBQUNuQixRQUFNLE9BQU8sTUFBTSxLQUFOLEVBQWI7QUFDQSxRQUFNLFFBQU8sTUFBTSxLQUFOLEVBQWI7QUFDQSxRQUFNLE9BQU8sTUFBSyxhQUFMLENBQW1CLEtBQWhDOztBQUVBLFFBQUksQ0FBQyw0QkFBVyxJQUFYLEVBQWlCLElBQWpCLENBQUwsRUFDRSxNQUFLLFVBQUwsQ0FBZ0IsSUFBaEI7QUFDSDtBQUNGOztBQUVNLFNBQVMsT0FBVCxDQUFpQixFQUFqQixFQUFxQjtBQUMxQixJQUFFLElBQUY7QUFDQSxNQUFJO0FBQ0YsV0FBTyxJQUFQO0FBQ0QsR0FGRCxTQUVVO0FBQ1IsUUFBSSxDQUFDLEdBQUUsSUFBUCxFQUNFO0FBQ0g7QUFDRjs7QUFFRDs7QUFFTyxTQUFTLGVBQVQsR0FBMkI7QUFDaEMsa0JBQVMsSUFBVCxDQUFjLElBQWQ7QUFDRDs7QUFFRCx5QkFBUSxlQUFSLG1CQUFtQztBQUNqQyxLQURpQyxlQUM3QixLQUQ2QixFQUN0QjtBQUNULFNBQUssTUFBTCxDQUFZLHdCQUFPLEtBQVAsQ0FBWjtBQUNELEdBSGdDO0FBSWpDLFFBSmlDLG9CQUl4QjtBQUNQLFNBQUssR0FBTDtBQUNELEdBTmdDO0FBT2pDLE1BUGlDLGdCQU81QixJQVA0QixFQU90QjtBQUNULFFBQUksUUFBUSxHQUFSLENBQVksUUFBWixLQUF5QixZQUF6QixJQUF5QyxVQUFVLE1BQVYsS0FBcUIsQ0FBbEUsRUFDRSxNQUFNLElBQUksS0FBSixDQUFVLHlEQUFWLENBQU47QUFDRixXQUFPLElBQUksVUFBSixDQUFlLElBQWYsRUFBcUIsSUFBckIsQ0FBUDtBQUNELEdBWGdDO0FBWWpDLGlCQVppQywyQkFZakIsSUFaaUIsRUFZWDtBQUNwQixRQUFNLE9BQU8sS0FBSyxhQUFsQjtBQUNBLFFBQUksQ0FBQyxJQUFELElBQVMsQ0FBQyw0QkFBVyxLQUFLLEtBQWhCLEVBQXVCLElBQXZCLENBQWQsRUFDRSxLQUFLLFVBQUwsQ0FBZ0IsSUFBaEI7QUFDSDtBQWhCZ0MsQ0FBbkM7O0FBbUJBOztBQUVPLFNBQVMsaUJBQVQsQ0FBMkIsTUFBM0IsRUFBbUM7QUFDeEMsTUFBSSxRQUFRLEdBQVIsQ0FBWSxRQUFaLEtBQXlCLFlBQXpCLElBQXlDLEVBQUUsbUNBQUYsQ0FBN0MsRUFDRSxNQUFNLElBQUksS0FBSixDQUFVLHFDQUFWLENBQU47QUFDRixrQkFBZ0IsSUFBaEIsQ0FBcUIsSUFBckI7QUFDQSxPQUFLLE9BQUwsR0FBZSxNQUFmO0FBQ0EsT0FBSyxPQUFMLEdBQWUsSUFBZjtBQUNEOztBQUVELHlCQUFRLGlCQUFSLEVBQTJCLGVBQTNCLEVBQTRDO0FBQzFDLEtBRDBDLGlCQUNwQztBQUNKLFFBQU0sVUFBVSxLQUFLLGFBQXJCO0FBQ0EsUUFBSSxXQUFXLENBQUMsSUFBaEIsRUFDRSxPQUFPLFFBQVEsS0FBZixDQURGLEtBR0UsT0FBTyxLQUFLLGNBQUwsRUFBUDtBQUNILEdBUHlDO0FBUTFDLFFBUjBDLG9CQVFqQztBQUNQLFNBQUssZUFBTCxDQUFxQixLQUFLLGNBQUwsRUFBckI7QUFDRCxHQVZ5QztBQVcxQyxlQVgwQywyQkFXMUI7QUFBQTs7QUFDZCxRQUFNLFFBQVEsU0FBUixLQUFRO0FBQUEsYUFBTSxNQUFLLE1BQUwsRUFBTjtBQUFBLEtBQWQ7QUFDQSxTQUFLLE9BQUwsR0FBZSxLQUFmO0FBQ0EsU0FBSyxPQUFMLENBQWEsS0FBYixDQUFtQixLQUFuQjtBQUNELEdBZnlDO0FBZ0IxQyxpQkFoQjBDLDZCQWdCeEI7QUFDaEIsU0FBSyxPQUFMLENBQWEsTUFBYixDQUFvQixLQUFLLE9BQXpCO0FBQ0EsU0FBSyxPQUFMLEdBQWUsSUFBZjtBQUNBLFNBQUssYUFBTCxHQUFxQixJQUFyQjtBQUNEO0FBcEJ5QyxDQUE1Qzs7QUF1QkE7O0FBRU8sU0FBUyxVQUFULENBQW9CLE1BQXBCLEVBQTRCLElBQTVCLEVBQWtDO0FBQ3ZDLG9CQUFrQixJQUFsQixDQUF1QixJQUF2QixFQUE2QixNQUE3QjtBQUNBLE9BQUssS0FBTCxHQUFhLElBQWI7QUFDRDs7QUFFRCx5QkFBUSxVQUFSLEVBQW9CLGlCQUFwQixFQUF1QztBQUNyQyxLQURxQyxlQUNqQyxDQURpQyxFQUM5QjtBQUNMLFNBQUssT0FBTCxDQUFhLEdBQWIsQ0FBaUIsa0JBQUksS0FBSyxLQUFULEVBQWdCLENBQWhCLEVBQW1CLEtBQUssT0FBTCxDQUFhLEdBQWIsRUFBbkIsQ0FBakI7QUFDRCxHQUhvQztBQUlyQyxRQUpxQyxrQkFJOUIsRUFKOEIsRUFJMUI7QUFDVCxTQUFLLE9BQUwsQ0FBYSxNQUFiLENBQW9CLHFCQUFPLEtBQUssS0FBWixFQUFtQixFQUFuQixDQUFwQjtBQUNELEdBTm9DO0FBT3JDLGdCQVBxQyw0QkFPcEI7QUFDZixXQUFPLGtCQUFJLEtBQUssS0FBVCxFQUFnQixLQUFLLE9BQUwsQ0FBYSxHQUFiLEVBQWhCLENBQVA7QUFDRDtBQVRvQyxDQUF2Qzs7QUFZQTs7QUFFTyxTQUFTLElBQVQsR0FBZ0I7QUFDckIsa0JBQWdCLElBQWhCLENBQXFCLElBQXJCO0FBQ0EsTUFBSSxVQUFVLE1BQWQsRUFDRSxLQUFLLFVBQUwsQ0FBZ0IsVUFBVSxDQUFWLENBQWhCO0FBQ0g7O0FBRUQseUJBQVEsSUFBUixFQUFjLGVBQWQsRUFBK0I7QUFDN0IsS0FENkIsaUJBQ3ZCO0FBQ0osUUFBTSxVQUFVLEtBQUssYUFBckI7QUFDQSxXQUFPLFVBQVUsUUFBUSxLQUFsQixHQUEwQixTQUFqQztBQUNELEdBSjRCO0FBSzdCLEtBTDZCLGVBS3pCLENBTHlCLEVBS3RCO0FBQ0wsUUFBTSxVQUFVLEtBQUssYUFBckI7QUFDQSxTQUFLLElBQUwsQ0FBVSxPQUFWLEVBQW1CLFVBQVUsUUFBUSxLQUFsQixHQUEwQixTQUE3QyxFQUF3RCxDQUF4RDtBQUNELEdBUjRCO0FBUzdCLFFBVDZCLGtCQVN0QixFQVRzQixFQVNsQjtBQUNULFFBQU0sVUFBVSxLQUFLLGFBQXJCO0FBQ0EsUUFBTSxPQUFPLFVBQVUsUUFBUSxLQUFsQixHQUEwQixTQUF2QztBQUNBLFNBQUssSUFBTCxDQUFVLE9BQVYsRUFBbUIsSUFBbkIsRUFBeUIsR0FBRyxJQUFILENBQXpCO0FBQ0QsR0FiNEI7QUFjN0IsTUFkNkIsZ0JBY3hCLE9BZHdCLEVBY2YsSUFkZSxFQWNULElBZFMsRUFjSDtBQUN4QixRQUFJLElBQUosRUFBVTtBQUNSLFVBQUksTUFBTSxPQUFOLENBQWMsSUFBZCxJQUFzQixDQUExQixFQUE2QjtBQUMzQixjQUFNLElBQU4sQ0FBVyxVQUFVLElBQVYsR0FBaUIsUUFBNUI7QUFDQSxjQUFNLElBQU4sQ0FBVyxJQUFYO0FBQ0Q7QUFDRCxVQUFJLE9BQUosRUFDRSxRQUFRLEtBQVIsR0FBZ0IsSUFBaEIsQ0FERixLQUdFLEtBQUssYUFBTCxHQUFxQixFQUFDLE1BQU0sT0FBUCxFQUFnQixPQUFPLElBQXZCLEVBQXJCO0FBQ0gsS0FURCxNQVNPO0FBQ0wsV0FBSyxlQUFMLENBQXFCLElBQXJCO0FBQ0Q7QUFDRjtBQTNCNEIsQ0FBL0I7O0FBOEJBOztBQUVBLFNBQVMsWUFBVCxDQUFzQixRQUF0QixFQUFnQyxRQUFoQyxFQUEwQztBQUN4QyxNQUFJLG9CQUFvQixlQUFwQixJQUNBLFNBQVMsT0FBVCxDQUFpQixRQUFqQixJQUE2QixDQURqQyxFQUNvQztBQUNsQyxhQUFTLElBQVQsQ0FBYyxRQUFkO0FBQ0QsR0FIRCxNQUdPO0FBQ0wsUUFBSSx5QkFBUSxRQUFSLENBQUosRUFDRSxLQUFLLElBQUksSUFBRSxDQUFOLEVBQVMsSUFBRSxTQUFTLE1BQXpCLEVBQWlDLElBQUUsQ0FBbkMsRUFBc0MsRUFBRSxDQUF4QztBQUNFLG1CQUFhLFNBQVMsQ0FBVCxDQUFiLEVBQTBCLFFBQTFCO0FBREYsS0FERixNQUdLLElBQUksMEJBQVMsUUFBVCxDQUFKLEVBQ0gsS0FBSyxJQUFNLENBQVgsSUFBZ0IsUUFBaEI7QUFDRSxtQkFBYSxTQUFTLENBQVQsQ0FBYixFQUEwQixRQUExQjtBQURGO0FBRUg7QUFDRjs7QUFFRCxTQUFTLFFBQVQsQ0FBa0IsUUFBbEIsRUFBNEI7QUFDMUIsTUFBSSxvQkFBb0IsZUFBeEIsRUFBeUM7QUFDdkMsV0FBTyxTQUFTLEdBQVQsRUFBUDtBQUNELEdBRkQsTUFFTztBQUNMLFFBQUkseUJBQVEsUUFBUixDQUFKLEVBQXVCO0FBQ3JCLFVBQU0sSUFBSSxTQUFTLE1BQW5CO0FBQ0EsVUFBTSxPQUFPLE1BQU0sQ0FBTixDQUFiO0FBQ0EsV0FBSyxJQUFJLElBQUUsQ0FBWCxFQUFjLElBQUUsQ0FBaEIsRUFBbUIsRUFBRSxDQUFyQjtBQUNFLGFBQUssQ0FBTCxJQUFVLFNBQVMsU0FBUyxDQUFULENBQVQsQ0FBVjtBQURGLE9BRUEsT0FBTyxJQUFQO0FBQ0QsS0FORCxNQU1PLElBQUksMEJBQVMsUUFBVCxDQUFKLEVBQXdCO0FBQzdCLFVBQU0sUUFBTyxFQUFiO0FBQ0EsV0FBSyxJQUFNLENBQVgsSUFBZ0IsUUFBaEI7QUFDRSxjQUFLLENBQUwsSUFBVSxTQUFTLFNBQVMsQ0FBVCxDQUFULENBQVY7QUFERixPQUVBLE9BQU8sS0FBUDtBQUNELEtBTE0sTUFLQTtBQUNMLGFBQU8sUUFBUDtBQUNEO0FBQ0Y7QUFDRjs7QUFFRCxTQUFTLFFBQVQsR0FBb0I7QUFBQyxRQUFNLElBQUksS0FBSixDQUFVLHNDQUFWLENBQU47QUFBd0Q7O0FBRTdFLFNBQVMsV0FBVCxDQUFxQixRQUFyQixFQUErQixLQUEvQixFQUFzQztBQUNwQyxNQUFJLG9CQUFvQixlQUF4QixFQUF5QztBQUN2QyxXQUFPLFNBQVMsR0FBVCxDQUFhLEtBQWIsQ0FBUDtBQUNELEdBRkQsTUFFTztBQUNMLFFBQUkseUJBQVEsUUFBUixLQUFxQix5QkFBUSxLQUFSLENBQXpCLEVBQ0UsS0FBSyxJQUFJLElBQUUsQ0FBTixFQUFTLElBQUUsU0FBUyxNQUF6QixFQUFpQyxJQUFFLENBQW5DLEVBQXNDLEVBQUUsQ0FBeEM7QUFDRSxrQkFBWSxTQUFTLENBQVQsQ0FBWixFQUF5QixNQUFNLENBQU4sQ0FBekI7QUFERixLQURGLE1BR0ssSUFBSSwwQkFBUyxRQUFULEtBQXNCLDBCQUFTLEtBQVQsQ0FBMUIsRUFDSCxLQUFLLElBQU0sQ0FBWCxJQUFnQixRQUFoQjtBQUNFLGtCQUFZLFNBQVMsQ0FBVCxDQUFaLEVBQXlCLE1BQU0sQ0FBTixDQUF6QjtBQURGLEtBREcsTUFHQSxJQUFJLENBQUMsNEJBQVcsUUFBWCxFQUFxQixLQUFyQixDQUFMLEVBQ0g7QUFDSDtBQUNGOztBQUVNLFNBQVMsUUFBVCxDQUFrQixRQUFsQixFQUE0QjtBQUNqQyxNQUFNLFdBQVcsRUFBakI7QUFDQSxlQUFhLFFBQWIsRUFBdUIsUUFBdkI7QUFDQSxvQkFBa0IsSUFBbEIsQ0FBdUIsSUFBdkIsRUFBNkIsb0JBQVEsUUFBUixDQUE3QjtBQUNBLE9BQUssU0FBTCxHQUFpQixRQUFqQjtBQUNEOztBQUVELHlCQUFRLFFBQVIsRUFBa0IsaUJBQWxCLEVBQXFDO0FBQ25DLGdCQURtQyw0QkFDbEI7QUFDZixXQUFPLFNBQVMsS0FBSyxTQUFkLENBQVA7QUFDRCxHQUhrQztBQUluQyxRQUptQyxrQkFJNUIsRUFKNEIsRUFJeEI7QUFBQTs7QUFDVCxRQUFNLE9BQU8sR0FBRyxLQUFLLEdBQUwsRUFBSCxDQUFiO0FBQ0EsWUFBUTtBQUFBLGFBQU0sWUFBWSxPQUFLLFNBQWpCLEVBQTRCLElBQTVCLENBQU47QUFBQSxLQUFSO0FBQ0Q7QUFQa0MsQ0FBckM7O0FBVUE7O0FBRWUsU0FBUyxJQUFULEdBQWdCO0FBQzdCLE1BQUksVUFBVSxNQUFkLEVBQ0UsT0FBTyxJQUFJLElBQUosQ0FBUyxVQUFVLENBQVYsQ0FBVCxDQUFQLENBREYsS0FHRSxPQUFPLElBQUksSUFBSixFQUFQO0FBQ0giLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiaW1wb3J0IHthbHdheXMsIGlkZW50aWNhbFUsIGluaGVyaXQsIGlzQXJyYXksIGlzT2JqZWN0fSBmcm9tIFwiaW5mZXN0aW5lc1wiXG5pbXBvcnQge09ic2VydmFibGUsIFByb3BlcnR5LCBjb21iaW5lfSBmcm9tIFwia2VmaXJcIlxuaW1wb3J0IHtnZXQsIG1vZGlmeSwgc2V0fSBmcm9tIFwicGFydGlhbC5sZW5zZXNcIlxuXG4vL1xuXG5sZXQgbG9jayA9IDBcblxuY29uc3QgcHJldnMgPSBbXVxuY29uc3QgYXRvbXMgPSBbXVxuXG5mdW5jdGlvbiByZWxlYXNlKCkge1xuICB3aGlsZSAocHJldnMubGVuZ3RoKSB7XG4gICAgY29uc3QgcHJldiA9IHByZXZzLnNoaWZ0KClcbiAgICBjb25zdCBhdG9tID0gYXRvbXMuc2hpZnQoKVxuICAgIGNvbnN0IG5leHQgPSBhdG9tLl9jdXJyZW50RXZlbnQudmFsdWVcblxuICAgIGlmICghaWRlbnRpY2FsVShwcmV2LCBuZXh0KSlcbiAgICAgIGF0b20uX2VtaXRWYWx1ZShuZXh0KVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBob2xkaW5nKGVmKSB7XG4gICsrbG9ja1xuICB0cnkge1xuICAgIHJldHVybiBlZigpXG4gIH0gZmluYWxseSB7XG4gICAgaWYgKCEtLWxvY2spXG4gICAgICByZWxlYXNlKClcbiAgfVxufVxuXG4vL1xuXG5leHBvcnQgZnVuY3Rpb24gQWJzdHJhY3RNdXRhYmxlKCkge1xuICBQcm9wZXJ0eS5jYWxsKHRoaXMpXG59XG5cbmluaGVyaXQoQWJzdHJhY3RNdXRhYmxlLCBQcm9wZXJ0eSwge1xuICBzZXQodmFsdWUpIHtcbiAgICB0aGlzLm1vZGlmeShhbHdheXModmFsdWUpKVxuICB9LFxuICByZW1vdmUoKSB7XG4gICAgdGhpcy5zZXQoKVxuICB9LFxuICB2aWV3KGxlbnMpIHtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09IFwicHJvZHVjdGlvblwiICYmIGFyZ3VtZW50cy5sZW5ndGggIT09IDEpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJrZWZpci5hdG9tOiBUaGUgYHZpZXdgIG1ldGhvZCB0YWtlcyBleGFjdGx5IDEgYXJndW1lbnQuXCIpXG4gICAgcmV0dXJuIG5ldyBMZW5zZWRBdG9tKHRoaXMsIGxlbnMpXG4gIH0sXG4gIF9tYXliZUVtaXRWYWx1ZShuZXh0KSB7XG4gICAgY29uc3QgcHJldiA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIGlmICghcHJldiB8fCAhaWRlbnRpY2FsVShwcmV2LnZhbHVlLCBuZXh0KSlcbiAgICAgIHRoaXMuX2VtaXRWYWx1ZShuZXh0KVxuICB9XG59KVxuXG4vL1xuXG5leHBvcnQgZnVuY3Rpb24gTXV0YWJsZVdpdGhTb3VyY2Uoc291cmNlKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIgJiYgIShzb3VyY2UgaW5zdGFuY2VvZiBPYnNlcnZhYmxlKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJrZWZpci5hdG9tOiBFeHBlY3RlZCBhbiBPYnNlcnZhYmxlLlwiKVxuICBBYnN0cmFjdE11dGFibGUuY2FsbCh0aGlzKVxuICB0aGlzLl9zb3VyY2UgPSBzb3VyY2VcbiAgdGhpcy5fJG9uQW55ID0gbnVsbFxufVxuXG5pbmhlcml0KE11dGFibGVXaXRoU291cmNlLCBBYnN0cmFjdE11dGFibGUsIHtcbiAgZ2V0KCkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBpZiAoY3VycmVudCAmJiAhbG9jaylcbiAgICAgIHJldHVybiBjdXJyZW50LnZhbHVlXG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHRoaXMuX2dldEZyb21Tb3VyY2UoKVxuICB9LFxuICBfb25BbnkoKSB7XG4gICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUodGhpcy5fZ2V0RnJvbVNvdXJjZSgpKVxuICB9LFxuICBfb25BY3RpdmF0aW9uKCkge1xuICAgIGNvbnN0IG9uQW55ID0gKCkgPT4gdGhpcy5fb25BbnkoKVxuICAgIHRoaXMuXyRvbkFueSA9IG9uQW55XG4gICAgdGhpcy5fc291cmNlLm9uQW55KG9uQW55KVxuICB9LFxuICBfb25EZWFjdGl2YXRpb24oKSB7XG4gICAgdGhpcy5fc291cmNlLm9mZkFueSh0aGlzLl8kb25BbnkpXG4gICAgdGhpcy5fJG9uQW55ID0gbnVsbFxuICAgIHRoaXMuX2N1cnJlbnRFdmVudCA9IG51bGxcbiAgfVxufSlcblxuLy9cblxuZXhwb3J0IGZ1bmN0aW9uIExlbnNlZEF0b20oc291cmNlLCBsZW5zKSB7XG4gIE11dGFibGVXaXRoU291cmNlLmNhbGwodGhpcywgc291cmNlKVxuICB0aGlzLl9sZW5zID0gbGVuc1xufVxuXG5pbmhlcml0KExlbnNlZEF0b20sIE11dGFibGVXaXRoU291cmNlLCB7XG4gIHNldCh2KSB7XG4gICAgdGhpcy5fc291cmNlLnNldChzZXQodGhpcy5fbGVucywgdiwgdGhpcy5fc291cmNlLmdldCgpKSlcbiAgfSxcbiAgbW9kaWZ5KGZuKSB7XG4gICAgdGhpcy5fc291cmNlLm1vZGlmeShtb2RpZnkodGhpcy5fbGVucywgZm4pKVxuICB9LFxuICBfZ2V0RnJvbVNvdXJjZSgpIHtcbiAgICByZXR1cm4gZ2V0KHRoaXMuX2xlbnMsIHRoaXMuX3NvdXJjZS5nZXQoKSlcbiAgfVxufSlcblxuLy9cblxuZXhwb3J0IGZ1bmN0aW9uIEF0b20oKSB7XG4gIEFic3RyYWN0TXV0YWJsZS5jYWxsKHRoaXMpXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoKVxuICAgIHRoaXMuX2VtaXRWYWx1ZShhcmd1bWVudHNbMF0pXG59XG5cbmluaGVyaXQoQXRvbSwgQWJzdHJhY3RNdXRhYmxlLCB7XG4gIGdldCgpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5fY3VycmVudEV2ZW50XG4gICAgcmV0dXJuIGN1cnJlbnQgPyBjdXJyZW50LnZhbHVlIDogdW5kZWZpbmVkXG4gIH0sXG4gIHNldCh2KSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIHRoaXMuX3NldChjdXJyZW50LCBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZCwgdilcbiAgfSxcbiAgbW9kaWZ5KGZuKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIGNvbnN0IHByZXYgPSBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZFxuICAgIHRoaXMuX3NldChjdXJyZW50LCBwcmV2LCBmbihwcmV2KSlcbiAgfSxcbiAgX3NldChjdXJyZW50LCBwcmV2LCBuZXh0KSB7XG4gICAgaWYgKGxvY2spIHtcbiAgICAgIGlmIChhdG9tcy5pbmRleE9mKHRoaXMpIDwgMCkge1xuICAgICAgICBwcmV2cy5wdXNoKGN1cnJlbnQgPyBwcmV2IDogbWlzbWF0Y2gpXG4gICAgICAgIGF0b21zLnB1c2godGhpcylcbiAgICAgIH1cbiAgICAgIGlmIChjdXJyZW50KVxuICAgICAgICBjdXJyZW50LnZhbHVlID0gbmV4dFxuICAgICAgZWxzZVxuICAgICAgICB0aGlzLl9jdXJyZW50RXZlbnQgPSB7dHlwZTogXCJ2YWx1ZVwiLCB2YWx1ZTogbmV4dH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUobmV4dClcbiAgICB9XG4gIH1cbn0pXG5cbi8vXG5cbmZ1bmN0aW9uIHB1c2hNdXRhYmxlcyh0ZW1wbGF0ZSwgbXV0YWJsZXMpIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlICYmXG4gICAgICBtdXRhYmxlcy5pbmRleE9mKHRlbXBsYXRlKSA8IDApIHtcbiAgICBtdXRhYmxlcy5wdXNoKHRlbXBsYXRlKVxuICB9IGVsc2Uge1xuICAgIGlmIChpc0FycmF5KHRlbXBsYXRlKSlcbiAgICAgIGZvciAobGV0IGk9MCwgbj10ZW1wbGF0ZS5sZW5ndGg7IGk8bjsgKytpKVxuICAgICAgICBwdXNoTXV0YWJsZXModGVtcGxhdGVbaV0sIG11dGFibGVzKVxuICAgIGVsc2UgaWYgKGlzT2JqZWN0KHRlbXBsYXRlKSlcbiAgICAgIGZvciAoY29uc3QgayBpbiB0ZW1wbGF0ZSlcbiAgICAgICAgcHVzaE11dGFibGVzKHRlbXBsYXRlW2tdLCBtdXRhYmxlcylcbiAgfVxufVxuXG5mdW5jdGlvbiBtb2xlY3VsZSh0ZW1wbGF0ZSkge1xuICBpZiAodGVtcGxhdGUgaW5zdGFuY2VvZiBBYnN0cmFjdE11dGFibGUpIHtcbiAgICByZXR1cm4gdGVtcGxhdGUuZ2V0KClcbiAgfSBlbHNlIHtcbiAgICBpZiAoaXNBcnJheSh0ZW1wbGF0ZSkpIHtcbiAgICAgIGNvbnN0IG4gPSB0ZW1wbGF0ZS5sZW5ndGhcbiAgICAgIGNvbnN0IG5leHQgPSBBcnJheShuKVxuICAgICAgZm9yIChsZXQgaT0wOyBpPG47ICsraSlcbiAgICAgICAgbmV4dFtpXSA9IG1vbGVjdWxlKHRlbXBsYXRlW2ldKVxuICAgICAgcmV0dXJuIG5leHRcbiAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KHRlbXBsYXRlKSkge1xuICAgICAgY29uc3QgbmV4dCA9IHt9XG4gICAgICBmb3IgKGNvbnN0IGsgaW4gdGVtcGxhdGUpXG4gICAgICAgIG5leHRba10gPSBtb2xlY3VsZSh0ZW1wbGF0ZVtrXSlcbiAgICAgIHJldHVybiBuZXh0XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0ZW1wbGF0ZVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBtaXNtYXRjaCgpIHt0aHJvdyBuZXcgRXJyb3IoXCJNb2xlY3VsZSBjYW5ub3QgY2hhbmdlIHRoZSB0ZW1wbGF0ZS5cIil9XG5cbmZ1bmN0aW9uIHNldE11dGFibGVzKHRlbXBsYXRlLCB2YWx1ZSkge1xuICBpZiAodGVtcGxhdGUgaW5zdGFuY2VvZiBBYnN0cmFjdE11dGFibGUpIHtcbiAgICByZXR1cm4gdGVtcGxhdGUuc2V0KHZhbHVlKVxuICB9IGVsc2Uge1xuICAgIGlmIChpc0FycmF5KHRlbXBsYXRlKSAmJiBpc0FycmF5KHZhbHVlKSlcbiAgICAgIGZvciAobGV0IGk9MCwgbj10ZW1wbGF0ZS5sZW5ndGg7IGk8bjsgKytpKVxuICAgICAgICBzZXRNdXRhYmxlcyh0ZW1wbGF0ZVtpXSwgdmFsdWVbaV0pXG4gICAgZWxzZSBpZiAoaXNPYmplY3QodGVtcGxhdGUpICYmIGlzT2JqZWN0KHZhbHVlKSlcbiAgICAgIGZvciAoY29uc3QgayBpbiB0ZW1wbGF0ZSlcbiAgICAgICAgc2V0TXV0YWJsZXModGVtcGxhdGVba10sIHZhbHVlW2tdKVxuICAgIGVsc2UgaWYgKCFpZGVudGljYWxVKHRlbXBsYXRlLCB2YWx1ZSkpXG4gICAgICBtaXNtYXRjaCgpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIE1vbGVjdWxlKHRlbXBsYXRlKSB7XG4gIGNvbnN0IG11dGFibGVzID0gW11cbiAgcHVzaE11dGFibGVzKHRlbXBsYXRlLCBtdXRhYmxlcylcbiAgTXV0YWJsZVdpdGhTb3VyY2UuY2FsbCh0aGlzLCBjb21iaW5lKG11dGFibGVzKSlcbiAgdGhpcy5fdGVtcGxhdGUgPSB0ZW1wbGF0ZVxufVxuXG5pbmhlcml0KE1vbGVjdWxlLCBNdXRhYmxlV2l0aFNvdXJjZSwge1xuICBfZ2V0RnJvbVNvdXJjZSgpIHtcbiAgICByZXR1cm4gbW9sZWN1bGUodGhpcy5fdGVtcGxhdGUpXG4gIH0sXG4gIG1vZGlmeShmbikge1xuICAgIGNvbnN0IG5leHQgPSBmbih0aGlzLmdldCgpKVxuICAgIGhvbGRpbmcoKCkgPT4gc2V0TXV0YWJsZXModGhpcy5fdGVtcGxhdGUsIG5leHQpKVxuICB9XG59KVxuXG4vL1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhdG9tKCkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aClcbiAgICByZXR1cm4gbmV3IEF0b20oYXJndW1lbnRzWzBdKVxuICBlbHNlXG4gICAgcmV0dXJuIG5ldyBBdG9tKClcbn1cbiJdfQ==
