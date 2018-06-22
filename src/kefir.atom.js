import * as I from 'infestines'
import * as K from 'kefir'
import * as L from 'partial.lenses'

//

const empty = K.constant(I.array0)

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

const isMutable = x => x instanceof AbstractMutable
const isObservable = x => x instanceof K.Observable

//

let lock = 0

const prevs = []
const atoms = []

function release() {
  while (prevs.length) {
    const prev = prevs.shift()
    const atom = atoms.shift()
    const next = atom._currentEvent.value

    if (!I.identicalU(prev, next)) atom._emitValue(next)
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
  if (!prev || !I.identicalU(prev.value, next)) self._emitValue(next)
}

export const AbstractMutable = I.inherit(
  function AbstractMutable() {
    K.Property.call(this)
  },
  K.Property,
  {
    set(value) {
      this.modify(I.always(value))
    },
    remove() {
      this.set()
    },
    view: (process.env.NODE_ENV === 'production'
      ? I.id
      : method =>
          function view(lens) {
            if (arguments.length !== 1)
              errorGiven(
                'The `view` method takes exactly 1 argument',
                arguments.length
              )
            return method.call(this, lens)
          })(function view(lens) {
      return new LensedAtom(this, lens)
    })
  }
)

//

export const MutableWithSource = I.inherit(
  (process.env.NODE_ENV === 'production'
    ? I.id
    : constructor =>
        function MutableWithSource(source) {
          if (!isObservable(source))
            errorGiven('Expected an Observable', source)
          constructor.call(this, source)
        })(function MutableWithSource(source) {
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

export const LensedAtom = I.inherit(
  function LensedAtom(source, lens) {
    MutableWithSource.call(this, source)
    this._lens = lens
  },
  MutableWithSource,
  {
    set(v) {
      this._source.set(L.set(this._lens, v, this._source.get()))
    },
    modify(fn) {
      this._source.modify(L.modify(this._lens, fn))
    },
    _getFromSource() {
      return L.get(this._lens, this._source.get())
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
    else self._currentEvent = {type: VALUE, value: next}
  } else {
    maybeEmitValue(self, next)
  }
}

export const Atom = I.inherit(
  function Atom() {
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

export const Join = I.inherit(
  (process.env.NODE_ENV === 'production'
    ? I.id
    : constructor =>
        function Join(sources) {
          if (!isObservable(sources))
            errorGiven('Expected an Observable', sources)
          constructor.call(this, sources)
        })(function Join(sources) {
    AbstractMutable.call(this)
    this._sources = sources
    this._source = this._$onSources = this._$onSource = void 0
  }),
  AbstractMutable,
  {
    get: (process.env.NODE_ENV === 'production'
      ? I.id
      : method =>
          function get() {
            if (!this._$onSource)
              warn(this.get, 'Join without subscription may not work correctly')
            return method.call(this)
          })(function get() {
      const source = this._source
      return source && source.get()
    }),
    modify: (process.env.NODE_ENV === 'production'
      ? I.id
      : method =>
          function modify(fn) {
            if (!this._$onSource)
              warn(
                this.modify,
                'Join without subscription may not work correctly'
              )
            return method.call(this, fn)
          })(function modify(fn) {
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
  if (isMutable(template) && mutables.indexOf(template) < 0) {
    mutables.push(template)
  } else {
    if (I.isArray(template))
      for (let i = 0, n = template.length; i < n; ++i)
        pushMutables(template[i], mutables)
    else if (I.isObject(template))
      for (const k in template) pushMutables(template[k], mutables)
  }
}

function molecule(template) {
  if (isMutable(template)) {
    return template.get()
  } else {
    if (I.isArray(template)) {
      const n = template.length
      let next = template
      for (let i = 0; i < n; ++i) {
        const v = molecule(template[i])
        if (!I.identicalU(next[i], v)) {
          if (next === template) next = template.slice(0)
          next[i] = v
        }
      }
      return next
    } else if (I.isObject(template)) {
      let next = template
      for (const k in template) {
        const v = molecule(template[k])
        if (!I.identicalU(next[k], v)) {
          if (next === template)
            next = I.assocPartialU(void 0, void 0, template) // Avoid Object.assign
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
  if (isMutable(template)) {
    template.set(value)
  } else {
    if (I.isArray(template) && I.isArray(value))
      for (let i = 0, n = template.length; i < n; ++i)
        setMutables(template[i], value[i])
    else if (I.isObject(template) && I.isObject(value))
      for (const k in template) setMutables(template[k], value[k])
    else if (!I.identicalU(template, value))
      error('Molecule cannot change the template.')
  }
}

export const Molecule = I.inherit(
  function Molecule(template) {
    const mutables = []
    pushMutables(template, mutables)
    MutableWithSource.call(this, mutables.length ? K.combine(mutables) : empty)
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

export function atom() {
  if (arguments.length) return new Atom(arguments[0])
  else return new Atom()
}

export default atom
