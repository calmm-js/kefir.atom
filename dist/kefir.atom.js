(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.kefir || (g.kefir = {})).atom = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Molecule = exports.Atom = exports.LensedAtom = exports.MutableWithSource = exports.AbstractMutable = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.holding = holding;
exports.default = atom;

var _infestines = require("infestines");

var _kefir = require("kefir");

var _partial = require("partial.lenses");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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
      if ("dev" !== "production") warn("The `lens` method has been deprecated. Use the `view` method instead.");
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

function atom() {
  if (arguments.length) return new Atom(arguments[0]);else return new Atom();
}

},{"infestines":undefined,"kefir":undefined,"partial.lenses":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMva2VmaXIuYXRvbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7OztRQ2dDZ0IsTyxHQUFBLE87a0JBOExRLEk7O0FBOU54Qjs7QUFDQTs7QUFDQTs7Ozs7Ozs7QUFFQTs7QUFFQSxJQUFNLFNBQVMsRUFBZjtBQUNBLFNBQVMsSUFBVCxDQUFjLE9BQWQsRUFBdUI7QUFDckIsTUFBSSxFQUFFLFdBQVcsTUFBYixDQUFKLEVBQTBCO0FBQ3hCLFdBQU8sT0FBUCxJQUFrQixPQUFsQjtBQUNBLFlBQVEsSUFBUixDQUFhLGFBQWIsRUFBNEIsT0FBNUI7QUFDRDtBQUNGOztBQUVEOztBQUVBLElBQUksT0FBTyxDQUFYOztBQUVBLElBQU0sUUFBUSxFQUFkO0FBQ0EsSUFBTSxRQUFRLEVBQWQ7O0FBRUEsU0FBUyxPQUFULEdBQW1CO0FBQ2pCLFNBQU8sTUFBTSxNQUFiLEVBQXFCO0FBQ25CLFFBQU0sT0FBTyxNQUFNLEtBQU4sRUFBYjtBQUNBLFFBQU0sUUFBTyxNQUFNLEtBQU4sRUFBYjtBQUNBLFFBQU0sT0FBTyxNQUFLLGFBQUwsQ0FBbUIsS0FBaEM7O0FBRUEsUUFBSSxDQUFDLDRCQUFXLElBQVgsRUFBaUIsSUFBakIsQ0FBTCxFQUNFLE1BQUssVUFBTCxDQUFnQixJQUFoQjtBQUNIO0FBQ0Y7O0FBRU0sU0FBUyxPQUFULENBQWlCLEVBQWpCLEVBQXFCO0FBQzFCLElBQUUsSUFBRjtBQUNBLE1BQUk7QUFDRixXQUFPLElBQVA7QUFDRCxHQUZELFNBRVU7QUFDUixRQUFJLENBQUMsR0FBRSxJQUFQLEVBQ0U7QUFDSDtBQUNGOztBQUVEOztJQUVhLGUsV0FBQSxlOzs7Ozs7Ozs7Ozt3QkFDUCxLLEVBQU87QUFDVCxXQUFLLE1BQUwsQ0FBWTtBQUFBLGVBQU0sS0FBTjtBQUFBLE9BQVo7QUFDRDs7OzZCQUNRO0FBQ1AsV0FBSyxHQUFMO0FBQ0Q7OzsyQkFDVztB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RyxNQUdBLElBQUksQ0FBQyw0QkFBVyxRQUFYLEVBQXFCLEtBQXJCLENBQUwsRUFDSDtBQUNIO0FBQ0Y7O0lBRVksUSxXQUFBLFE7OztBQUNYLG9CQUFZLFFBQVosRUFBc0I7QUFBQTs7QUFBQSxxSEFDZCxvQkFBUSxZQUFZLFFBQVosQ0FBUixDQURjOztBQUVwQixXQUFLLFNBQUwsR0FBaUIsUUFBakI7QUFGb0I7QUFHckI7Ozs7cUNBQ2dCO0FBQ2YsYUFBTyxTQUFTLEtBQUssU0FBZCxDQUFQO0FBQ0Q7OzsyQkFDTSxFLEVBQUk7QUFBQTs7QUFDVCxVQUFNLE9BQU8sR0FBRyxLQUFLLEdBQUwsRUFBSCxDQUFiO0FBQ0EsY0FBUTtBQUFBLGVBQU0sWUFBWSxPQUFLLFNBQWpCLEVBQTRCLElBQTVCLENBQU47QUFBQSxPQUFSO0FBQ0Q7Ozs7RUFYMkIsaUI7O0FBYzlCOztBQUVlLFNBQVMsSUFBVCxHQUFnQjtBQUM3QixNQUFJLFVBQVUsTUFBZCxFQUNFLE9BQU8sSUFBSSxJQUFKLENBQVMsVUFBVSxDQUFWLENBQVQsQ0FBUCxDQURGLEtBR0UsT0FBTyxJQUFJLElBQUosRUFBUDtBQUNIIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImltcG9ydCB7aWRlbnRpY2FsVSwgaXNBcnJheSwgaXNPYmplY3R9IGZyb20gXCJpbmZlc3RpbmVzXCJcbmltcG9ydCB7UHJvcGVydHksIGNvbWJpbmV9IGZyb20gXCJrZWZpclwiXG5pbXBvcnQge2NvbXBvc2UsIGdldCwgbW9kaWZ5LCBzZXR9IGZyb20gXCJwYXJ0aWFsLmxlbnNlc1wiXG5cbi8vXG5cbmNvbnN0IHdhcm5lZCA9IHt9XG5mdW5jdGlvbiB3YXJuKG1lc3NhZ2UpIHtcbiAgaWYgKCEobWVzc2FnZSBpbiB3YXJuZWQpKSB7XG4gICAgd2FybmVkW21lc3NhZ2VdID0gbWVzc2FnZVxuICAgIGNvbnNvbGUud2FybihcImtlZmlyLmF0b206XCIsIG1lc3NhZ2UpXG4gIH1cbn1cblxuLy9cblxubGV0IGxvY2sgPSAwXG5cbmNvbnN0IHByZXZzID0gW11cbmNvbnN0IGF0b21zID0gW11cblxuZnVuY3Rpb24gcmVsZWFzZSgpIHtcbiAgd2hpbGUgKHByZXZzLmxlbmd0aCkge1xuICAgIGNvbnN0IHByZXYgPSBwcmV2cy5zaGlmdCgpXG4gICAgY29uc3QgYXRvbSA9IGF0b21zLnNoaWZ0KClcbiAgICBjb25zdCBuZXh0ID0gYXRvbS5fY3VycmVudEV2ZW50LnZhbHVlXG5cbiAgICBpZiAoIWlkZW50aWNhbFUocHJldiwgbmV4dCkpXG4gICAgICBhdG9tLl9lbWl0VmFsdWUobmV4dClcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaG9sZGluZyhlZikge1xuICArK2xvY2tcbiAgdHJ5IHtcbiAgICByZXR1cm4gZWYoKVxuICB9IGZpbmFsbHkge1xuICAgIGlmICghLS1sb2NrKVxuICAgICAgcmVsZWFzZSgpXG4gIH1cbn1cblxuLy9cblxuZXhwb3J0IGNsYXNzIEFic3RyYWN0TXV0YWJsZSBleHRlbmRzIFByb3BlcnR5IHtcbiAgc2V0KHZhbHVlKSB7XG4gICAgdGhpcy5tb2RpZnkoKCkgPT4gdmFsdWUpXG4gIH1cbiAgcmVtb3ZlKCkge1xuICAgIHRoaXMuc2V0KClcbiAgfVxuICBsZW5zKC4uLmxzKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSBcInByb2R1Y3Rpb25cIilcbiAgICAgIHdhcm4oXCJUaGUgYGxlbnNgIG1ldGhvZCBoYXMgYmVlbiBkZXByZWNhdGVkLiBVc2UgdGhlIGB2aWV3YCBtZXRob2QgaW5zdGVhZC5cIilcbiAgICByZXR1cm4gdGhpcy52aWV3KC4uLmxzKVxuICB9XG4gIHZpZXcoLi4ubHMpIHtcbiAgICByZXR1cm4gbmV3IExlbnNlZEF0b20odGhpcywgY29tcG9zZSguLi5scykpXG4gIH1cbiAgX21heWJlRW1pdFZhbHVlKG5leHQpIHtcbiAgICBjb25zdCBwcmV2ID0gdGhpcy5fY3VycmVudEV2ZW50XG4gICAgaWYgKCFwcmV2IHx8ICFpZGVudGljYWxVKHByZXYudmFsdWUsIG5leHQpKVxuICAgICAgdGhpcy5fZW1pdFZhbHVlKG5leHQpXG4gIH1cbn1cblxuLy9cblxuZXhwb3J0IGNsYXNzIE11dGFibGVXaXRoU291cmNlIGV4dGVuZHMgQWJzdHJhY3RNdXRhYmxlIHtcbiAgY29uc3RydWN0b3Ioc291cmNlKSB7XG4gICAgc3VwZXIoKVxuICAgIHRoaXMuX3NvdXJjZSA9IHNvdXJjZVxuICAgIHRoaXMuXyRoYW5kbGVBbnkgPSBudWxsXG4gIH1cbiAgZ2V0KCkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBpZiAoY3VycmVudCAmJiAhbG9jaylcbiAgICAgIHJldHVybiBjdXJyZW50LnZhbHVlXG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHRoaXMuX2dldEZyb21Tb3VyY2UoKVxuICB9XG4gIF9oYW5kbGVBbnkoKSB7XG4gICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUodGhpcy5fZ2V0RnJvbVNvdXJjZSgpKVxuICB9XG4gIF9vbkFjdGl2YXRpb24oKSB7XG4gICAgY29uc3QgaGFuZGxlQW55ID0gKCkgPT4gdGhpcy5faGFuZGxlQW55KClcbiAgICB0aGlzLl8kaGFuZGxlQW55ID0gaGFuZGxlQW55XG4gICAgdGhpcy5fc291cmNlLm9uQW55KGhhbmRsZUFueSlcbiAgfVxuICBfb25EZWFjdGl2YXRpb24oKSB7XG4gICAgdGhpcy5fc291cmNlLm9mZkFueSh0aGlzLl8kaGFuZGxlQW55KVxuICAgIHRoaXMuXyRoYW5kbGVBbnkgPSBudWxsXG4gICAgdGhpcy5fY3VycmVudEV2ZW50ID0gbnVsbFxuICB9XG59XG5cbi8vXG5cbmV4cG9ydCBjbGFzcyBMZW5zZWRBdG9tIGV4dGVuZHMgTXV0YWJsZVdpdGhTb3VyY2Uge1xuICBjb25zdHJ1Y3Rvcihzb3VyY2UsIGxlbnMpIHtcbiAgICBzdXBlcihzb3VyY2UpXG4gICAgdGhpcy5fbGVucyA9IGxlbnNcbiAgfVxuICBzZXQodikge1xuICAgIHRoaXMuX3NvdXJjZS5zZXQoc2V0KHRoaXMuX2xlbnMsIHYsIHRoaXMuX3NvdXJjZS5nZXQoKSkpXG4gIH1cbiAgbW9kaWZ5KGZuKSB7XG4gICAgdGhpcy5fc291cmNlLm1vZGlmeShtb2RpZnkodGhpcy5fbGVucywgZm4pKVxuICB9XG4gIF9nZXRGcm9tU291cmNlKCkge1xuICAgIHJldHVybiBnZXQodGhpcy5fbGVucywgdGhpcy5fc291cmNlLmdldCgpKVxuICB9XG59XG5cbi8vXG5cbmV4cG9ydCBjbGFzcyBBdG9tIGV4dGVuZHMgQWJzdHJhY3RNdXRhYmxlIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKVxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKVxuICAgICAgdGhpcy5fZW1pdFZhbHVlKGFyZ3VtZW50c1swXSlcbiAgfVxuICBnZXQoKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIHJldHVybiBjdXJyZW50ID8gY3VycmVudC52YWx1ZSA6IHVuZGVmaW5lZFxuICB9XG4gIHNldCh2KSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRFdmVudFxuICAgIHRoaXMuX3NldEludGVybmFsKGN1cnJlbnQsIGN1cnJlbnQgPyBjdXJyZW50LnZhbHVlIDogdW5kZWZpbmVkLCB2KVxuICB9XG4gIG1vZGlmeShmbikge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50RXZlbnRcbiAgICBjb25zdCBwcmV2ID0gY3VycmVudCA/IGN1cnJlbnQudmFsdWUgOiB1bmRlZmluZWRcbiAgICB0aGlzLl9zZXRJbnRlcm5hbChjdXJyZW50LCBwcmV2LCBmbihwcmV2KSlcbiAgfVxuICBfc2V0SW50ZXJuYWwoY3VycmVudCwgcHJldiwgbmV4dCkge1xuICAgIGlmIChsb2NrKSB7XG4gICAgICBpZiAoIWF0b21zLmZpbmQoeCA9PiB4ID09PSB0aGlzKSkge1xuICAgICAgICBwcmV2cy5wdXNoKGN1cnJlbnQgPyBwcmV2IDogbWlzbWF0Y2gpXG4gICAgICAgIGF0b21zLnB1c2godGhpcylcbiAgICAgIH1cbiAgICAgIGlmIChjdXJyZW50KVxuICAgICAgICBjdXJyZW50LnZhbHVlID0gbmV4dFxuICAgICAgZWxzZVxuICAgICAgICB0aGlzLl9jdXJyZW50RXZlbnQgPSB7dHlwZTogXCJ2YWx1ZVwiLCB2YWx1ZTogbmV4dH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbWF5YmVFbWl0VmFsdWUobmV4dClcbiAgICB9XG4gIH1cbn1cblxuLy9cblxuZnVuY3Rpb24gZ2V0TXV0YWJsZXModGVtcGxhdGUsIG11dGFibGVzID0gW10pIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlICYmXG4gICAgICAhbXV0YWJsZXMuZmluZChtID0+IG0gPT09IHRlbXBsYXRlKSkge1xuICAgIG11dGFibGVzLnB1c2godGVtcGxhdGUpXG4gIH0gZWxzZSB7XG4gICAgaWYgKGlzQXJyYXkodGVtcGxhdGUpKVxuICAgICAgZm9yIChsZXQgaT0wLCBuPXRlbXBsYXRlLmxlbmd0aDsgaTxuOyArK2kpXG4gICAgICAgIGdldE11dGFibGVzKHRlbXBsYXRlW2ldLCBtdXRhYmxlcylcbiAgICBlbHNlIGlmIChpc09iamVjdCh0ZW1wbGF0ZSkpXG4gICAgICBmb3IgKGNvbnN0IGsgaW4gdGVtcGxhdGUpXG4gICAgICAgIGdldE11dGFibGVzKHRlbXBsYXRlW2tdLCBtdXRhYmxlcylcbiAgfVxuICByZXR1cm4gbXV0YWJsZXNcbn1cblxuZnVuY3Rpb24gbW9sZWN1bGUodGVtcGxhdGUpIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlKSB7XG4gICAgcmV0dXJuIHRlbXBsYXRlLmdldCgpXG4gIH0gZWxzZSB7XG4gICAgaWYgKGlzQXJyYXkodGVtcGxhdGUpKSB7XG4gICAgICBjb25zdCBuID0gdGVtcGxhdGUubGVuZ3RoXG4gICAgICBjb25zdCBuZXh0ID0gQXJyYXkobilcbiAgICAgIGZvciAobGV0IGk9MDsgaTxuOyArK2kpXG4gICAgICAgIG5leHRbaV0gPSBtb2xlY3VsZSh0ZW1wbGF0ZVtpXSlcbiAgICAgIHJldHVybiBuZXh0XG4gICAgfSBlbHNlIGlmIChpc09iamVjdCh0ZW1wbGF0ZSkpIHtcbiAgICAgIGNvbnN0IG5leHQgPSB7fVxuICAgICAgZm9yIChjb25zdCBrIGluIHRlbXBsYXRlKVxuICAgICAgICBuZXh0W2tdID0gbW9sZWN1bGUodGVtcGxhdGVba10pXG4gICAgICByZXR1cm4gbmV4dFxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGVtcGxhdGVcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbWlzbWF0Y2goKSB7dGhyb3cgbmV3IEVycm9yKFwiTW9sZWN1bGUgY2Fubm90IGNoYW5nZSB0aGUgdGVtcGxhdGUuXCIpfVxuXG5mdW5jdGlvbiBzZXRNdXRhYmxlcyh0ZW1wbGF0ZSwgdmFsdWUpIHtcbiAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RNdXRhYmxlKSB7XG4gICAgcmV0dXJuIHRlbXBsYXRlLnNldCh2YWx1ZSlcbiAgfSBlbHNlIHtcbiAgICBpZiAoaXNBcnJheSh0ZW1wbGF0ZSkgJiYgaXNBcnJheSh2YWx1ZSkpXG4gICAgICBmb3IgKGxldCBpPTAsIG49dGVtcGxhdGUubGVuZ3RoOyBpPG47ICsraSlcbiAgICAgICAgc2V0TXV0YWJsZXModGVtcGxhdGVbaV0sIHZhbHVlW2ldKVxuICAgIGVsc2UgaWYgKGlzT2JqZWN0KHRlbXBsYXRlKSAmJiBpc09iamVjdCh2YWx1ZSkpXG4gICAgICBmb3IgKGNvbnN0IGsgaW4gdGVtcGxhdGUpXG4gICAgICAgIHNldE11dGFibGVzKHRlbXBsYXRlW2tdLCB2YWx1ZVtrXSlcbiAgICBlbHNlIGlmICghaWRlbnRpY2FsVSh0ZW1wbGF0ZSwgdmFsdWUpKVxuICAgICAgbWlzbWF0Y2goKVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNb2xlY3VsZSBleHRlbmRzIE11dGFibGVXaXRoU291cmNlIHtcbiAgY29uc3RydWN0b3IodGVtcGxhdGUpIHtcbiAgICBzdXBlcihjb21iaW5lKGdldE11dGFibGVzKHRlbXBsYXRlKSkpXG4gICAgdGhpcy5fdGVtcGxhdGUgPSB0ZW1wbGF0ZVxuICB9XG4gIF9nZXRGcm9tU291cmNlKCkge1xuICAgIHJldHVybiBtb2xlY3VsZSh0aGlzLl90ZW1wbGF0ZSlcbiAgfVxuICBtb2RpZnkoZm4pIHtcbiAgICBjb25zdCBuZXh0ID0gZm4odGhpcy5nZXQoKSlcbiAgICBob2xkaW5nKCgpID0+IHNldE11dGFibGVzKHRoaXMuX3RlbXBsYXRlLCBuZXh0KSlcbiAgfVxufVxuXG4vL1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhdG9tKCkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aClcbiAgICByZXR1cm4gbmV3IEF0b20oYXJndW1lbnRzWzBdKVxuICBlbHNlXG4gICAgcmV0dXJuIG5ldyBBdG9tKClcbn1cbiJdfQ==
