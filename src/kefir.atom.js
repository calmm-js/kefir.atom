import {
  always,
  array0,
  assocPartialU,
  id,
  identicalU,
  inherit,
  isArray,
  isObject
} from 'infestines'
import { Observable, Property, combine, constant } from 'kefir'
import { get, modify, set } from 'partial.lenses'

//

const empty = /*#__PURE__*/ constant(array0)

const ERROR = 'error'
let VALUE
empty.onAny(e => (VALUE = VALUE || e.type))

const header = 'kefir.atom: '

function warn(f, m) {
  if (!f.warned) {
    f.warned = 1
    console.warn(header + m)
  }
}

function error(m) {
  throw new Error(header + m)
}

function errorGiven(m, o) {
  console.error(header + m + ' - given:', o)
  error(m)
}

//

let lock = 0

const prevs = []
const atoms = []

function release() {
  while (prevs.length) {
    const prev = prevs.shift()
    const atom = atoms.shift()
    const next = atom._currentEvent.value

    if (!identicalU(prev, next)) atom._emitValue(next)
  }
}

export function holding(ef) {
  ++lock
  try {
    return ef()
  } finally {
    if (!--lock) release()
  }
}

//

function maybeEmitValue(self, next) {
  const prev = self._currentEvent
  if (!prev || !identicalU(prev.value, next)) self._emitValue(next)
}

export const AbstractMutable = /*#__PURE__*/ inherit(
  function() {
    Property.call(this)
  },
  Property,
  {
    set(value) {
      this.modify(always(value))
    },
    remove() {
      this.set()
    },
    view: (process.env.NODE_ENV === 'production'
      ? id
      : method =>
          function(lens) {
            if (arguments.length !== 1)
              errorGiven(
                'The `view` method takes exactly 1 argument',
                arguments.length
              )
            return method.call(this, lens)
          })(function(lens) {
      return new LensedAtom(this, lens)
    })
  }
)

//

export const MutableWithSource = /*#__PURE__*/ inherit(
  (process.env.NODE_ENV === 'production'
    ? id
    : constructor =>
        function(source) {
          if (!(source instanceof Observable))
            errorGiven('Expected an Observable', source)
          constructor.call(this, source)
        })(function(source) {
    AbstractMutable.call(this)
    this._source = source
    this._$onAny = void 0
  }),
  AbstractMutable,
  {
    get() {
      const current = this._currentEvent
      if (current && !lock) return current.value
      else return this._getFromSource()
    },
    _onActivation() {
      this._source.onAny(
        (this._$onAny = e => {
          const t = e.type
          if (t === VALUE) maybeEmitValue(this, this._getFromSource())
          else if (t === ERROR) this._emitError(e.value)
          else {
            this._$onAny = void 0
            this._emitEnd()
          }
        })
      )
    },
    _onDeactivation() {
      const onAny = this._$onAny
      if (onAny) this._source.offAny(onAny)
      this._$onAny = void 0
    }
  }
)

//

export const LensedAtom = /*#__PURE__*/ inherit(
  function(source, lens) {
    MutableWithSource.call(this, source)
    this._lens = lens
  },
  MutableWithSource,
  {
    set(v) {
      this._source.set(set(this._lens, v, this._source.get()))
    },
    modify(fn) {
      this._source.modify(modify(this._lens, fn))
    },
    _getFromSource() {
      return get(this._lens, this._source.get())
    }
  }
)

//

function setAtom(self, current, prev, next) {
  if (lock) {
    if (atoms.indexOf(self) < 0) {
      prevs.push(current ? prev : error /* <- just needs to be unique */)
      atoms.push(self)
    }
    if (current) current.value = next
    else self._currentEvent = { type: VALUE, value: next }
  } else {
    maybeEmitValue(self, next)
  }
}

export const Atom = /*#__PURE__*/ inherit(
  function() {
    AbstractMutable.call(this)
    if (arguments.length) this._emitValue(arguments[0])
  },
  AbstractMutable,
  {
    get() {
      const current = this._currentEvent
      return current ? current.value : void 0
    },
    set(v) {
      const current = this._currentEvent
      setAtom(this, current, current ? current.value : void 0, v)
    },
    modify(fn) {
      const current = this._currentEvent
      const prev = current ? current.value : void 0
      setAtom(this, current, prev, fn(prev))
    }
  }
)

//

function maybeUnsubSource(self) {
  const onSource = self._$onSource
  if (onSource) self._source.offAny(onSource)
  self._source = self._$onSource = void 0
}

export const Join = /*#__PURE__*/ inherit(
  (process.env.NODE_ENV === 'production'
    ? id
    : constructor =>
        function(sources) {
          if (!(sources instanceof Observable))
            errorGiven('Expected an Observable', sources)
          constructor.call(this, sources)
        })(function(sources) {
    AbstractMutable.call(this)
    this._sources = sources
    this._source = this._$onSources = this._$onSource = void 0
  }),
  AbstractMutable,
  {
    get: (process.env.NODE_ENV === 'production'
      ? id
      : method =>
          function() {
            if (!this._$onSource)
              warn(this.get, 'Join without subscription may not work correctly')
            return method.call(this)
          })(function() {
      const source = this._source
      return source && source.get()
    }),
    modify: (process.env.NODE_ENV === 'production'
      ? id
      : method =>
          function(fn) {
            if (!this._$onSource)
              warn(
                this.modify,
                'Join without subscription may not work correctly'
              )
            return method.call(this, fn)
          })(function(fn) {
      const source = this._source
      source && source.modify(fn)
    }),
    _onActivation() {
      const sources = this._sources
      sources &&
        sources.onAny(
          (this._$onSources = e => {
            const t = e.type
            if (t === VALUE) {
              maybeUnsubSource(this)
              ;(this._source = e.value).onAny(
                (this._$onSource = e => {
                  const t = e.type
                  if (t === VALUE) maybeEmitValue(this, this._source.get())
                  else if (t === ERROR) this._emitError(e.value)
                  else this._emitEnd()
                })
              )
            } else if (t === ERROR) this._emitError(e.value)
            else this._$onSources = void 0
          })
        )
    },
    _onDeactivation() {
      maybeUnsubSource(this)
      const onSources = this._$onSources
      if (onSources) this._sources.offAny(onSources)
      this._$onSources = void 0
    }
  }
)

//

function pushMutables(template, mutables) {
  if (template instanceof AbstractMutable && mutables.indexOf(template) < 0) {
    mutables.push(template)
  } else {
    if (isArray(template))
      for (let i = 0, n = template.length; i < n; ++i)
        pushMutables(template[i], mutables)
    else if (isObject(template))
      for (const k in template) pushMutables(template[k], mutables)
  }
}

function molecule(template) {
  if (template instanceof AbstractMutable) {
    return template.get()
  } else {
    if (isArray(template)) {
      const n = template.length
      let next = template
      for (let i = 0; i < n; ++i) {
        const v = molecule(template[i])
        if (!identicalU(next[i], v)) {
          if (next === template) next = template.slice(0)
          next[i] = v
        }
      }
      return next
    } else if (isObject(template)) {
      let next = template
      for (const k in template) {
        const v = molecule(template[k])
        if (!identicalU(next[k], v)) {
          if (next === template) next = assocPartialU(void 0, void 0, template) // Avoid Object.assign
          next[k] = v
        }
      }
      return next
    } else {
      return template
    }
  }
}

function setMutables(template, value) {
  if (template instanceof AbstractMutable) {
    template.set(value)
  } else {
    if (isArray(template) && isArray(value))
      for (let i = 0, n = template.length; i < n; ++i)
        setMutables(template[i], value[i])
    else if (isObject(template) && isObject(value))
      for (const k in template) setMutables(template[k], value[k])
    else if (!identicalU(template, value))
      error('Molecule cannot change the template.')
  }
}

export const Molecule = /*#__PURE__*/ inherit(
  function(template) {
    const mutables = []
    pushMutables(template, mutables)
    MutableWithSource.call(this, mutables.length ? combine(mutables) : empty)
    this._template = template
  },
  MutableWithSource,
  {
    _getFromSource() {
      return molecule(this._template)
    },
    modify(fn) {
      const next = fn(this.get())
      holding(() => setMutables(this._template, next))
    }
  }
)

//

export default function atom() {
  if (arguments.length) return new Atom(arguments[0])
  else return new Atom()
}
