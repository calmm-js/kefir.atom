import * as Kefir from "kefir"
import * as R     from "ramda"
import P, * as L  from "partial.lenses"

//

let lock = 0

const prevs = []
const atoms = []

const release = () => {
  while (prevs.length) {
    const prev = prevs.pop()
    const atom = atoms.pop()
    const next = atom._currentEvent.value

    if (!R.equals(prev, next))
      atom._emitValue(next)
  }
}

export const holding = ef => {
  ++lock
  try {
    return ef()
  } finally {
    if (!--lock)
      release()
  }
}

//

export class AbstractMutable extends Kefir.Property {
  set(value) {
    this.modify(() => value)
  }
  remove() {
    this.set()
  }
  lens(...ls) {
    return new LensedAtom(this, P(...ls))
  }
  view(...ls) {
    // We do not currently implement view() differently from lens(), because
    // such an implementation would not be faster/smaller.
    return this.lens(...ls)
  }
  _maybeEmitValue(next) {
    const prev = this._currentEvent
    if (!prev || !R.equals(prev.value, next))
      this._emitValue(next)
  }
}

//

export class MutableWithSource extends AbstractMutable {
  constructor(source) {
    super()
    this._source = source
    this._$handleValue = null
  }
  get() {
    const current = this._currentEvent
    if (current && !lock)
      return current.value
    else
      return this._getFromSource()
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

export class LensedAtom extends MutableWithSource {
  constructor(source, lens) {
    super(source)
    this._lens = lens
  }
  modify(fn) {
    this._source.modify(L.modify(this._lens, fn))
  }
  _getFromSource() {
    return L.get(this._lens, this._source.get())
  }
}

//

export class Atom extends AbstractMutable {
  constructor() {
    super()
    if (arguments.length)
      this._emitValue(arguments[0])
  }
  get() {
    const current = this._currentEvent
    return current ? current.value : undefined
  }
  modify(fn) {
    const current = this._currentEvent
    const prev = current ? current.value : undefined
    const next = fn(prev)
    if (lock) {
      if (!atoms.find(x => x === this)) {
        prevs.push(current ? prev : mismatch)
        atoms.push(this)
      }
      if (current)
        current.value = next
      else
        this._currentEvent = {type: "value", value: next}
    } else {
      this._maybeEmitValue(next)
    }
  }
}

//

const constructorOf = x => x && x.constructor

function getMutables(template, mutables = []) {
  if (template instanceof AbstractMutable &&
      !mutables.find(m => m === template)) {
    mutables.push(template)
  } else {
    const constructor = constructorOf(template)

    if (constructor === Array)
      for (let i=0, n=template.length; i<n; ++i)
        getMutables(template[i], mutables)
    else if (constructor === Object)
      for (const k in template)
        getMutables(template[k], mutables)
  }
  return mutables
}

function combine(template) {
  if (template instanceof AbstractMutable) {
    return template.get()
  } else {
    const constructor = constructorOf(template)

    if (constructor === Array) {
      const n = template.length
      const next = Array(n)
      for (let i=0; i<n; ++i)
        next[i] = combine(template[i])
      return next
    } else if (constructor === Object) {
      const next = {}
      for (const k in template)
        next[k] = combine(template[k])
      return next
    } else {
      return template
    }
  }
}

const mismatch = () => {throw new Error("Molecule cannot change the template.")}

function setMutables(template, value) {
  if (template instanceof AbstractMutable) {
    return template.set(value)
  } else {
    const constructor = constructorOf(template)

    if (constructor !== constructorOf(value))
      mismatch()

    if (constructor === Array)
      for (let i=0, n=template.length; i<n; ++i)
        setMutables(template[i], value[i])
    else if (constructor === Object)
      for (const k in template)
        setMutables(template[k], value[k])
    else if (!R.equals(template, value))
      mismatch()
  }
}

export class Molecule extends MutableWithSource {
  constructor(template) {
    super(Kefir.combine(getMutables(template)))
    this._template = template
  }
  _getFromSource() {
    return combine(this._template)
  }
  modify(fn) {
    const next = fn(this.get())
    holding(() => setMutables(this._template, next))
  }
}

//

export default (...value) => new Atom(...value)
