import Kefir from "kefir"
import L     from "partial.lenses"
import R     from "ramda"

//

export class AbstractMutable extends Kefir.Property {
  set(value) {
    this.modify(() => value)
  }
  lens(l, ...ls) {
    return new Lens(this, ls.length === 0 ? l : L(l, ...ls))
  }
  view(l, ...ls) {
    return this.lens(l, ...ls)
  }
}

//

export class Lens extends AbstractMutable {
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
    const next = L.view(this._lens, context)
    const prev = this._currentEvent
    if (!prev || !R.equals(prev.value, next))
      this._emitValue(next)
  }
  _onActivation() {
    const handleValue = value => this._handleValue(value)
    this._$handleValue = handleValue
    this._source.onValue(handleValue)
  }
  _onDeactivation() {
    this._source.offValue(this._$handleValue)
    this._$handleValue = null
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
    const value = fn(this.get())
    if (!R.equals(value, this.get()))
      this._emitValue(value)
  }
}

//

export default value => new Atom(value)
