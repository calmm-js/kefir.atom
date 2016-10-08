import * as Kefir from "kefir"
import * as R     from "ramda"
import P, * as L  from "partial.lenses"

//

export class AbstractMutable extends Kefir.Property {
  set(value) {
    this.modify(() => value)
  }
  lens(...ls) {
    return new LensedAtom(this, P(...ls))
  }
  view(...ls) {
    return new LensedAtom(this, P(...ls))
  }
  _maybeEmitValue(next) {
    const prev = this._currentEvent
    if (!prev || !R.equals(prev.value, next))
      this._emitValue(next)
  }
}

//

export class LensedAtom extends AbstractMutable {
  constructor(source, lens) {
    super()
    this._source = source
    this._lens = lens
    this._$handleValue = null
  }
  get() {
    if (this._currentEvent)
      return this._currentEvent.value
    else
      return this._getFromSource()
  }
  modify(fn) {
    this._source.modify(L.modify(this._lens, fn))
  }
  _getFromSource() {
    return L.get(this._lens, this._source.get())
  }
  _handleValue() {
    this._maybeEmitValue(this._getFromSource())
  }
  _onActivation() {
    const handleValue = value => this._handleValue(value)
    this._$handleValue = handleValue
    this._source.onValue(handleValue)
  }
  _onDeactivation() {
    this._source.offValue(this._$handleValue)
    this._$handleValue = null
    this._currentEvent = null
  }
}

//

export class Atom extends AbstractMutable {
  constructor(value) {
    super()
    this._emitValue(value)
  }
  get() {
    return this._currentEvent.value
  }
  modify(fn) {
    this._maybeEmitValue(fn(this.get()))
  }
}

//

export default value => new Atom(value)
