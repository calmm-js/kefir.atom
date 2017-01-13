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

var warned = {};
function warn(message) {
  if (!(message in warned)) {
    warned[message] = message;
    console.warn("kefir.atom:", message);
  }
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
    this.modify(function () {
      return value;
    });
  },
  remove: function remove() {
    this.set();
  },
  lens: function lens() {
    if ("dev" !== "production") warn("The `lens` method has been deprecated. Use the `view` method instead.");
    return this.view.apply(this, arguments);
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
    var _this2 = this;

    if (lock) {
      if (!atoms.find(function (x) {
        return x === _this2;
      })) {
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

function getMutables(template) {
  var mutables = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  if (template instanceof AbstractMutable && !mutables.find(function (m) {
    return m === template;
  })) {
    mutables.push(template);
  } else {
    if ((0, _infestines.isArray)(template)) for (var i = 0, n = template.length; i < n; ++i) {
      getMutables(template[i], mutables);
    } else if ((0, _infestines.isObject)(template)) for (var k in template) {
      getMutables(template[k], mutables);
    }
  }
  return mutables;
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
  MutableWithSource.call(this, (0, _kefir.combine)(getMutables(template)));
  this._template = template;
}

(0, _infestines.inherit)(Molecule, MutableWithSource, {
  _getFromSource: function _getFromSource() {
    return molecule(this._template);
  },
  modify: function modify(fn) {
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

},{"infestines":undefined,"kefir":undefined,"partial.lenses":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMva2VmaXIuYXRvbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O1FDZ0NnQixPLEdBQUEsTztRQVlBLGUsR0FBQSxlO1FBNEJBLGlCLEdBQUEsaUI7UUErQkEsVSxHQUFBLFU7UUFtQkEsSSxHQUFBLEk7UUEyRkEsUSxHQUFBLFE7a0JBaUJRLEk7O0FBdE94Qjs7QUFDQTs7QUFDQTs7QUFFQTs7QUFFQSxJQUFNLFNBQVMsRUFBZjtBQUNBLFNBQVMsSUFBVCxDQUFjLE9BQWQsRUFBdUI7QUFDckIsTUFBSSxFQUFFLFdBQVcsTUFBYixDQUFKLEVBQTBCO0FBQ3hCLFdBQU8sT0FBUCxJQUFrQixPQUFsQjtBQUNBLFlBQVEsSUFBUixDQUFhLGFBQWIsRUFBNEIsT0FBNUI7QUFDRDtBQUNGOztBQUVEOztBQUVBLElBQUksT0FBTyxDQUFYOztBQUVBLElBQU0sUUFBUSxFQUFkO0FBQ0EsSUFBTSxRQUFRLEVBQWQ7O0FBRUEsU0FBUyxPQUFULEdBQW1CO0FBQ2pCLFNBQU8sTUFBTSxNQUFiLEVBQXFCO0FBQ25CLFFBQU0sT0FBTyxNQUFNLEtBQU4sRUFBYjtBQUNBLFFBQU0sUUFBTyxNQUFNLEtBQU4sRUFBYjtBQUNBLFFBQU0sT0FBTyxNQUFLLGFBQUwsQ0FBbUIsS0FBaEM7O0FBRUEsUUFBSSxDQUFDLDRCQUFXLElBQVgsRUFBaUIsSUFBakIsQ0FBTCxFQUNFLE1BQUssVUFBTCxDQUFnQixJQUFoQjtBQUNIO0FBQ0Y7O0FBRU0sU0FBUyxPQUFULENBQWlCLEVBQWpCLEVBQXFCO0FBQzFCLElBQUUsSUFBRjtBQUNBLE1BQUk7QUFDRixXQUFPLElBQVA7QUFDRCxHQUZELFNBRVU7QUFDUixRQUFJLENBQUMsR0FBRSxJQUFQLEVBQ0U7QUFDSDtBQUNGOztBQUVEOztBQUVPLFNBQVMsZUFBVCxHQUEyQjtBQUNoQyxrQkFBUyxJQUFULENBQWMsSUFBZDtBQUNEOztBQUVE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Q0EsWUFBUTtBQUFBLGFBQU0sWUFBWSxPQUFLLFNBQWpCLEVBQTRCLElBQTVCLENBQU47QUFBQSxLQUFSO0FBQ0Q7QUFQa0MsQ0FBckM7O0FBVUE7O0FBRWUsU0FBUyxJQUFULEdBQWdCO0FBQzdCLE1BQUksVUFBVSxNQUFkLEVBQ0UsT0FBTyxJQUFJLElBQUosQ0FBUyxVQUFVLENBQVYsQ0FBVCxDQUFQLENBREYsS0FHRSxPQUFPLElBQUksSUFBSixFQUFQO0FBQ0giLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiaW1wb3J0IHtpZGVudGljYWxVLCBpbmhlcml0LCBpc0FycmF5LCBpc09iamVjdH0gZnJvbSBcImluZmVzdGluZXNcIlxuaW1wb3J0IHtQcm9wZXJ0eSwgY29tYmluZX0gZnJvbSBcImtlZmlyXCJcbmltcG9ydCB7Y29tcG9zZSwgZ2V0LCBtb2RpZnksIHNldH0gZnJvbSBcInBhcnRpYWwubGVuc2VzXCJcblxuLy9cblxuY29uc3Qgd2FybmVkID0ge31cbmZ1bmN0aW9uIHdhcm4obWVzc2FnZSkge1xuICBpZiAoIShtZXNzYWdlIGluIHdhcm5lZCkpIHtcbiAgICB3YXJuZWRbbWVzc2FnZV0gPSBtZXNzYWdlXG4gICAgY29uc29sZS53YXJuKFwia2VmaXIuYXRvbTpcIiwgbWVzc2FnZSlcbiAgfVxufVxuXG4vL1xuXG5sZXQgbG9jayA9IDBcblxuY29uc3QgcHJldnMgPSBbXVxuY29uc3QgYXRvbXMgPSBbXVxuXG5mdW5jdGlvbiByZWxlYXNlKCkge1xuICB3aGlsZSAocHJldnMubGVuZ3RoKSB7XG4gICAgY29uc3QgcHJldiA9IHByZXZzLnNoaWZ0KClcbiAgICBjb25zdCBhdG9tID0gYXRvbXMuc2hpZnQoKVxuICAgIGNvbnN0IG5leHQgPSBhdG9tLl9jdXJyZW50RXZlbnQudmFsdWVcblxuICAgIGlmICghaWRlbnRpY2FsVShwcmV2LCBuZXh0KSlcbiAgICAgIGF0b20uX2VtaXRWYWx1ZShuZXh0KVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBob2xkaW5nKGVmKSB7XG4gICsrbG9ja1xuICB0cnkge1xuICAgIHJldHVybiBlZigpXG4gIH0gZmluYWxseSB7XG4gICAgaWYgKCEtLWxvY2spXG4gICAgICByZWxlYXNlKClcbiAgfVxufVxuXG4vL1xuXG5leHBvcnQgZnVuY3Rpb24gQWJzdHJhY3RNdXRhYmxlKCkge1xuICBQcm9wZXJ0eS5jYWxsKHRoaXMpXG59XG5cbmluaGVyaXQoQWJzdHJhY3RNdXRhYmxlLCBQcm9wZXJ0eSwge1xuICBzZXQodmFsdWUpIHtcbiAgICB0aGlzLm1vZGlmeSgoKSA9PiB2YWx1ZSlcbiAgfSxcbiAgcmVtb3ZlKCkge1xuICAgIHRoaXMuc2V0KClcbiAgfSxcbiAgbGVucyguLi5scykge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpXG4gICAgICB3YXJuKFwiVGhlIGBsZW5zYCBtZXRob2QgaGFzIGJlZW4gZGVwcmVjYXRlZC4gVXNlIHRoZSBgdmlld2AgbWV0aG9kIGluc3RlYWQuXCIpXG4gICAgcmV0dXJuIHRoaXMudmlldyguLi5scylcbiAgfSxcbiAgdmlldyguLi5scykge1xuICAgIHJldHVybiBuZXcgTGVuc2VkQXRvbSh0aGlzLCBjb21wb3NlKC4uLmxzKSlcbiAgfSxcbiAgX21heWJlRW1pdFZhbHVlKG5leHQpIHtcbiAgICBjb25zdCBwcmV2ID0gdGhpcy5fY3VycmVudEV2ZW50XG4gICAgaWYgKCFwcmV2IHx8ICFpZGVudGljYWxVKHByZXYudmFsdWUsIG5leHQpKVxuICAgICAgdGhpcy5fZW1pdFZhbHVlKG5leHQpXG4gIH1cbn0pXG5cbi8vXG5cbmV4cG9ydCBmdW5jdGlvbiBNdXRhYmxlV2l0aFNvdXJjZShzb3VyY2UpIHtcbiAgQWJzdHJhY3RNdXRhYmxlLmNhbGwodGhpcylcbiAgdGhpcy5fc291cmNlID0gc291cmNlXG4gIHRoaXMuXyRoYW5kbGVBbnkgPSBudWxsXG59XG5cbmluaGVyaXQoTXV0YWJsZVdpdGhTb3VyY2UsIEFic3RyYWN0TXV0YWJsZSwge1xuICBnZXQoKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIGlmIChjdXJyZW50ICYmICFsb2NrKVxuICAgICAgcmV0dXJuIGN1cnJlbnQudmFsdWVcbiAgICBlbHNlXG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RnJvbVNvdXJjZSgpXG4gIH0sXG4gIF9oYW5kbGVBbnkoKSB7XG4gICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUodGhpcy5fZ2V0RnJvbVNvdXJjZSgpKVxuICB9LFxuICBfb25BY3RpdmF0aW9uKCkge1xuICAgIGNvbnN0IGhhbmRsZUFueSA9ICgpID0+IHRoaXMuX2hhbmRsZUFueSgpXG4gICAgdGhpcy5fJGhhbmRsZUFueSA9IGhhbmRsZUFueVxuICAgIHRoaXMuX3NvdXJjZS5vbkFueShoYW5kbGVBbnkpXG4gIH0sXG4gIF9vbkRlYWN0aXZhdGlvbigpIHtcbiAgICB0aGlzLl9zb3VyY2Uub2ZmQW55KHRoaXMuXyRoYW5kbGVBbnkpXG4gICAgdGhpcy5fJGhhbmRsZUFueSA9IG51bGxcbiAgICB0aGlzLl9jdXJyZW50RXZlbnQgPSBudWxsXG4gIH1cbn0pXG5cbi8vXG5cbmV4cG9ydCBmdW5jdGlvbiBMZW5zZWRBdG9tKHNvdXJjZSwgbGVucykge1xuICBNdXRhYmxlV2l0aFNvdXJjZS5jYWxsKHRoaXMsIHNvdXJjZSlcbiAgdGhpcy5fbGVucyA9IGxlbnNcbn1cblxuaW5oZXJpdChMZW5zZWRBdG9tLCBNdXRhYmxlV2l0aFNvdXJjZSwge1xuICBzZXQodikge1xuICAgIHRoaXMuX3NvdXJjZS5zZXQoc2V0KHRoaXMuX2xlbnMsIHYsIHRoaXMuX3NvdXJjZS5nZXQoKSkpXG4gIH0sXG4gIG1vZGlmeShmbikge1xuICAgIHRoaXMuX3NvdXJjZS5tb2RpZnkobW9kaWZ5KHRoaXMuX2xlbnMsIGZuKSlcbiAgfSxcbiAgX2dldEZyb21Tb3VyY2UoKSB7XG4gICAgcmV0dXJuIGdldCh0aGlzLl9sZW5zLCB0aGlzLl9zb3VyY2UuZ2V0KCkpXG4gIH1cbn0pXG5cbi8vXG5cbmV4cG9ydCBmdW5jdGlvbiBBdG9tKCkge1xuICBBYnN0cmFjdE11dGFibGUuY2FsbCh0aGlzKVxuICBpZiAoYXJndW1lbnRzLmxlbmd0aClcbiAgICB0aGlzLl9lbWl0VmFsdWUoYXJndW1lbnRzWzBdKVxufVxuXG5pbmhlcml0KEF0b20sIEFic3RyYWN0TXV0YWJsZSwge1xuICBnZXQoKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIHJldHVybiBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZFxuICB9LFxuICBzZXQodikge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICB0aGlzLl9zZXRJbnRlcm5hbChjdXJyZW50LCBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZCwgdilcbiAgfSxcbiAgbW9kaWZ5KGZuKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIGNvbnN0IHByZXYgPSBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZFxuICAgIHRoaXMuX3NldEludGVybmFsKGN1cnJlbnQsIHByZXYsIGZuKHByZXYpKVxuICB9LFxuICBfc2V0SW50ZXJuYWwoY3VycmVudCwgcHJldiwgbmV4dCkge1xuICAgIGlmIChsb2NrKSB7XG4gICAgICBpZiAoIWF0b21zLmZpbmQoeCA9PiB4ID09PSB0aGlzKSkge1xuICAgICAgICBwcmV2cy5wdXNoKGN1cnJlbnQgPyBwcmV2IDogbWlzbWF0Y2gpXG4gICAgICAgIGF0b21zLnB1c2godGhpcylcbiAgICAgIH1cbiAgICAgIGlmIChjdXJyZW50KVxuICAgICAgICBjdXJyZW50LnZhbHVlID0gbmV4dFxuICAgICAgZWxzZVxuICAgICAgICB0aGlzLl9jdXJyZW50RXZlbnQgPSB7dHlwZTogXCJ2YWx1ZVwiLCB2YWx1ZTogbmV4dH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUobmV4dClcbiAgICB9XG4gIH1cbn0pXG5cbi8vXG5cbmZ1bmN0aW9uIGdldE11dGFibGVzKHRlbXBsYXRlLCBtdXRhYmxlcyA9IFtdKSB7XG4gIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIEFic3RyYWN0TXV0YWJsZSAmJlxuICAgICAgIW11dGFibGVzLmZpbmQobSA9PiBtID09PSB0ZW1wbGF0ZSkpIHtcbiAgICBtdXRhYmxlcy5wdXNoKHRlbXBsYXRlKVxuICB9IGVsc2Uge1xuICAgIGlmIChpc0FycmF5KHRlbXBsYXRlKSlcbiAgICAgIGZvciAobGV0IGk9MCwgbj10ZW1wbGF0ZS5sZW5ndGg7IGk8bjsgKytpKVxuICAgICAgICBnZXRNdXRhYmxlcyh0ZW1wbGF0ZVtpXSwgbXV0YWJsZXMpXG4gICAgZWxzZSBpZiAoaXNPYmplY3QodGVtcGxhdGUpKVxuICAgICAgZm9yIChjb25zdCBrIGluIHRlbXBsYXRlKVxuICAgICAgICBnZXRNdXRhYmxlcyh0ZW1wbGF0ZVtrXSwgbXV0YWJsZXMpXG4gIH1cbiAgcmV0dXJuIG11dGFibGVzXG59XG5cbmZ1bmN0aW9uIG1vbGVjdWxlKHRlbXBsYXRlKSB7XG4gIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIEFic3RyYWN0TXV0YWJsZSkge1xuICAgIHJldHVybiB0ZW1wbGF0ZS5nZXQoKVxuICB9IGVsc2Uge1xuICAgIGlmIChpc0FycmF5KHRlbXBsYXRlKSkge1xuICAgICAgY29uc3QgbiA9IHRlbXBsYXRlLmxlbmd0aFxuICAgICAgY29uc3QgbmV4dCA9IEFycmF5KG4pXG4gICAgICBmb3IgKGxldCBpPTA7IGk8bjsgKytpKVxuICAgICAgICBuZXh0W2ldID0gbW9sZWN1bGUodGVtcGxhdGVbaV0pXG4gICAgICByZXR1cm4gbmV4dFxuICAgIH0gZWxzZSBpZiAoaXNPYmplY3QodGVtcGxhdGUpKSB7XG4gICAgICBjb25zdCBuZXh0ID0ge31cbiAgICAgIGZvciAoY29uc3QgayBpbiB0ZW1wbGF0ZSlcbiAgICAgICAgbmV4dFtrXSA9IG1vbGVjdWxlKHRlbXBsYXRlW2tdKVxuICAgICAgcmV0dXJuIG5leHRcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRlbXBsYXRlXG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG1pc21hdGNoKCkge3Rocm93IG5ldyBFcnJvcihcIk1vbGVjdWxlIGNhbm5vdCBjaGFuZ2UgdGhlIHRlbXBsYXRlLlwiKX1cblxuZnVuY3Rpb24gc2V0TXV0YWJsZXModGVtcGxhdGUsIHZhbHVlKSB7XG4gIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIEFic3RyYWN0TXV0YWJsZSkge1xuICAgIHJldHVybiB0ZW1wbGF0ZS5zZXQodmFsdWUpXG4gIH0gZWxzZSB7XG4gICAgaWYgKGlzQXJyYXkodGVtcGxhdGUpICYmIGlzQXJyYXkodmFsdWUpKVxuICAgICAgZm9yIChsZXQgaT0wLCBuPXRlbXBsYXRlLmxlbmd0aDsgaTxuOyArK2kpXG4gICAgICAgIHNldE11dGFibGVzKHRlbXBsYXRlW2ldLCB2YWx1ZVtpXSlcbiAgICBlbHNlIGlmIChpc09iamVjdCh0ZW1wbGF0ZSkgJiYgaXNPYmplY3QodmFsdWUpKVxuICAgICAgZm9yIChjb25zdCBrIGluIHRlbXBsYXRlKVxuICAgICAgICBzZXRNdXRhYmxlcyh0ZW1wbGF0ZVtrXSwgdmFsdWVba10pXG4gICAgZWxzZSBpZiAoIWlkZW50aWNhbFUodGVtcGxhdGUsIHZhbHVlKSlcbiAgICAgIG1pc21hdGNoKClcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gTW9sZWN1bGUodGVtcGxhdGUpIHtcbiAgTXV0YWJsZVdpdGhTb3VyY2UuY2FsbCh0aGlzLCBjb21iaW5lKGdldE11dGFibGVzKHRlbXBsYXRlKSkpXG4gIHRoaXMuX3RlbXBsYXRlID0gdGVtcGxhdGVcbn1cblxuaW5oZXJpdChNb2xlY3VsZSwgTXV0YWJsZVdpdGhTb3VyY2UsIHtcbiAgX2dldEZyb21Tb3VyY2UoKSB7XG4gICAgcmV0dXJuIG1vbGVjdWxlKHRoaXMuX3RlbXBsYXRlKVxuICB9LFxuICBtb2RpZnkoZm4pIHtcbiAgICBjb25zdCBuZXh0ID0gZm4odGhpcy5nZXQoKSlcbiAgICBob2xkaW5nKCgpID0+IHNldE11dGFibGVzKHRoaXMuX3RlbXBsYXRlLCBuZXh0KSlcbiAgfVxufSlcblxuLy9cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYXRvbSgpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpXG4gICAgcmV0dXJuIG5ldyBBdG9tKGFyZ3VtZW50c1swXSlcbiAgZWxzZVxuICAgIHJldHVybiBuZXcgQXRvbSgpXG59XG4iXX0=
