import {identicalU, isArray, isObject} from "infestines"
import {Property, combine} from "kefir"
import {compose, get, modify, set} from "partial.lenses"

//

const warn = process.env.NODE_ENV === "production" ? () => {} : (() => {
  const warned = {}

  return message => {
    if (!(message in warned)) {
      warned[message] = message
      console.warn("kefir.atom:", message)
    }
  }
})()

//

let lock = 0

const prevs = []
const atoms = []

function release() {
  while (prevs.length) {
    const prev = prevs.shift()
    const atom = atoms.shift()
    const next = atom._currentEvent.value

    if (!identicalU(prev, next))
      atom._emitValue(next)
  }
}

export function holding(ef) {
  ++lock
  try {
    return ef()
  } finally {
    if (!--lock)
      release()
  }
}

//

export class AbstractMutable extends Property {
  set(value) {
    this.modify(() => value)
  }
  remove() {
    this.set()
  }
  lens(...ls) {
    warn("The `lens` method has been deprecated. Use the `view` method instead.")
    return this.view(...ls)
  }
  view(...ls) {
    return new LensedAtom(this, compose(...ls))
  }
  _maybeEmitValue(next) {
    const prev = this._currentEvent
    if (!prev || !identicalU(prev.value, next))
      this._emitValue(next)
  }
}

//

export class MutableWithSource extends AbstractMutable {
  constructor(source) {
    super()
    this._source = source
    this._$handleAny = null
  }
  get() {
    const current = this._currentEvent
    if (current && !lock)
      return current.value
    else
      return this._getFromSource()
  }
  _handleAny() {
    this._maybeEmitValue(this._getFromSource())
  }
  _onActivation() {
    const handleAny = () => this._handleAny()
    this._$handleAny = handleAny
    this._source.onAny(handleAny)
  }
  _onDeactivation() {
    this._source.offAny(this._$handleAny)
    this._$handleAny = null
    this._currentEvent = null
  }
}

//

export class LensedAtom extends MutableWithSource {
  constructor(source, lens) {
    super(source)
    this._lens = lens
  }
  set(v) {
    this._source.set(set(this._lens, v, this._source.get()))
  }
  modify(fn) {
    this._source.modify(modify(this._lens, fn))
  }
  _getFromSource() {
    return get(this._lens, this._source.get())
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
  set(v) {
    const current = this._currentEvent
    this._setInternal(current, current ? current.value : undefined, v)
  }
  modify(fn) {
    const current = this._currentEvent
    const prev = current ? current.value : undefined
    this._setInternal(current, prev, fn(prev))
  }
  _setInternal(current, prev, next) {
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

function getMutables(template, mutables = []) {
  if (template instanceof AbstractMutable &&
      !mutables.find(m => m === template)) {
    mutables.push(template)
  } else {
    if (isArray(template))
      for (let i=0, n=template.length; i<n; ++i)
        getMutables(template[i], mutables)
    else if (isObject(template))
      for (const k in template)
        getMutables(template[k], mutables)
  }
  return mutables
}

function molecule(template) {
  if (template instanceof AbstractMutable) {
    return template.get()
  } else {
    if (isArray(template)) {
      const n = template.length
      const next = Array(n)
      for (let i=0; i<n; ++i)
        next[i] = molecule(template[i])
      return next
    } else if (isObject(template)) {
      const next = {}
      for (const k in template)
        next[k] = molecule(template[k])
      return next
    } else {
      return template
    }
  }
}

function mismatch() {throw new Error("Molecule cannot change the template.")}

function setMutables(template, value) {
  if (template instanceof AbstractMutable) {
    return template.set(value)
  } else {
    if (isArray(template) && isArray(value))
      for (let i=0, n=template.length; i<n; ++i)
        setMutables(template[i], value[i])
    else if (isObject(template) && isObject(value))
      for (const k in template)
        setMutables(template[k], value[k])
    else if (!identicalU(template, value))
      mismatch()
  }
}

export class Molecule extends MutableWithSource {
  constructor(template) {
    super(combine(getMutables(template)))
    this._template = template
  }
  _getFromSource() {
    return molecule(this._template)
  }
  modify(fn) {
    const next = fn(this.get())
    holding(() => setMutables(this._template, next))
  }
}

//

export default (...value) => new Atom(...value)
