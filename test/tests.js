import * as Kefir from 'kefir'
import * as L from 'partial.lenses'
import * as R from 'ramda'

import {
  atom,
  Join,
  Molecule,
  MutableWithSource,
  holding
} from '../dist/kefir.atom.cjs'

function show(x) {
  switch (typeof x) {
    case 'string':
    case 'object':
      return JSON.stringify(x)
    default:
      return `${x}`
  }
}

Kefir.Observable.prototype.orAsync = function(y) {
  return this.merge(Kefir.later(0, y))
}

const objectConstant = {x: 1}

const toExpr = f =>
  f
    .toString()
    .replace(/\s+/g, ' ')
    .replace(/^\s*function\s*\(\s*\)\s*{\s*(return\s*)?/g, '')
    .replace(/\s*;?\s*}\s*$/g, '')
    .replace(/function\s*(\([a-zA-Z0-9, ]*\))\s*/g, '$1 => ')
    .replace(/\(([a-z]+)\)\s*=>/g, '$1 =>')
    .replace(/{\s*return\s*([^{;]+)\s*;\s*}/g, '$1')
    .replace(/\(0, [^.]*[.]([^)]*)\)/g, '$1')
    .replace(/_kefirAtom[.]/g, '')

const testEq = (expect, thunk) => {
  return it(`${toExpr(thunk)} => ${show(expect)}`, done => {
    const actual = thunk()
    function check(actual) {
      if (!R.equals(actual, expect))
        throw new Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)
      done()
    }
    if (actual instanceof Kefir.Observable) actual.take(1).onValue(check)
    else check(actual)
  })
}

const testThrows = thunk =>
  it(`${toExpr(thunk)} => throws`, () => {
    let raised
    let result
    try {
      result = thunk()
      raised = false
    } catch (e) {
      result = e
      raised = true
    }
    if (!raised)
      throw new Error(
        `Expected ${toExpr(thunk)} to throw, returned ${show(result)}`
      )
  })

describe('Atom', () => {
  testEq({x: 3}, () => {
    const x = atom({x: 2})
    x.view('x').modify(R.inc)
    return x.get()
  })
  testEq({x: {y: 1}}, () => {
    const xy = atom({x: {y: 1}})
    return xy.orAsync('test bug')
  })
  testEq({x: {y: 2}}, () => {
    const xy = atom({x: {y: 1}})
    xy.set({x: {y: 2}})
    return xy.get()
  })
})

describe('view', () => {
  testEq({y: 2}, () => {
    const xy = atom({x: 1, y: 2})
    xy.view('x').remove()
    return xy
  })
  testEq({y: 1}, () => {
    const xy = atom({x: {y: 1}})
    const y = xy.view('x')
    return y.get()
  })
  testEq({y: 3}, () => {
    const xy = atom({x: {y: 1}})
    const y = xy.view('x')
    y.set({y: 3})
    return y
  })
  testEq(2, () => {
    const xy = atom({x: {y: 2}})
    const y = xy.view('x')
    const z = y.view('y')
    return z
  })
  testEq(2, () => {
    const xy = atom({x: {y: 3}})
    const z = xy.view(['x', 'y'])
    z.set(2)
    return z
  })
  testEq(3, () => {
    const xy = atom({x: {y: 3}})
    const z = xy.view(['x', 'y'])
    return z.get()
  })
})

describe('holding', () => {
  testEq(3, () => {
    const a = atom({x: 1})
    const b = a.view('x')
    let n = 0
    const inc = () => ++n
    a.onValue(inc)
    b.onValue(inc)
    holding(() => {
      a.set({x: 2})
      b.set(1)
    })
    return n
  })
  testEq(4, () => {
    const a = atom({x: 1})
    const b = a.view('x')
    let n = 0
    const inc = () => ++n
    a.onValue(inc)
    b.onValue(inc)
    holding(() => {
      a.set({x: 2})
      b.set(3)
    })
    return n
  })
  testEq(2, () => {
    const a = atom({x: 1})
    const b = a.view('x')
    return holding(() => {
      a.set({x: 2})
      return b.get()
    })
  })
  testEq('a1b1a2b2', () => {
    const a = atom('a1')
    const b = atom('b1')
    let r = ''
    a.merge(b).onValue(x => (r = r + x))
    holding(() => {
      a.set('a2')
      b.set('b2')
    })
    return r
  })
})

describe('Molecule', () => {
  testEq(42, () => new Molecule(42))
  testEq([101], () => new Molecule([101]))
  testEq([{x: 1}, {y: 2}, 3], () => {
    const x = new Molecule([{x: atom(1)}, {y: 2}, atom(3)])
    return x
  })
  testEq([3, 4, {x: 3, z: ['z'], y: [4]}], () => {
    const x = atom(1)
    const y = atom(2)
    const xy = new Molecule({x, z: ['z'], y: [y]})
    xy.view(L.props('x', 'y')).set({x: 3, y: [4]})
    return Kefir.combine([x, y, xy])
  })
  testEq(true, () => {
    const x = atom('x1')
    const m = new Molecule([x, objectConstant])
    x.set('x2')
    return m.get()[1] === objectConstant
  })
})

describe('variable', () => {
  testEq(undefined, () => {
    const x = atom()
    return x.get()
  })
  testEq(1, () => {
    const x = atom()
    return x.orAsync(1)
  })
  testEq(undefined, () => {
    const x = atom()
    const y = x.view('lol')
    return y.get()
  })
  testEq(1, () => {
    const x = atom()
    const y = x.view('lol')
    return y.orAsync(1)
  })
  testEq({x: undefined}, () => {
    const x = atom()
    const y = new Molecule({x})
    return y.get()
  })
  testEq(1, () => {
    const x = atom()
    new Molecule({x})
    return x.orAsync(1)
  })
  testEq('initial', () => {
    const x = atom()
    const y = x.view('y')
    let r = 'initial'
    y.onValue(y => (r = y))
    return r
  })
  testEq(1, () => {
    const x = atom()
    const y = x.view('y')
    let r = 'initial'
    y.onValue(y => (r = y))
    x.set({y: 1})
    return r
  })
  testEq(1, () => {
    const x = atom()
    const y = x.view('y')
    let r = 'initial'
    y.onValue(y => (r = y))
    holding(() => x.set({y: 1}))
    return r
  })
})

describe('Join', () => {
  testEq(-1, () => {
    const x = atom(0)
    const m = new Join(Kefir.constant(x))
    m.onValue(() => {})
    m.set(-1)
    return m
  })

  testEq(101, () => new Join(Kefir.constant(atom(101))))

  testEq(1, () => {
    const x = atom(0)
    const y = atom(1)
    const m = new Join(Kefir.combine([x, y], (a, b) => (a < b ? y : x)))
    m.onValue(() => {})
    return m
  })

  testEq(0, () => {
    const x = atom(0)
    const y = atom(1)
    const m = new Join(Kefir.combine([x, y], (a, b) => (a < b ? y : x)))
    m.onValue(() => {})
    m.set(-1)
    return m
  })

  // Either of the two below will give a warning
  testEq(undefined, () => {
    const x = new Join(Kefir.constant(atom(101)))
    return x.get()
  })
  testEq(undefined, () => {
    const x = new Join(Kefir.constant(atom(101)))
    x.modify(x => -x)
    return x.get()
  })
})

if (process.env.NODE_ENV !== 'production')
  describe('errors', () => {
    testThrows(() => atom(0).view(1, 2))
    testThrows(() => new Molecule([]).set({}))
    testThrows(() => new MutableWithSource(1))
    testThrows(() => new Join('non observable'))
  })
