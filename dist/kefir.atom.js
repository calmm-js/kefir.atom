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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMva2VmaXIuYXRvbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O1FDc0JnQixPLEdBQUEsTztRQVlBLGUsR0FBQSxlO1FBeUJBLGlCLEdBQUEsaUI7UUErQkEsVSxHQUFBLFU7UUFtQkEsSSxHQUFBLEk7UUEwRkEsUSxHQUFBLFE7a0JBbUJRLEk7O0FBMU54Qjs7QUFDQTs7QUFDQTs7QUFFQTs7QUFFQSxJQUFJLE9BQU8sQ0FBWDs7QUFFQSxJQUFNLFFBQVEsRUFBZDtBQUNBLElBQU0sUUFBUSxFQUFkOztBQUVBLFNBQVMsT0FBVCxHQUFtQjtBQUNqQixTQUFPLE1BQU0sTUFBYixFQUFxQjtBQUNuQixRQUFNLE9BQU8sTUFBTSxLQUFOLEVBQWI7QUFDQSxRQUFNLFFBQU8sTUFBTSxLQUFOLEVBQWI7QUFDQSxRQUFNLE9BQU8sTUFBSyxhQUFMLENBQW1CLEtBQWhDOztBQUVBLFFBQUksQ0FBQyw0QkFBVyxJQUFYLEVBQWlCLElBQWpCLENBQUwsRUFDRSxNQUFLLFVBQUwsQ0FBZ0IsSUFBaEI7QUFDSDtBQUNGOztBQUVNLFNBQVMsT0FBVCxDQUFpQixFQUFqQixFQUFxQjtBQUMxQixJQUFFLElBQUY7QUFDQSxNQUFJO0FBQ0YsV0FBTyxJQUFQO0FBQ0QsR0FGRCxTQUVVO0FBQ1IsUUFBSSxDQUFDLEdBQUUsSUFBUCxFQUNFO0FBQ0g7QUFDRjs7QUFFRDs7QUFFTyxTQUFTLGVBQVQsR0FBMkI7QUFDaEMsa0JBQVMsSUFBVCxDQUFjLElBQWQ7QUFDRDs7QUFFRCx5QkFBUSxlQUFSLG1CQUFtQztBQUNqQyxLQURpQyxlQUM3QixLQUQ2QixFQUN0QjtBQUNULFNBQUssTUFBTCxDQUFZLHdCQUFPLEtBQVAsQ0FBWjtBQUNELEdBSGdDO0FBSWpDLFFBSmlDLG9CQUl4QjtBQUNQLFNBQUssR0FBTDtBQUNELEdBTmdDO0FBT2pDLE1BUGlDLGdCQU81QixJQVA0QixFQU90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ZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImltcG9ydCB7YWx3YXlzLCBpZGVudGljYWxVLCBpbmhlcml0LCBpc0FycmF5LCBpc09iamVjdH0gZnJvbSBcImluZmVzdGluZXNcIlxuaW1wb3J0IHtQcm9wZXJ0eSwgY29tYmluZX0gZnJvbSBcImtlZmlyXCJcbmltcG9ydCB7Z2V0LCBtb2RpZnksIHNldH0gZnJvbSBcInBhcnRpYWwubGVuc2VzXCJcblxuLy9cblxubGV0IGxvY2sgPSAwXG5cbmNvbnN0IHByZXZzID0gW11cbmNvbnN0IGF0b21zID0gW11cblxuZnVuY3Rpb24gcmVsZWFzZSgpIHtcbiAgd2hpbGUgKHByZXZzLmxlbmd0aCkge1xuICAgIGNvbnN0IHByZXYgPSBwcmV2cy5zaGlmdCgpXG4gICAgY29uc3QgYXRvbSA9IGF0b21zLnNoaWZ0KClcbiAgICBjb25zdCBuZXh0ID0gYXRvbS5fY3VycmVudEV2ZW50LnZhbHVlXG5cbiAgICBpZiAoIWlkZW50aWNhbFUocHJldiwgbmV4dCkpXG4gICAgICBhdG9tLl9lbWl0VmFsdWUobmV4dClcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaG9sZGluZyhlZikge1xuICArK2xvY2tcbiAgdHJ5IHtcbiAgICByZXR1cm4gZWYoKVxuICB9IGZpbmFsbHkge1xuICAgIGlmICghLS1sb2NrKVxuICAgICAgcmVsZWFzZSgpXG4gIH1cbn1cblxuLy9cblxuZXhwb3J0IGZ1bmN0aW9uIEFic3RyYWN0TXV0YWJsZSgpIHtcbiAgUHJvcGVydHkuY2FsbCh0aGlzKVxufVxuXG5pbmhlcml0KEFic3RyYWN0TXV0YWJsZSwgUHJvcGVydHksIHtcbiAgc2V0KHZhbHVlKSB7XG4gICAgdGhpcy5tb2RpZnkoYWx3YXlzKHZhbHVlKSlcbiAgfSxcbiAgcmVtb3ZlKCkge1xuICAgIHRoaXMuc2V0KClcbiAgfSxcbiAgdmlldyhsZW5zKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSBcInByb2R1Y3Rpb25cIiAmJiBhcmd1bWVudHMubGVuZ3RoICE9PSAxKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwia2VmaXIuYXRvbTogVGhlIGB2aWV3YCBtZXRob2QgdGFrZXMgZXhhY3RseSAxIGFyZ3VtZW50LlwiKVxuICAgIHJldHVybiBuZXcgTGVuc2VkQXRvbSh0aGlzLCBsZW5zKVxuICB9LFxuICBfbWF5YmVFbWl0VmFsdWUobmV4dCkge1xuICAgIGNvbnN0IHByZXYgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBpZiAoIXByZXYgfHwgIWlkZW50aWNhbFUocHJldi52YWx1ZSwgbmV4dCkpXG4gICAgICB0aGlzLl9lbWl0VmFsdWUobmV4dClcbiAgfVxufSlcblxuLy9cblxuZXhwb3J0IGZ1bmN0aW9uIE11dGFibGVXaXRoU291cmNlKHNvdXJjZSkge1xuICBBYnN0cmFjdE11dGFibGUuY2FsbCh0aGlzKVxuICB0aGlzLl9zb3VyY2UgPSBzb3VyY2VcbiAgdGhpcy5fJG9uQW55ID0gbnVsbFxufVxuXG5pbmhlcml0KE11dGFibGVXaXRoU291cmNlLCBBYnN0cmFjdE11dGFibGUsIHtcbiAgZ2V0KCkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBpZiAoY3VycmVudCAmJiAhbG9jaylcbiAgICAgIHJldHVybiBjdXJyZW50LnZhbHVlXG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHRoaXMuX2dldEZyb21Tb3VyY2UoKVxuICB9LFxuICBfb25BbnkoKSB7XG4gICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUodGhpcy5fZ2V0RnJvbVNvdXJjZSgpKVxuICB9LFxuICBfb25BY3RpdmF0aW9uKCkge1xuICAgIGNvbnN0IG9uQW55ID0gKCkgPT4gdGhpcy5fb25BbnkoKVxuICAgIHRoaXMuXyRvbkFueSA9IG9uQW55XG4gICAgdGhpcy5fc291cmNlLm9uQW55KG9uQW55KVxuICB9LFxuICBfb25EZWFjdGl2YXRpb24oKSB7XG4gICAgdGhpcy5fc291cmNlLm9mZkFueSh0aGlzLl8kb25BbnkpXG4gICAgdGhpcy5fJG9uQW55ID0gbnVsbFxuICAgIHRoaXMuX2N1cnJlbnRFdmVudCA9IG51bGxcbiAgfVxufSlcblxuLy9cblxuZXhwb3J0IGZ1bmN0aW9uIExlbnNlZEF0b20oc291cmNlLCBsZW5zKSB7XG4gIE11dGFibGVXaXRoU291cmNlLmNhbGwodGhpcywgc291cmNlKVxuICB0aGlzLl9sZW5zID0gbGVuc1xufVxuXG5pbmhlcml0KExlbnNlZEF0b20sIE11dGFibGVXaXRoU291cmNlLCB7XG4gIHNldCh2KSB7XG4gICAgdGhpcy5fc291cmNlLnNldChzZXQodGhpcy5fbGVucywgdiwgdGhpcy5fc291cmNlLmdldCgpKSlcbiAgfSxcbiAgbW9kaWZ5KGZuKSB7XG4gICAgdGhpcy5fc291cmNlLm1vZGlmeShtb2RpZnkodGhpcy5fbGVucywgZm4pKVxuICB9LFxuICBfZ2V0RnJvbVNvdXJjZSgpIHtcbiAgICByZXR1cm4gZ2V0KHRoaXMuX2xlbnMsIHRoaXMuX3NvdXJjZS5nZXQoKSlcbiAgfVxufSlcblxuLy9cblxuZXhwb3J0IGZ1bmN0aW9uIEF0b20oKSB7XG4gIEFic3RyYWN0TXV0YWJsZS5jYWxsKHRoaXMpXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoKVxuICAgIHRoaXMuX2VtaXRWYWx1ZShhcmd1bWVudHNbMF0pXG59XG5cbmluaGVyaXQoQXRvbSwgQWJzdHJhY3RNdXRhYmxlLCB7XG4gIGdldCgpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5fY3VycmVudEV2ZW50XG4gICAgcmV0dXJuIGN1cnJlbnQgPyBjdXJyZW50LnZhbHVlIDogdW5kZWZpbmVkXG4gIH0sXG4gIHNldCh2KSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIHRoaXMuX3NldChjdXJyZW50LCBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZCwgdilcbiAgfSxcbiAgbW9kaWZ5KGZuKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIGNvbnN0IHByZXYgPSBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZFxuICAgIHRoaXMuX3NldChjdXJyZW50LCBwcmV2LCBmbihwcmV2KSlcbiAgfSxcbiAgX3NldChjdXJyZW50LCBwcmV2LCBuZXh0KSB7XG4gICAgaWYgKGxvY2spIHtcbiAgICAgIGlmIChhdG9tcy5pbmRleE9mKHRoaXMpIDwgMCkge1xuICAgICAgICBwcmV2cy5wdXNoKGN1cnJlbnQgPyBwcmV2IDogbWlzbWF0Y2gpXG4gICAgICAgIGF0b21zLnB1c2godGhpcylcbiAgICAgIH1cbiAgICAgIGlmIChjdXJyZW50KVxuICAgICAgICBjdXJyZW50LnZhbHVlID0gbmV4dFxuICAgICAgZWxzZVxuICAgICAgICB0aGlzLl9jdXJyZW50RXZlbnQgPSB7dHlwZTogXCJ2YWx1ZVwiLCB2YWx1ZTogbmV4dH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUobmV4dClcbiAgICB9XG4gIH1cbn0pXG5cbi8vXG5cbmZ1bmN0aW9uIHB1c2hNdXRhYmxlcyh0ZW1wbGF0ZSwgbXV0YWJsZXMpIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlICYmXG4gICAgICBtdXRhYmxlcy5pbmRleE9mKHRlbXBsYXRlKSA8IDApIHtcbiAgICBtdXRhYmxlcy5wdXNoKHRlbXBsYXRlKVxuICB9IGVsc2Uge1xuICAgIGlmIChpc0FycmF5KHRlbXBsYXRlKSlcbiAgICAgIGZvciAobGV0IGk9MCwgbj10ZW1wbGF0ZS5sZW5ndGg7IGk8bjsgKytpKVxuICAgICAgICBwdXNoTXV0YWJsZXModGVtcGxhdGVbaV0sIG11dGFibGVzKVxuICAgIGVsc2UgaWYgKGlzT2JqZWN0KHRlbXBsYXRlKSlcbiAgICAgIGZvciAoY29uc3QgayBpbiB0ZW1wbGF0ZSlcbiAgICAgICAgcHVzaE11dGFibGVzKHRlbXBsYXRlW2tdLCBtdXRhYmxlcylcbiAgfVxufVxuXG5mdW5jdGlvbiBtb2xlY3VsZSh0ZW1wbGF0ZSkge1xuICBpZiAodGVtcGxhdGUgaW5zdGFuY2VvZiBBYnN0cmFjdE11dGFibGUpIHtcbiAgICByZXR1cm4gdGVtcGxhdGUuZ2V0KClcbiAgfSBlbHNlIHtcbiAgICBpZiAoaXNBcnJheSh0ZW1wbGF0ZSkpIHtcbiAgICAgIGNvbnN0IG4gPSB0ZW1wbGF0ZS5sZW5ndGhcbiAgICAgIGNvbnN0IG5leHQgPSBBcnJheShuKVxuICAgICAgZm9yIChsZXQgaT0wOyBpPG47ICsraSlcbiAgICAgICAgbmV4dFtpXSA9IG1vbGVjdWxlKHRlbXBsYXRlW2ldKVxuICAgICAgcmV0dXJuIG5leHRcbiAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KHRlbXBsYXRlKSkge1xuICAgICAgY29uc3QgbmV4dCA9IHt9XG4gICAgICBmb3IgKGNvbnN0IGsgaW4gdGVtcGxhdGUpXG4gICAgICAgIG5leHRba10gPSBtb2xlY3VsZSh0ZW1wbGF0ZVtrXSlcbiAgICAgIHJldHVybiBuZXh0XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0ZW1wbGF0ZVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBtaXNtYXRjaCgpIHt0aHJvdyBuZXcgRXJyb3IoXCJNb2xlY3VsZSBjYW5ub3QgY2hhbmdlIHRoZSB0ZW1wbGF0ZS5cIil9XG5cbmZ1bmN0aW9uIHNldE11dGFibGVzKHRlbXBsYXRlLCB2YWx1ZSkge1xuICBpZiAodGVtcGxhdGUgaW5zdGFuY2VvZiBBYnN0cmFjdE11dGFibGUpIHtcbiAgICByZXR1cm4gdGVtcGxhdGUuc2V0KHZhbHVlKVxuICB9IGVsc2Uge1xuICAgIGlmIChpc0FycmF5KHRlbXBsYXRlKSAmJiBpc0FycmF5KHZhbHVlKSlcbiAgICAgIGZvciAobGV0IGk9MCwgbj10ZW1wbGF0ZS5sZW5ndGg7IGk8bjsgKytpKVxuICAgICAgICBzZXRNdXRhYmxlcyh0ZW1wbGF0ZVtpXSwgdmFsdWVbaV0pXG4gICAgZWxzZSBpZiAoaXNPYmplY3QodGVtcGxhdGUpICYmIGlzT2JqZWN0KHZhbHVlKSlcbiAgICAgIGZvciAoY29uc3QgayBpbiB0ZW1wbGF0ZSlcbiAgICAgICAgc2V0TXV0YWJsZXModGVtcGxhdGVba10sIHZhbHVlW2tdKVxuICAgIGVsc2UgaWYgKCFpZGVudGljYWxVKHRlbXBsYXRlLCB2YWx1ZSkpXG4gICAgICBtaXNtYXRjaCgpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIE1vbGVjdWxlKHRlbXBsYXRlKSB7XG4gIGNvbnN0IG11dGFibGVzID0gW11cbiAgcHVzaE11dGFibGVzKHRlbXBsYXRlLCBtdXRhYmxlcylcbiAgTXV0YWJsZVdpdGhTb3VyY2UuY2FsbCh0aGlzLCBjb21iaW5lKG11dGFibGVzKSlcbiAgdGhpcy5fdGVtcGxhdGUgPSB0ZW1wbGF0ZVxufVxuXG5pbmhlcml0KE1vbGVjdWxlLCBNdXRhYmxlV2l0aFNvdXJjZSwge1xuICBfZ2V0RnJvbVNvdXJjZSgpIHtcbiAgICByZXR1cm4gbW9sZWN1bGUodGhpcy5fdGVtcGxhdGUpXG4gIH0sXG4gIG1vZGlmeShmbikge1xuICAgIGNvbnN0IG5leHQgPSBmbih0aGlzLmdldCgpKVxuICAgIGhvbGRpbmcoKCkgPT4gc2V0TXV0YWJsZXModGhpcy5fdGVtcGxhdGUsIG5leHQpKVxuICB9XG59KVxuXG4vL1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhdG9tKCkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aClcbiAgICByZXR1cm4gbmV3IEF0b20oYXJndW1lbnRzWzBdKVxuICBlbHNlXG4gICAgcmV0dXJuIG5ldyBBdG9tKClcbn1cbiJdfQ==
