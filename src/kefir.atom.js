import {always, identicalU, inherit, isArray, isObject} from "infestines"
import {Property, combine} from "kefir"
import {get, modify, set} from "partial.lenses"

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

export function AbstractMutable() {
  Property.call(this)
}

inherit(AbstractMutable, Property, {
  set(value) {
    this.modify(always(value))
  },
  remove() {
    this.set()
  },
  view(lens) {
    if (process.env.NODE_ENV !== "production" && arguments.length !== 1)
      throw new Error("kefir.atom: The `view` method takes exactly 1 argument.")
    return new LensedAtom(this, lens)
  },
  _maybeEmitValue(next) {
    const prev = this._currentEvent
    if (!prev || !identicalU(prev.value, next))
      this._emitValue(next)
  }
})

//

export function MutableWithSource(source) {
  AbstractMutable.call(this)
  this._source = source
  this._$onAny = null
}

inherit(MutableWithSource, AbstractMutable, {
  get() {
    const current = this._currentEvent
    if (current && !lock)
      return current.value
    else
      return this._getFromSource()
  },
  _onAny() {
    this._maybeEmitValue(this._getFromSource())
  },
  _onActivation() {
    const onAny = () => this._onAny()
    this._$onAny = onAny
    this._source.onAny(onAny)
  },
  _onDeactivation() {
    this._source.offAny(this._$onAny)
    this._$onAny = null
    this._currentEvent = null
  }
})

//

export function LensedAtom(source, lens) {
  MutableWithSource.call(this, source)
  this._lens = lens
}

inherit(LensedAtom, MutableWithSource, {
  set(v) {
    this._source.set(set(this._lens, v, this._source.get()))
  },
  modify(fn) {
    this._source.modify(modify(this._lens, fn))
  },
  _getFromSource() {
    return get(this._lens, this._source.get())
  }
})

//

export function Atom() {
  AbstractMutable.call(this)
  if (arguments.length)
    this._emitValue(arguments[0])
}

inherit(Atom, AbstractMutable, {
  get() {
    const current = this._currentEvent
    return current ? current.value : undefined
  },
  set(v) {
    const current = this._currentEvent
    this._set(current, current ? current.value : undefined, v)
  },
  modify(fn) {
    const current = this._currentEvent
    const prev = current ? current.value : undefined
    this._set(current, prev, fn(prev))
  },
  _set(current, prev, next) {
    if (lock) {
      if (atoms.indexOf(this) < 0) {
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
})

//

function pushMutables(template, mutables) {
  if (template instanceof AbstractMutable &&
      mutables.indexOf(template) < 0) {
    mutables.push(template)
  } else {
    if (isArray(template))
      for (let i=0, n=template.length; i<n; ++i)
        pushMutables(template[i], mutables)
    else if (isObject(template))
      for (const k in template)
        pushMutables(template[k], mutables)
  }
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

export function Molecule(template) {
  const mutables = []
  pushMutables(template, mutables)
  MutableWithSource.call(this, combine(mutables))
  this._template = template
}

inherit(Molecule, MutableWithSource, {
  _getFromSource() {
    return molecule(this._template)
  },
  modify(fn) {
    const next = fn(this.get())
    holding(() => setMutables(this._template, next))
  }
})

//

export default function atom() {
  if (arguments.length)
    return new Atom(arguments[0])
  else
    return new Atom()
}
