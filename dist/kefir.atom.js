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
  view: function view() {
    return new LensedAtom(this, _partial.compose.apply(undefined, arguments));
  },
  _maybeEmitValue: function _maybeEmitValue(next) {
    var prev = this._currentEvent;
    if (!prev || !(0, _infestines.identicalU)(prev.value, next)) this._emitValue(next);
  }
});

//

function MutableWithSource(source) {
  AbstractMutable.call(this);
  this._source = source;
  this._$handleAny = null;
}

(0, _infestines.inherit)(MutableWithSource, AbstractMutable, {
  get: function get() {
    var current = this._currentEvent;
    if (current && !lock) return current.value;else return this._getFromSource();
  },
  _handleAny: function _handleAny() {
    this._maybeEmitValue(this._getFromSource());
  },
  _onActivation: function _onActivation() {
    var _this = this;

    var handleAny = function handleAny() {
      return _this._handleAny();
    };
    this._$handleAny = handleAny;
    this._source.onAny(handleAny);
  },
  _onDeactivation: function _onDeactivation() {
    this._source.offAny(this._$handleAny);
    this._$handleAny = null;
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
    this._setInternal(current, current ? current.value : undefined, v);
  },
  modify: function modify(fn) {
    var current = this._currentEvent;
    var prev = current ? current.value : undefined;
    this._setInternal(current, prev, fn(prev));
  },
  _setInternal: function _setInternal(current, prev, next) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMva2VmaXIuYXRvbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O1FDc0JnQixPLEdBQUEsTztRQVlBLGUsR0FBQSxlO1FBdUJBLGlCLEdBQUEsaUI7UUErQkEsVSxHQUFBLFU7UUFtQkEsSSxHQUFBLEk7UUEwRkEsUSxHQUFBLFE7a0JBbUJRLEk7O0FBeE54Qjs7QUFDQTs7QUFDQTs7QUFFQTs7QUFFQSxJQUFJLE9BQU8sQ0FBWDs7QUFFQSxJQUFNLFFBQVEsRUFBZDtBQUNBLElBQU0sUUFBUSxFQUFkOztBQUVBLFNBQVMsT0FBVCxHQUFtQjtBQUNqQixTQUFPLE1BQU0sTUFBYixFQUFxQjtBQUNuQixRQUFNLE9BQU8sTUFBTSxLQUFOLEVBQWI7QUFDQSxRQUFNLFFBQU8sTUFBTSxLQUFOLEVBQWI7QUFDQSxRQUFNLE9BQU8sTUFBSyxhQUFMLENBQW1CLEtBQWhDOztBQUVBLFFBQUksQ0FBQyw0QkFBVyxJQUFYLEVBQWlCLElBQWpCLENBQUwsRUFDRSxNQUFLLFVBQUwsQ0FBZ0IsSUFBaEI7QUFDSDtBQUNGOztBQUVNLFNBQVMsT0FBVCxDQUFpQixFQUFqQixFQUFxQjtBQUMxQixJQUFFLElBQUY7QUFDQSxNQUFJO0FBQ0YsV0FBTyxJQUFQO0FBQ0QsR0FGRCxTQUVVO0FBQ1IsUUFBSSxDQUFDLEdBQUUsSUFBUCxFQUNFO0FBQ0g7QUFDRjs7QUFFRDs7QUFFTyxTQUFTLGVBQVQsR0FBMkI7QUFDaEMsa0JBQVMsSUFBVCxDQUFjLElBQWQ7QUFDRDs7QUFFRCx5QkFBUSxlQUFSLG1CQUFtQztBQUNqQyxLQURpQyxlQUM3QixLQUQ2QixFQUN0QjtBQUNULFNBQUssTUFBTCxDQUFZLHdCQUFPLEtBQVAsQ0FBWjtBQUNELEdBSGdDO0FBSWpDLFFBSmlDLG9CQUl4QjtBQUNQLFNBQUssR0FBTDtBQUNELEdBTmdDO0FBT2pDLE1BUGlDLGtCQU9yQjtBQUNWLFdBQU8sSUFBSSxVQUFKLENBQWUsSUFBZixFQUFxQiw0Q0FBckIsQ0FBUDtBQUNELEdBVGdDO0FBVWpDLGlCQVZpQywyQkFVakIsSUFWaUIsRUFVWDtBQUNwQixRQUFNLE9BQU8sS0FBSyxhQUFsQjtBQUNBLFFBQUksQ0FBQyxJQUFELElBQVMsQ0FBQyw0QkFBVyxLQUFLLEtBQWhCLEVBQXVCLElBQXZCLENBQWQsRUFDRSxLQUFLLFVBQUwsQ0FBZ0IsSUFBaEI7QUFDSDtBQWRnQyxDQUFuQzs7QUFpQkE7O0FBRU8sU0FBUyxpQkFBVCxDQUEyQixNQUEzQixFQUFtQztBQUN4QyxrQkFBZ0IsSUFBaEIsQ0FBcUIsSUFBckI7QUFDQSxPQUFLLE9BQUwsR0FBZSxNQUFmO0FBQ0EsT0FBSyxXQUFMLEdBQW1CLElBQW5CO0FBQ0Q7O0FBRUQseUJBQVEsaUJBQVIsRUFBMkIsZUFBM0IsRUFBNEM7QUFDMUMsS0FEMEMsaUJBQ3BDO0FBQ0osUUFBTSxVQUFVLEtBQUssYUFBckI7QUFDQSxRQUFJLFdBQVcsQ0FBQyxJQUFoQixFQUNFLE9BQU8sUUFBUSxLQUFmLENBREYsS0FHRSxPQUFPLEtBQUssY0FBTCxFQUFQO0FBQ0gsR0FQeUM7QUFRMUMsWUFSMEMsd0JBUTdCO0FBQ1gsU0FBSyxlQUFMLENBQXFCLEtBQUssY0FBTCxFQUFyQjtBQUNELEdBVnlDO0FBVzFDLGVBWDBDLDJCQVcxQjtBQUFBOztBQUNkLFFBQU0sWUFBWSxTQUFaLFNBQVk7QUFBQSxhQUFNLE1BQUssVUFBTCxFQUFOO0FBQUEsS0FBbEI7QUFDQSxTQUFLLFdBQUwsR0FBbUIsU0FBbkI7QUFDQSxTQUFLLE9BQUwsQ0FBYSxLQUFiLENBQW1CLFNBQW5CO0FBQ0QsR0FmeUM7QUFnQjFDLGlCQWhCMEMsNkJBZ0J4QjtBQUNoQixTQUFLLE9BQUwsQ0FBYSxNQUFiLENBQW9CLEtBQUssV0FBekI7QUFDQSxTQUFLLFdBQUwsR0FBbUIsSUFBbkI7QUFDQSxTQUFLLGFBQUwsR0FBcUIsSUFBckI7QUFDRDtBQXBCeUMsQ0FBNUM7O0FBdUJBOztBQUVPLFNBQVMsVUFBVCxDQUFvQixNQUFwQixFQUE0QixJQUE1QixFQUFrQztBQUN2QyxvQkFBa0IsSUFBbEIsQ0FBdUIsSUFBdkIsRUFBNkIsTUFBN0I7QUFDQSxPQUFLLEtBQUwsR0FBYSxJQUFiO0FBQ0Q7O0FBRUQseUJBQVEsVUFBUixFQUFvQixpQkFBcEIsRUFBdUM7QUFDckMsS0FEcUMsZUFDakMsQ0FEaUMsRUFDOUI7QUFDTCxTQUFLLE9BQUwsQ0FBYSxHQUFiLENBQWlCLGtCQUFJLEtBQUssS0FBVCxFQUFnQixDQUFoQixFQUFtQixLQUFLLE9BQUwsQ0FBYSxHQUFiLEVBQW5CLENBQWpCO0FBQ0QsR0FIb0M7QUFJckMsUUFKcUMsa0JBSTlCLEVBSjhCLEVBSTFCO0FBQ1QsU0FBSyxPQUFMLENBQWEsTUFBYixDQUFvQixxQkFBTyxLQUFLLEtBQVosRUFBbUIsRUFBbkIsQ0FBcEI7QUFDRCxHQU5vQztBQU9yQyxnQkFQcUMsNEJBT3BCO0FBQ2YsV0FBTyxrQkFBSSxLQUFLLEtBQVQsRUFBZ0IsS0FBSyxPQUFMLENBQWEsR0FBYixFQUFoQixDQUFQO0FBQ0Q7QUFUb0MsQ0FBdkM7O0FBWUE7O0FBRU8sU0FBUyxJQUFULEdBQWdCO0FBQ3JCLGtCQUFnQixJQUFoQixDQUFxQixJQUFyQjtBQUNBLE1BQUksVUFBVSxNQUFkLEVBQ0UsS0FBSyxVQUFMLENBQWdCLFVBQVUsQ0FBVixDQUFoQjtBQUNIOztBQUVELHlCQUFRLElBQVIsRUFBYyxlQUFkLEVBQStCO0FBQzdCLEtBRDZCLGlCQUN2QjtBQUNKLFFBQU0sVUFBVSxLQUFLLGFBQXJCO0FBQ0EsV0FBTyxVQUFVLFFBQVEsS0FBbEIsR0FBMEIsU0FBakM7QUFDRCxHQUo0QjtBQUs3QixLQUw2QixlQUt6QixDQUx5QixFQUt0QjtBQUNMLFFBQU0sVUFBVSxLQUFLLGFBQXJCO0FBQ0EsU0FBSyxZQUFMLENBQWtCLE9BQWxCLEVBQTJCLFVBQVUsUUFBUSxLQUFsQixHQUEwQixTQUFyRCxFQUFnRSxDQUFoRTtBQUNELEdBUjRCO0FBUzdCLFFBVDZCLGtCQVN0QixFQVRzQixFQVNsQjtBQUNULFFBQU0sVUFBVSxLQUFLLGFBQXJCO0FBQ0EsUUFBTSxPQUFPLFVBQVUsUUFBUSxLQUFsQixHQUEwQixTQUF2QztBQUNBLFNBQUssWUFBTCxDQUFrQixPQUFsQixFQUEyQixJQUEzQixFQUFpQyxHQUFHLElBQUgsQ0FBakM7QUFDRCxHQWI0QjtBQWM3QixjQWQ2Qix3QkFjaEIsT0FkZ0IsRUFjUCxJQWRPLEVBY0QsSUFkQyxFQWNLO0FBQ2hDLFFBQUksSUFBSixFQUFVO0FBQ1IsVUFBSSxNQUFNLE9BQU4sQ0FBYyxJQUFkLElBQXNCLENBQTFCLEVBQTZCO0FBQzNCLGNBQU0sSUFBTixDQUFXLFVBQVUsSUFBVixHQUFpQixRQUE1QjtBQUNBLGNBQU0sSUFBTixDQUFXLElBQVg7QUFDRDtBQUNELFVBQUksT0FBSixFQUNFLFFBQVEsS0FBUixHQUFnQixJQUFoQixDQURGLEtBR0UsS0FBSyxhQUFMLEdBQXFCLEVBQUMsTUFBTSxPQUFQLEVBQWdCLE9BQU8sSUFBdkIsRUFBckI7QUFDSCxLQVRELE1BU087QUFDTCxXQUFLLGVBQUwsQ0FBcUIsSUFBckI7QUFDRDtBQUNGO0FBM0I0QixDQUEvQjs7QUE4QkE7O0FBRUEsU0FBUyxZQUFULENBQXNCLFFBQXRCLEVBQWdDLFFBQWhDLEVBQTBDO0FBQ3hDLE1BQUksb0JBQW9CLGVBQXBCLElBQ0EsU0FBUyxPQUFULENBQWlCLFFBQWpCLElBQTZCLENBRGpDLEVBQ29DO0FBQ2xDLGFBQVMsSUFBVCxDQUFjLFFBQWQ7QUFDRCxHQUhELE1BR087QUFDTCxRQUFJLHlCQUFRLFFBQVIsQ0FBSixFQUNFLEtBQUssSUFBSSxJQUFFLENBQU4sRUFBUyxJQUFFLFNBQVMsTUFBekIsRUFBaUMsSUFBRSxDQUFuQyxFQUFzQyxFQUFFLENBQXhDO0FBQ0UsbUJBQWEsU0FBUyxDQUFULENBQWIsRUFBMEIsUUFBMUI7QUFERixLQURGLE1BR0ssSUFBSSwwQkFBUyxRQUFULENBQUosRUFDSCxLQUFLLElBQU0sQ0FBWCxJQUFnQixRQUFoQjtBQUNFLG1CQUFhLFNBQVMsQ0FBVCxDQUFiLEVBQTBCLFFBQTFCO0FBREY7QUFFSDtBQUNGOztBQUVELFNBQVMsUUFBVCxDQUFrQixRQUFsQixFQUE0QjtBQUMxQixNQUFJLG9CQUFvQixlQUF4QixFQUF5QztBQUN2QyxXQUFPLFNBQVMsR0FBVCxFQUFQO0FBQ0QsR0FGRCxNQUVPO0FBQ0wsUUFBSSx5QkFBUSxRQUFSLENBQUosRUFBdUI7QUFDckIsVUFBTSxJQUFJLFNBQVMsTUFBbkI7QUFDQSxVQUFNLE9BQU8sTUFBTSxDQUFOLENBQWI7QUFDQSxXQUFLLElBQUksSUFBRSxDQUFYLEVBQWMsSUFBRSxDQUFoQixFQUFtQixFQUFFLENBQXJCO0FBQ0UsYUFBSyxDQUFMLElBQVUsU0FBUyxTQUFTLENBQVQsQ0FBVCxDQUFWO0FBREYsT0FFQSxPQUFPLElBQVA7QUFDRCxLQU5ELE1BTU8sSUFBSSwwQkFBUyxRQUFULENBQUosRUFBd0I7QUFDN0IsVUFBTSxRQUFPLEVBQWI7QUFDQSxXQUFLLElBQU0sQ0FBWCxJQUFnQixRQUFoQjtBQUNFLGNBQUssQ0FBTCxJQUFVLFNBQVMsU0FBUyxDQUFULENBQVQsQ0FBVjtBQURGLE9BRUEsT0FBTyxLQUFQO0FBQ0QsS0FMTSxNQUtBO0FBQ0wsYUFBTyxRQUFQO0FBQ0Q7QUFDRjtBQUNGOztBQUVELFNBQVMsUUFBVCxHQUFvQjtBQUFDLFFBQU0sSUFBSSxLQUFKLENBQVUsc0NBQVYsQ0FBTjtBQUF3RDs7QUFFN0UsU0FBUyxXQUFULENBQXFCLFFBQXJCLEVBQStCLEtBQS9CLEVBQXNDO0FBQ3BDLE1BQUksb0JBQW9CLGVBQXhCLEVBQXlDO0FBQ3ZDLFdBQU8sU0FBUyxHQUFULENBQWEsS0FBYixDQUFQO0FBQ0QsR0FGRCxNQUVPO0FBQ0wsUUFBSSx5QkFBUSxRQUFSLEtBQXFCLHlCQUFRLEtBQVIsQ0FBekIsRUFDRSxLQUFLLElBQUksSUFBRSxDQUFOLEVBQVMsSUFBRSxTQUFTLE1BQXpCLEVBQWlDLElBQUUsQ0FBbkMsRUFBc0MsRUFBRSxDQUF4QztBQUNFLGtCQUFZLFNBQVMsQ0FBVCxDQUFaLEVBQXlCLE1BQU0sQ0FBTixDQUF6QjtBQURGLEtBREYsTUFHSyxJQUFJLDBCQUFTLFFBQVQsS0FBc0IsMEJBQVMsS0FBVCxDQUExQixFQUNILEtBQUssSUFBTSxDQUFYLElBQWdCLFFBQWhCO0FBQ0Usa0JBQVksU0FBUyxDQUFULENBQVosRUFBeUIsTUFBTSxDQUFOLENBQXpCO0FBREYsS0FERyxNQUdBLElBQUksQ0FBQyw0QkFBVyxRQUFYLEVBQXFCLEtBQXJCLENBQUwsRUFDSDtBQUNIO0FBQ0Y7O0FBRU0sU0FBUyxRQUFULENBQWtCLFFBQWxCLEVBQTRCO0FBQ2pDLE1BQU0sV0FBVyxFQUFqQjtBQUNBLGVBQWEsUUFBYixFQUF1QixRQUF2QjtBQUNBLG9CQUFrQixJQUFsQixDQUF1QixJQUF2QixFQUE2QixvQkFBUSxRQUFSLENBQTdCO0FBQ0EsT0FBSyxTQUFMLEdBQWlCLFFBQWpCO0FBQ0Q7O0FBRUQseUJBQVEsUUFBUixFQUFrQixpQkFBbEIsRUFBcUM7QUFDbkMsZ0JBRG1DLDRCQUNsQjtBQUNmLFdBQU8sU0FBUyxLQUFLLFNBQWQsQ0FBUDtBQUNELEdBSGtDO0FBSW5DLFFBSm1DLGtCQUk1QixFQUo0QixFQUl4QjtBQUFBOztBQUNULFFBQU0sT0FBTyxHQUFHLEtBQUssR0FBTCxFQUFILENBQWI7QUFDQSxZQUFRO0FBQUEsYUFBTSxZQUFZLE9BQUssU0FBakIsRUFBNEIsSUFBNUIsQ0FBTjtBQUFBLEtBQVI7QUFDRDtBQVBrQyxDQUFyQzs7QUFVQTs7QUFFZSxTQUFTLElBQVQsR0FBZ0I7QUFDN0IsTUFBSSxVQUFVLE1BQWQsRUFDRSxPQUFPLElBQUksSUFBSixDQUFTLFVBQVUsQ0FBVixDQUFULENBQVAsQ0FERixLQUdFLE9BQU8sSUFBSSxJQUFKLEVBQVA7QUFDSCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJpbXBvcnQge2Fsd2F5cywgaWRlbnRpY2FsVSwgaW5oZXJpdCwgaXNBcnJheSwgaXNPYmplY3R9IGZyb20gXCJpbmZlc3RpbmVzXCJcbmltcG9ydCB7UHJvcGVydHksIGNvbWJpbmV9IGZyb20gXCJrZWZpclwiXG5pbXBvcnQge2NvbXBvc2UsIGdldCwgbW9kaWZ5LCBzZXR9IGZyb20gXCJwYXJ0aWFsLmxlbnNlc1wiXG5cbi8vXG5cbmxldCBsb2NrID0gMFxuXG5jb25zdCBwcmV2cyA9IFtdXG5jb25zdCBhdG9tcyA9IFtdXG5cbmZ1bmN0aW9uIHJlbGVhc2UoKSB7XG4gIHdoaWxlIChwcmV2cy5sZW5ndGgpIHtcbiAgICBjb25zdCBwcmV2ID0gcHJldnMuc2hpZnQoKVxuICAgIGNvbnN0IGF0b20gPSBhdG9tcy5zaGlmdCgpXG4gICAgY29uc3QgbmV4dCA9IGF0b20uX2N1cnJlbnRFdmVudC52YWx1ZVxuXG4gICAgaWYgKCFpZGVudGljYWxVKHByZXYsIG5leHQpKVxuICAgICAgYXRvbS5fZW1pdFZhbHVlKG5leHQpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvbGRpbmcoZWYpIHtcbiAgKytsb2NrXG4gIHRyeSB7XG4gICAgcmV0dXJuIGVmKClcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoIS0tbG9jaylcbiAgICAgIHJlbGVhc2UoKVxuICB9XG59XG5cbi8vXG5cbmV4cG9ydCBmdW5jdGlvbiBBYnN0cmFjdE11dGFibGUoKSB7XG4gIFByb3BlcnR5LmNhbGwodGhpcylcbn1cblxuaW5oZXJpdChBYnN0cmFjdE11dGFibGUsIFByb3BlcnR5LCB7XG4gIHNldCh2YWx1ZSkge1xuICAgIHRoaXMubW9kaWZ5KGFsd2F5cyh2YWx1ZSkpXG4gIH0sXG4gIHJlbW92ZSgpIHtcbiAgICB0aGlzLnNldCgpXG4gIH0sXG4gIHZpZXcoLi4ubHMpIHtcbiAgICByZXR1cm4gbmV3IExlbnNlZEF0b20odGhpcywgY29tcG9zZSguLi5scykpXG4gIH0sXG4gIF9tYXliZUVtaXRWYWx1ZShuZXh0KSB7XG4gICAgY29uc3QgcHJldiA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIGlmICghcHJldiB8fCAhaWRlbnRpY2FsVShwcmV2LnZhbHVlLCBuZXh0KSlcbiAgICAgIHRoaXMuX2VtaXRWYWx1ZShuZXh0KVxuICB9XG59KVxuXG4vL1xuXG5leHBvcnQgZnVuY3Rpb24gTXV0YWJsZVdpdGhTb3VyY2Uoc291cmNlKSB7XG4gIEFic3RyYWN0TXV0YWJsZS5jYWxsKHRoaXMpXG4gIHRoaXMuX3NvdXJjZSA9IHNvdXJjZVxuICB0aGlzLl8kaGFuZGxlQW55ID0gbnVsbFxufVxuXG5pbmhlcml0KE11dGFibGVXaXRoU291cmNlLCBBYnN0cmFjdE11dGFibGUsIHtcbiAgZ2V0KCkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBpZiAoY3VycmVudCAmJiAhbG9jaylcbiAgICAgIHJldHVybiBjdXJyZW50LnZhbHVlXG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHRoaXMuX2dldEZyb21Tb3VyY2UoKVxuICB9LFxuICBfaGFuZGxlQW55KCkge1xuICAgIHRoaXMuX21heWJlRW1pdFZhbHVlKHRoaXMuX2dldEZyb21Tb3VyY2UoKSlcbiAgfSxcbiAgX29uQWN0aXZhdGlvbigpIHtcbiAgICBjb25zdCBoYW5kbGVBbnkgPSAoKSA9PiB0aGlzLl9oYW5kbGVBbnkoKVxuICAgIHRoaXMuXyRoYW5kbGVBbnkgPSBoYW5kbGVBbnlcbiAgICB0aGlzLl9zb3VyY2Uub25BbnkoaGFuZGxlQW55KVxuICB9LFxuICBfb25EZWFjdGl2YXRpb24oKSB7XG4gICAgdGhpcy5fc291cmNlLm9mZkFueSh0aGlzLl8kaGFuZGxlQW55KVxuICAgIHRoaXMuXyRoYW5kbGVBbnkgPSBudWxsXG4gICAgdGhpcy5fY3VycmVudEV2ZW50ID0gbnVsbFxuICB9XG59KVxuXG4vL1xuXG5leHBvcnQgZnVuY3Rpb24gTGVuc2VkQXRvbShzb3VyY2UsIGxlbnMpIHtcbiAgTXV0YWJsZVdpdGhTb3VyY2UuY2FsbCh0aGlzLCBzb3VyY2UpXG4gIHRoaXMuX2xlbnMgPSBsZW5zXG59XG5cbmluaGVyaXQoTGVuc2VkQXRvbSwgTXV0YWJsZVdpdGhTb3VyY2UsIHtcbiAgc2V0KHYpIHtcbiAgICB0aGlzLl9zb3VyY2Uuc2V0KHNldCh0aGlzLl9sZW5zLCB2LCB0aGlzLl9zb3VyY2UuZ2V0KCkpKVxuICB9LFxuICBtb2RpZnkoZm4pIHtcbiAgICB0aGlzLl9zb3VyY2UubW9kaWZ5KG1vZGlmeSh0aGlzLl9sZW5zLCBmbikpXG4gIH0sXG4gIF9nZXRGcm9tU291cmNlKCkge1xuICAgIHJldHVybiBnZXQodGhpcy5fbGVucywgdGhpcy5fc291cmNlLmdldCgpKVxuICB9XG59KVxuXG4vL1xuXG5leHBvcnQgZnVuY3Rpb24gQXRvbSgpIHtcbiAgQWJzdHJhY3RNdXRhYmxlLmNhbGwodGhpcylcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpXG4gICAgdGhpcy5fZW1pdFZhbHVlKGFyZ3VtZW50c1swXSlcbn1cblxuaW5oZXJpdChBdG9tLCBBYnN0cmFjdE11dGFibGUsIHtcbiAgZ2V0KCkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICByZXR1cm4gY3VycmVudCA/IGN1cnJlbnQudmFsdWUgOiB1bmRlZmluZWRcbiAgfSxcbiAgc2V0KHYpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5fY3VycmVudEV2ZW50XG4gICAgdGhpcy5fc2V0SW50ZXJuYWwoY3VycmVudCwgY3VycmVudCA/IGN1cnJlbnQudmFsdWUgOiB1bmRlZmluZWQsIHYpXG4gIH0sXG4gIG1vZGlmeShmbikge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBjb25zdCBwcmV2ID0gY3VycmVudCA/IGN1cnJlbnQudmFsdWUgOiB1bmRlZmluZWRcbiAgICB0aGlzLl9zZXRJbnRlcm5hbChjdXJyZW50LCBwcmV2LCBmbihwcmV2KSlcbiAgfSxcbiAgX3NldEludGVybmFsKGN1cnJlbnQsIHByZXYsIG5leHQpIHtcbiAgICBpZiAobG9jaykge1xuICAgICAgaWYgKGF0b21zLmluZGV4T2YodGhpcykgPCAwKSB7XG4gICAgICAgIHByZXZzLnB1c2goY3VycmVudCA/IHByZXYgOiBtaXNtYXRjaClcbiAgICAgICAgYXRvbXMucHVzaCh0aGlzKVxuICAgICAgfVxuICAgICAgaWYgKGN1cnJlbnQpXG4gICAgICAgIGN1cnJlbnQudmFsdWUgPSBuZXh0XG4gICAgICBlbHNlXG4gICAgICAgIHRoaXMuX2N1cnJlbnRFdmVudCA9IHt0eXBlOiBcInZhbHVlXCIsIHZhbHVlOiBuZXh0fVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9tYXliZUVtaXRWYWx1ZShuZXh0KVxuICAgIH1cbiAgfVxufSlcblxuLy9cblxuZnVuY3Rpb24gcHVzaE11dGFibGVzKHRlbXBsYXRlLCBtdXRhYmxlcykge1xuICBpZiAodGVtcGxhdGUgaW5zdGFuY2VvZiBBYnN0cmFjdE11dGFibGUgJiZcbiAgICAgIG11dGFibGVzLmluZGV4T2YodGVtcGxhdGUpIDwgMCkge1xuICAgIG11dGFibGVzLnB1c2godGVtcGxhdGUpXG4gIH0gZWxzZSB7XG4gICAgaWYgKGlzQXJyYXkodGVtcGxhdGUpKVxuICAgICAgZm9yIChsZXQgaT0wLCBuPXRlbXBsYXRlLmxlbmd0aDsgaTxuOyArK2kpXG4gICAgICAgIHB1c2hNdXRhYmxlcyh0ZW1wbGF0ZVtpXSwgbXV0YWJsZXMpXG4gICAgZWxzZSBpZiAoaXNPYmplY3QodGVtcGxhdGUpKVxuICAgICAgZm9yIChjb25zdCBrIGluIHRlbXBsYXRlKVxuICAgICAgICBwdXNoTXV0YWJsZXModGVtcGxhdGVba10sIG11dGFibGVzKVxuICB9XG59XG5cbmZ1bmN0aW9uIG1vbGVjdWxlKHRlbXBsYXRlKSB7XG4gIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIEFic3RyYWN0TXV0YWJsZSkge1xuICAgIHJldHVybiB0ZW1wbGF0ZS5nZXQoKVxuICB9IGVsc2Uge1xuICAgIGlmIChpc0FycmF5KHRlbXBsYXRlKSkge1xuICAgICAgY29uc3QgbiA9IHRlbXBsYXRlLmxlbmd0aFxuICAgICAgY29uc3QgbmV4dCA9IEFycmF5KG4pXG4gICAgICBmb3IgKGxldCBpPTA7IGk8bjsgKytpKVxuICAgICAgICBuZXh0W2ldID0gbW9sZWN1bGUodGVtcGxhdGVbaV0pXG4gICAgICByZXR1cm4gbmV4dFxuICAgIH0gZWxzZSBpZiAoaXNPYmplY3QodGVtcGxhdGUpKSB7XG4gICAgICBjb25zdCBuZXh0ID0ge31cbiAgICAgIGZvciAoY29uc3QgayBpbiB0ZW1wbGF0ZSlcbiAgICAgICAgbmV4dFtrXSA9IG1vbGVjdWxlKHRlbXBsYXRlW2tdKVxuICAgICAgcmV0dXJuIG5leHRcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRlbXBsYXRlXG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG1pc21hdGNoKCkge3Rocm93IG5ldyBFcnJvcihcIk1vbGVjdWxlIGNhbm5vdCBjaGFuZ2UgdGhlIHRlbXBsYXRlLlwiKX1cblxuZnVuY3Rpb24gc2V0TXV0YWJsZXModGVtcGxhdGUsIHZhbHVlKSB7XG4gIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIEFic3RyYWN0TXV0YWJsZSkge1xuICAgIHJldHVybiB0ZW1wbGF0ZS5zZXQodmFsdWUpXG4gIH0gZWxzZSB7XG4gICAgaWYgKGlzQXJyYXkodGVtcGxhdGUpICYmIGlzQXJyYXkodmFsdWUpKVxuICAgICAgZm9yIChsZXQgaT0wLCBuPXRlbXBsYXRlLmxlbmd0aDsgaTxuOyArK2kpXG4gICAgICAgIHNldE11dGFibGVzKHRlbXBsYXRlW2ldLCB2YWx1ZVtpXSlcbiAgICBlbHNlIGlmIChpc09iamVjdCh0ZW1wbGF0ZSkgJiYgaXNPYmplY3QodmFsdWUpKVxuICAgICAgZm9yIChjb25zdCBrIGluIHRlbXBsYXRlKVxuICAgICAgICBzZXRNdXRhYmxlcyh0ZW1wbGF0ZVtrXSwgdmFsdWVba10pXG4gICAgZWxzZSBpZiAoIWlkZW50aWNhbFUodGVtcGxhdGUsIHZhbHVlKSlcbiAgICAgIG1pc21hdGNoKClcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gTW9sZWN1bGUodGVtcGxhdGUpIHtcbiAgY29uc3QgbXV0YWJsZXMgPSBbXVxuICBwdXNoTXV0YWJsZXModGVtcGxhdGUsIG11dGFibGVzKVxuICBNdXRhYmxlV2l0aFNvdXJjZS5jYWxsKHRoaXMsIGNvbWJpbmUobXV0YWJsZXMpKVxuICB0aGlzLl90ZW1wbGF0ZSA9IHRlbXBsYXRlXG59XG5cbmluaGVyaXQoTW9sZWN1bGUsIE11dGFibGVXaXRoU291cmNlLCB7XG4gIF9nZXRGcm9tU291cmNlKCkge1xuICAgIHJldHVybiBtb2xlY3VsZSh0aGlzLl90ZW1wbGF0ZSlcbiAgfSxcbiAgbW9kaWZ5KGZuKSB7XG4gICAgY29uc3QgbmV4dCA9IGZuKHRoaXMuZ2V0KCkpXG4gICAgaG9sZGluZygoKSA9PiBzZXRNdXRhYmxlcyh0aGlzLl90ZW1wbGF0ZSwgbmV4dCkpXG4gIH1cbn0pXG5cbi8vXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGF0b20oKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoKVxuICAgIHJldHVybiBuZXcgQXRvbShhcmd1bWVudHNbMF0pXG4gIGVsc2VcbiAgICByZXR1cm4gbmV3IEF0b20oKVxufVxuIl19
