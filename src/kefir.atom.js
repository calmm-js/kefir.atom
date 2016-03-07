import Kefir from "kefir"
import L     from "partial.lenses"
import R     from "ramda"

//

export class AbstractMutable extends Kefir.Property {
  set(value) {
    this.modify(() => value)
  }
  lens(l, ...ls) {
    return new LensedAtom(this, ls.length === 0 ? l : L(l, ...ls))
  }
  view(l, ...ls) {
    return this.lens(l, ...ls)
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
    return L.view(this._lens, this._source.get())
  }
  modify(fn) {
    this._source.modify(L.over(this._lens, fn))
  }
  _handleValue(context) {
    this._maybeEmitValue(L.view(this._lens, context))
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
