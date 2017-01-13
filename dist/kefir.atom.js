(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.kefir || (g.kefir = {})).atom = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Molecule = exports.Atom = exports.LensedAtom = exports.MutableWithSource = exports.AbstractMutable = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.holding = holding;

var _infestines = require("infestines");

var _kefir = require("kefir");

var _partial = require("partial.lenses");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

//

var warn = "dev" === "production" ? function () {} : function () {
  var warned = {};

  return function (message) {
    if (!(message in warned)) {
      warned[message] = message;
      console.warn("kefir.atom:", message);
    }
  };
}();

//

var lock = 0;

var prevs = [];
var atoms = [];

function release() {
  while (prevs.length) {
    var prev = prevs.shift();
    var atom = atoms.shift();
    var next = atom._currentEvent.value;

    if (!(0, _infestines.identicalU)(prev, next)) atom._emitValue(next);
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

var AbstractMutable = exports.AbstractMutable = function (_Property) {
  _inherits(AbstractMutable, _Property);

  function AbstractMutable() {
    _classCallCheck(this, AbstractMutable);

    return _possibleConstructorReturn(this, (AbstractMutable.__proto__ || Object.getPrototypeOf(AbstractMutable)).apply(this, arguments));
  }

  _createClass(AbstractMutable, [{
    key: "set",
    value: function set(value) {
      this.modify(function () {
        return value;
      });
    }
  }, {
    key: "remove",
    value: function remove() {
      this.set();
    }
  }, {
    key: "lens",
    value: function lens() {
      warn("The `lens` method has been deprecated. Use the `view` method instead.");
      return this.view.apply(this, arguments);
    }
  }, {
    key: "view",
    value: function view() {
      return new LensedAtom(this, _partial.compose.apply(undefined, arguments));
    }
  }, {
    key: "_maybeEmitValue",
    value: function _maybeEmitValue(next) {
      var prev = this._currentEvent;
      if (!prev || !(0, _infestines.identicalU)(prev.value, next)) this._emitValue(next);
    }
  }]);

  return AbstractMutable;
}(_kefir.Property);

//

var MutableWithSource = exports.MutableWithSource = function (_AbstractMutable) {
  _inherits(MutableWithSource, _AbstractMutable);

  function MutableWithSource(source) {
    _classCallCheck(this, MutableWithSource);

    var _this2 = _possibleConstructorReturn(this, (MutableWithSource.__proto__ || Object.getPrototypeOf(MutableWithSource)).call(this));

    _this2._source = source;
    _this2._$handleAny = null;
    return _this2;
  }

  _createClass(MutableWithSource, [{
    key: "get",
    value: function get() {
      var current = this._currentEvent;
      if (current && !lock) return current.value;else return this._getFromSource();
    }
  }, {
    key: "_handleAny",
    value: function _handleAny() {
      this._maybeEmitValue(this._getFromSource());
    }
  }, {
    key: "_onActivation",
    value: function _onActivation() {
      var _this3 = this;

      var handleAny = function handleAny() {
        return _this3._handleAny();
      };
      this._$handleAny = handleAny;
      this._source.onAny(handleAny);
    }
  }, {
    key: "_onDeactivation",
    value: function _onDeactivation() {
      this._source.offAny(this._$handleAny);
      this._$handleAny = null;
      this._currentEvent = null;
    }
  }]);

  return MutableWithSource;
}(AbstractMutable);

//

var LensedAtom = exports.LensedAtom = function (_MutableWithSource) {
  _inherits(LensedAtom, _MutableWithSource);

  function LensedAtom(source, lens) {
    _classCallCheck(this, LensedAtom);

    var _this4 = _possibleConstructorReturn(this, (LensedAtom.__proto__ || Object.getPrototypeOf(LensedAtom)).call(this, source));

    _this4._lens = lens;
    return _this4;
  }

  _createClass(LensedAtom, [{
    key: "set",
    value: function set(v) {
      this._source.set((0, _partial.set)(this._lens, v, this._source.get()));
    }
  }, {
    key: "modify",
    value: function modify(fn) {
      this._source.modify((0, _partial.modify)(this._lens, fn));
    }
  }, {
    key: "_getFromSource",
    value: function _getFromSource() {
      return (0, _partial.get)(this._lens, this._source.get());
    }
  }]);

  return LensedAtom;
}(MutableWithSource);

//

var Atom = exports.Atom = function (_AbstractMutable2) {
  _inherits(Atom, _AbstractMutable2);

  function Atom() {
    _classCallCheck(this, Atom);

    var _this5 = _possibleConstructorReturn(this, (Atom.__proto__ || Object.getPrototypeOf(Atom)).call(this));

    if (arguments.length) _this5._emitValue(arguments[0]);
    return _this5;
  }

  _createClass(Atom, [{
    key: "get",
    value: function get() {
      var current = this._currentEvent;
      return current ? current.value : undefined;
    }
  }, {
    key: "set",
    value: function set(v) {
      var current = this._currentEvent;
      this._setInternal(current, current ? current.value : undefined, v);
    }
  }, {
    key: "modify",
    value: function modify(fn) {
      var current = this._currentEvent;
      var prev = current ? current.value : undefined;
      this._setInternal(current, prev, fn(prev));
    }
  }, {
    key: "_setInternal",
    value: function _setInternal(current, prev, next) {
      var _this6 = this;

      if (lock) {
        if (!atoms.find(function (x) {
          return x === _this6;
        })) {
          prevs.push(current ? prev : mismatch);
          atoms.push(this);
        }
        if (current) current.value = next;else this._currentEvent = { type: "value", value: next };
      } else {
        this._maybeEmitValue(next);
      }
    }
  }]);

  return Atom;
}(AbstractMutable);

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

var Molecule = exports.Molecule = function (_MutableWithSource2) {
  _inherits(Molecule, _MutableWithSource2);

  function Molecule(template) {
    _classCallCheck(this, Molecule);

    var _this7 = _possibleConstructorReturn(this, (Molecule.__proto__ || Object.getPrototypeOf(Molecule)).call(this, (0, _kefir.combine)(getMutables(template))));

    _this7._template = template;
    return _this7;
  }

  _createClass(Molecule, [{
    key: "_getFromSource",
    value: function _getFromSource() {
      return molecule(this._template);
    }
  }, {
    key: "modify",
    value: function modify(fn) {
      var _this8 = this;

      var next = fn(this.get());
      holding(function () {
        return setMutables(_this8._template, next);
      });
    }
  }]);

  return Molecule;
}(MutableWithSource);

//

exports.default = function () {
  for (var _len = arguments.length, value = Array(_len), _key = 0; _key < _len; _key++) {
    value[_key] = arguments[_key];
  }

  return new (Function.prototype.bind.apply(Atom, [null].concat(value)))();
};

},{"infestines":undefined,"kefir":undefined,"partial.lenses":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMva2VmaXIuYXRvbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7OztRQ21DZ0IsTyxHQUFBLE87O0FBbkNoQjs7QUFDQTs7QUFDQTs7Ozs7Ozs7QUFFQTs7QUFFQSxJQUFNLE9BQU8sUUFBUSxHQUFSLENBQVksUUFBWixLQUF5QixZQUF6QixHQUF3QyxZQUFNLENBQUUsQ0FBaEQsR0FBb0QsWUFBTTtBQUNyRSxNQUFNLFNBQVMsRUFBZjs7QUFFQSxTQUFPLG1CQUFXO0FBQ2hCLFFBQUksRUFBRSxXQUFXLE1BQWIsQ0FBSixFQUEwQjtBQUN4QixhQUFPLE9BQVAsSUFBa0IsT0FBbEI7QUFDQSxjQUFRLElBQVIsQ0FBYSxhQUFiLEVBQTRCLE9BQTVCO0FBQ0Q7QUFDRixHQUxEO0FBTUQsQ0FUK0QsRUFBaEU7O0FBV0E7O0FBRUEsSUFBSSxPQUFPLENBQVg7O0FBRUEsSUFBTSxRQUFRLEVBQWQ7QUFDQSxJQUFNLFFBQVEsRUFBZDs7QUFFQSxTQUFTLE9BQVQsR0FBbUI7QUFDakIsU0FBTyxNQUFNLE1BQWIsRUFBcUI7QUFDbkIsUUFBTSxPQUFPLE1BQU0sS0FBTixFQUFiO0FBQ0EsUUFBTSxPQUFPLE1BQU0sS0FBTixFQUFiO0FBQ0EsUUFBTSxPQUFPLEtBQUssYUFBTCxDQUFtQixLQUFoQzs7QUFFQSxRQUFJLENBQUMsNEJBQVcsSUFBWCxFQUFpQixJQUFqQixDQUFMLEVBQ0UsS0FBSyxVQUFMLENBQWdCLElBQWhCO0FBQ0g7QUFDRjs7QUFFTSxTQUFTLE9BQVQsQ0FBaUIsRUFBakIsRUFBcUI7QUFDMUIsSUFBRSxJQUFGO0FBQ0EsTUFBSTtBQUNGLFdBQU8sSUFBUDtBQUNELEdBRkQsU0FFVTtBQUNSLFFBQUksQ0FBQyxHQUFFLElBQVAsRUFDRTtBQUNIO0FBQ0Y7O0FBRUQ7O0lBRWEsZSxXQUFBLGU7Ozs7Ozs7Ozs7O3dCQUNQLEssRUFBTztBQUNULFdB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QVQsQ0FBWixFQUF5QixNQUFNLENBQU4sQ0FBekI7QUFERixLQURHLE1BR0EsSUFBSSxDQUFDLDRCQUFXLFFBQVgsRUFBcUIsS0FBckIsQ0FBTCxFQUNIO0FBQ0g7QUFDRjs7SUFFWSxRLFdBQUEsUTs7O0FBQ1gsb0JBQVksUUFBWixFQUFzQjtBQUFBOztBQUFBLHFIQUNkLG9CQUFRLFlBQVksUUFBWixDQUFSLENBRGM7O0FBRXBCLFdBQUssU0FBTCxHQUFpQixRQUFqQjtBQUZvQjtBQUdyQjs7OztxQ0FDZ0I7QUFDZixhQUFPLFNBQVMsS0FBSyxTQUFkLENBQVA7QUFDRDs7OzJCQUNNLEUsRUFBSTtBQUFBOztBQUNULFVBQU0sT0FBTyxHQUFHLEtBQUssR0FBTCxFQUFILENBQWI7QUFDQSxjQUFRO0FBQUEsZUFBTSxZQUFZLE9BQUssU0FBakIsRUFBNEIsSUFBNUIsQ0FBTjtBQUFBLE9BQVI7QUFDRDs7OztFQVgyQixpQjs7QUFjOUI7O2tCQUVlO0FBQUEsb0NBQUksS0FBSjtBQUFJLFNBQUo7QUFBQTs7QUFBQSw0Q0FBa0IsSUFBbEIsZ0JBQTBCLEtBQTFCO0FBQUEsQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJpbXBvcnQge2lkZW50aWNhbFUsIGlzQXJyYXksIGlzT2JqZWN0fSBmcm9tIFwiaW5mZXN0aW5lc1wiXG5pbXBvcnQge1Byb3BlcnR5LCBjb21iaW5lfSBmcm9tIFwia2VmaXJcIlxuaW1wb3J0IHtjb21wb3NlLCBnZXQsIG1vZGlmeSwgc2V0fSBmcm9tIFwicGFydGlhbC5sZW5zZXNcIlxuXG4vL1xuXG5jb25zdCB3YXJuID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiID8gKCkgPT4ge30gOiAoKCkgPT4ge1xuICBjb25zdCB3YXJuZWQgPSB7fVxuXG4gIHJldHVybiBtZXNzYWdlID0+IHtcbiAgICBpZiAoIShtZXNzYWdlIGluIHdhcm5lZCkpIHtcbiAgICAgIHdhcm5lZFttZXNzYWdlXSA9IG1lc3NhZ2VcbiAgICAgIGNvbnNvbGUud2FybihcImtlZmlyLmF0b206XCIsIG1lc3NhZ2UpXG4gICAgfVxuICB9XG59KSgpXG5cbi8vXG5cbmxldCBsb2NrID0gMFxuXG5jb25zdCBwcmV2cyA9IFtdXG5jb25zdCBhdG9tcyA9IFtdXG5cbmZ1bmN0aW9uIHJlbGVhc2UoKSB7XG4gIHdoaWxlIChwcmV2cy5sZW5ndGgpIHtcbiAgICBjb25zdCBwcmV2ID0gcHJldnMuc2hpZnQoKVxuICAgIGNvbnN0IGF0b20gPSBhdG9tcy5zaGlmdCgpXG4gICAgY29uc3QgbmV4dCA9IGF0b20uX2N1cnJlbnRFdmVudC52YWx1ZVxuXG4gICAgaWYgKCFpZGVudGljYWxVKHByZXYsIG5leHQpKVxuICAgICAgYXRvbS5fZW1pdFZhbHVlKG5leHQpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvbGRpbmcoZWYpIHtcbiAgKytsb2NrXG4gIHRyeSB7XG4gICAgcmV0dXJuIGVmKClcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoIS0tbG9jaylcbiAgICAgIHJlbGVhc2UoKVxuICB9XG59XG5cbi8vXG5cbmV4cG9ydCBjbGFzcyBBYnN0cmFjdE11dGFibGUgZXh0ZW5kcyBQcm9wZXJ0eSB7XG4gIHNldCh2YWx1ZSkge1xuICAgIHRoaXMubW9kaWZ5KCgpID0+IHZhbHVlKVxuICB9XG4gIHJlbW92ZSgpIHtcbiAgICB0aGlzLnNldCgpXG4gIH1cbiAgbGVucyguLi5scykge1xuICAgIHdhcm4oXCJUaGUgYGxlbnNgIG1ldGhvZCBoYXMgYmVlbiBkZXByZWNhdGVkLiBVc2UgdGhlIGB2aWV3YCBtZXRob2QgaW5zdGVhZC5cIilcbiAgICByZXR1cm4gdGhpcy52aWV3KC4uLmxzKVxuICB9XG4gIHZpZXcoLi4ubHMpIHtcbiAgICByZXR1cm4gbmV3IExlbnNlZEF0b20odGhpcywgY29tcG9zZSguLi5scykpXG4gIH1cbiAgX21heWJlRW1pdFZhbHVlKG5leHQpIHtcbiAgICBjb25zdCBwcmV2ID0gdGhpcy5fY3VycmVudEV2ZW50XG4gICAgaWYgKCFwcmV2IHx8ICFpZGVudGljYWxVKHByZXYudmFsdWUsIG5leHQpKVxuICAgICAgdGhpcy5fZW1pdFZhbHVlKG5leHQpXG4gIH1cbn1cblxuLy9cblxuZXhwb3J0IGNsYXNzIE11dGFibGVXaXRoU291cmNlIGV4dGVuZHMgQWJzdHJhY3RNdXRhYmxlIHtcbiAgY29uc3RydWN0b3Ioc291cmNlKSB7XG4gICAgc3VwZXIoKVxuICAgIHRoaXMuX3NvdXJjZSA9IHNvdXJjZVxuICAgIHRoaXMuXyRoYW5kbGVBbnkgPSBudWxsXG4gIH1cbiAgZ2V0KCkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBpZiAoY3VycmVudCAmJiAhbG9jaylcbiAgICAgIHJldHVybiBjdXJyZW50LnZhbHVlXG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHRoaXMuX2dldEZyb21Tb3VyY2UoKVxuICB9XG4gIF9oYW5kbGVBbnkoKSB7XG4gICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUodGhpcy5fZ2V0RnJvbVNvdXJjZSgpKVxuICB9XG4gIF9vbkFjdGl2YXRpb24oKSB7XG4gICAgY29uc3QgaGFuZGxlQW55ID0gKCkgPT4gdGhpcy5faGFuZGxlQW55KClcbiAgICB0aGlzLl8kaGFuZGxlQW55ID0gaGFuZGxlQW55XG4gICAgdGhpcy5fc291cmNlLm9uQW55KGhhbmRsZUFueSlcbiAgfVxuICBfb25EZWFjdGl2YXRpb24oKSB7XG4gICAgdGhpcy5fc291cmNlLm9mZkFueSh0aGlzLl8kaGFuZGxlQW55KVxuICAgIHRoaXMuXyRoYW5kbGVBbnkgPSBudWxsXG4gICAgdGhpcy5fY3VycmVudEV2ZW50ID0gbnVsbFxuICB9XG59XG5cbi8vXG5cbmV4cG9ydCBjbGFzcyBMZW5zZWRBdG9tIGV4dGVuZHMgTXV0YWJsZVdpdGhTb3VyY2Uge1xuICBjb25zdHJ1Y3Rvcihzb3VyY2UsIGxlbnMpIHtcbiAgICBzdXBlcihzb3VyY2UpXG4gICAgdGhpcy5fbGVucyA9IGxlbnNcbiAgfVxuICBzZXQodikge1xuICAgIHRoaXMuX3NvdXJjZS5zZXQoc2V0KHRoaXMuX2xlbnMsIHYsIHRoaXMuX3NvdXJjZS5nZXQoKSkpXG4gIH1cbiAgbW9kaWZ5KGZuKSB7XG4gICAgdGhpcy5fc291cmNlLm1vZGlmeShtb2RpZnkodGhpcy5fbGVucywgZm4pKVxuICB9XG4gIF9nZXRGcm9tU291cmNlKCkge1xuICAgIHJldHVybiBnZXQodGhpcy5fbGVucywgdGhpcy5fc291cmNlLmdldCgpKVxuICB9XG59XG5cbi8vXG5cbmV4cG9ydCBjbGFzcyBBdG9tIGV4dGVuZHMgQWJzdHJhY3RNdXRhYmxlIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKVxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKVxuICAgICAgdGhpcy5fZW1pdFZhbHVlKGFyZ3VtZW50c1swXSlcbiAgfVxuICBnZXQoKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIHJldHVybiBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZFxuICB9XG4gIHNldCh2KSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIHRoaXMuX3NldEludGVybmFsKGN1cnJlbnQsIGN1cnJlbnQgPyBjdXJyZW50LnZhbHVlIDogdW5kZWZpbmVkLCB2KVxuICB9XG4gIG1vZGlmeShmbikge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBjb25zdCBwcmV2ID0gY3VycmVudCA/IGN1cnJlbnQudmFsdWUgOiB1bmRlZmluZWRcbiAgICB0aGlzLl9zZXRJbnRlcm5hbChjdXJyZW50LCBwcmV2LCBmbihwcmV2KSlcbiAgfVxuICBfc2V0SW50ZXJuYWwoY3VycmVudCwgcHJldiwgbmV4dCkge1xuICAgIGlmIChsb2NrKSB7XG4gICAgICBpZiAoIWF0b21zLmZpbmQoeCA9PiB4ID09PSB0aGlzKSkge1xuICAgICAgICBwcmV2cy5wdXNoKGN1cnJlbnQgPyBwcmV2IDogbWlzbWF0Y2gpXG4gICAgICAgIGF0b21zLnB1c2godGhpcylcbiAgICAgIH1cbiAgICAgIGlmIChjdXJyZW50KVxuICAgICAgICBjdXJyZW50LnZhbHVlID0gbmV4dFxuICAgICAgZWxzZVxuICAgICAgICB0aGlzLl9jdXJyZW50RXZlbnQgPSB7dHlwZTogXCJ2YWx1ZVwiLCB2YWx1ZTogbmV4dH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUobmV4dClcbiAgICB9XG4gIH1cbn1cblxuLy9cblxuZnVuY3Rpb24gZ2V0TXV0YWJsZXModGVtcGxhdGUsIG11dGFibGVzID0gW10pIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlICYmXG4gICAgICAhbXV0YWJsZXMuZmluZChtID0+IG0gPT09IHRlbXBsYXRlKSkge1xuICAgIG11dGFibGVzLnB1c2godGVtcGxhdGUpXG4gIH0gZWxzZSB7XG4gICAgaWYgKGlzQXJyYXkodGVtcGxhdGUpKVxuICAgICAgZm9yIChsZXQgaT0wLCBuPXRlbXBsYXRlLmxlbmd0aDsgaTxuOyArK2kpXG4gICAgICAgIGdldE11dGFibGVzKHRlbXBsYXRlW2ldLCBtdXRhYmxlcylcbiAgICBlbHNlIGlmIChpc09iamVjdCh0ZW1wbGF0ZSkpXG4gICAgICBmb3IgKGNvbnN0IGsgaW4gdGVtcGxhdGUpXG4gICAgICAgIGdldE11dGFibGVzKHRlbXBsYXRlW2tdLCBtdXRhYmxlcylcbiAgfVxuICByZXR1cm4gbXV0YWJsZXNcbn1cblxuZnVuY3Rpb24gbW9sZWN1bGUodGVtcGxhdGUpIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlKSB7XG4gICAgcmV0dXJuIHRlbXBsYXRlLmdldCgpXG4gIH0gZWxzZSB7XG4gICAgaWYgKGlzQXJyYXkodGVtcGxhdGUpKSB7XG4gICAgICBjb25zdCBuID0gdGVtcGxhdGUubGVuZ3RoXG4gICAgICBjb25zdCBuZXh0ID0gQXJyYXkobilcbiAgICAgIGZvciAobGV0IGk9MDsgaTxuOyArK2kpXG4gICAgICAgIG5leHRbaV0gPSBtb2xlY3VsZSh0ZW1wbGF0ZVtpXSlcbiAgICAgIHJldHVybiBuZXh0XG4gICAgfSBlbHNlIGlmIChpc09iamVjdCh0ZW1wbGF0ZSkpIHtcbiAgICAgIGNvbnN0IG5leHQgPSB7fVxuICAgICAgZm9yIChjb25zdCBrIGluIHRlbXBsYXRlKVxuICAgICAgICBuZXh0W2tdID0gbW9sZWN1bGUodGVtcGxhdGVba10pXG4gICAgICByZXR1cm4gbmV4dFxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGVtcGxhdGVcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbWlzbWF0Y2goKSB7dGhyb3cgbmV3IEVycm9yKFwiTW9sZWN1bGUgY2Fubm90IGNoYW5nZSB0aGUgdGVtcGxhdGUuXCIpfVxuXG5mdW5jdGlvbiBzZXRNdXRhYmxlcyh0ZW1wbGF0ZSwgdmFsdWUpIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlKSB7XG4gICAgcmV0dXJuIHRlbXBsYXRlLnNldCh2YWx1ZSlcbiAgfSBlbHNlIHtcbiAgICBpZiAoaXNBcnJheSh0ZW1wbGF0ZSkgJiYgaXNBcnJheSh2YWx1ZSkpXG4gICAgICBmb3IgKGxldCBpPTAsIG49dGVtcGxhdGUubGVuZ3RoOyBpPG47ICsraSlcbiAgICAgICAgc2V0TXV0YWJsZXModGVtcGxhdGVbaV0sIHZhbHVlW2ldKVxuICAgIGVsc2UgaWYgKGlzT2JqZWN0KHRlbXBsYXRlKSAmJiBpc09iamVjdCh2YWx1ZSkpXG4gICAgICBmb3IgKGNvbnN0IGsgaW4gdGVtcGxhdGUpXG4gICAgICAgIHNldE11dGFibGVzKHRlbXBsYXRlW2tdLCB2YWx1ZVtrXSlcbiAgICBlbHNlIGlmICghaWRlbnRpY2FsVSh0ZW1wbGF0ZSwgdmFsdWUpKVxuICAgICAgbWlzbWF0Y2goKVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNb2xlY3VsZSBleHRlbmRzIE11dGFibGVXaXRoU291cmNlIHtcbiAgY29uc3RydWN0b3IodGVtcGxhdGUpIHtcbiAgICBzdXBlcihjb21iaW5lKGdldE11dGFibGVzKHRlbXBsYXRlKSkpXG4gICAgdGhpcy5fdGVtcGxhdGUgPSB0ZW1wbGF0ZVxuICB9XG4gIF9nZXRGcm9tU291cmNlKCkge1xuICAgIHJldHVybiBtb2xlY3VsZSh0aGlzLl90ZW1wbGF0ZSlcbiAgfVxuICBtb2RpZnkoZm4pIHtcbiAgICBjb25zdCBuZXh0ID0gZm4odGhpcy5nZXQoKSlcbiAgICBob2xkaW5nKCgpID0+IHNldE11dGFibGVzKHRoaXMuX3RlbXBsYXRlLCBuZXh0KSlcbiAgfVxufVxuXG4vL1xuXG5leHBvcnQgZGVmYXVsdCAoLi4udmFsdWUpID0+IG5ldyBBdG9tKC4uLnZhbHVlKVxuIl19
