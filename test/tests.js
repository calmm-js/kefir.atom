import * as Kefir from "kefir"
import * as R     from "ramda"
import * as L     from "partial.lenses"

import Atom, {Molecule, holding} from "../src/kefir.atom"

function show(x) {
  switch (typeof x) {
    case "string":
    case "object":
      return JSON.stringify(x)
    default:
      return `${x}`
  }
}

Kefir.Observable.prototype.orAsync = function (y) {
  return this.merge(Kefir.later(0, y))
}

const testEq = (expr, expect) => it(`${expr} => ${show(expect)}`, done => {
  const actual = eval(`(Atom, Kefir, L, R, Molecule, holding) => ${expr}`)(
                        Atom, Kefir, L, R, Molecule, holding)
  const check = actual => {
    if (!R.equals(actual, expect))
      throw new Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)
    done()
  }
  if (actual instanceof Kefir.Observable)
    actual.take(1).onValue(check)
  else
    check(actual)
})

describe("Atom", () => {
  testEq('{const xy = Atom({x: {y: 1}}); return xy.orAsync("test bug")}', {x: {y: 1}})
  testEq('{const xy = Atom({x: {y: 1}}); xy.set({x: {y: 2}}) ; return xy.get()}', {x: {y: 2}})
  testEq('{const xy = Atom({x: 1, y: 2}); xy.lens("x").remove(); return xy}', {y: 2})
  testEq('{const xy = Atom({x: {y: 1}}), y = xy.lens("x"); return y.get()}', {y: 1})
  testEq('{const xy = Atom({x: {y: 1}}), y = xy.lens("x"); y.set({y: 3}); return y}', {y: 3})
  testEq('{const xy = Atom({x: {y: 2}}), y = xy.lens("x"), z = y.lens("y"); return z}', 2)
  testEq('{const xy = Atom({x: {y: 3}}), z = xy.lens("x", "y"); z.set(2); return z}', 2)
  testEq('{const xy = Atom({x: {y: 3}}), z = xy.view("x", "y"); return z.get()}', 3)
})

describe("holding", () => {
  testEq('{const a = Atom({x: 1}), b = a.lens("x"); let n = 0; const inc = () => ++n; a.onValue(inc); b.onValue(inc); holding(() => {a.set({x: 2}); b.set(1)}); return n}', 2)
  testEq('{const a = Atom({x: 1}), b = a.lens("x"); let n = 0; const inc = () => ++n; a.onValue(inc); b.onValue(inc); holding(() => {a.set({x: 2}); b.set(3)}); return n}', 4)
  testEq('{const a = Atom({x: 1}), b = a.lens("x"); return holding(() => {a.set({x: 2}); return b.get()})}', 2)
})

describe("Molecule", () => {
  testEq('{const x = new Molecule([{x: Atom(1)}, {y: 2}, Atom(3)]); return x}', [{x: 1}, {y: 2}, 3])
  testEq('{const x = Atom(1), y = Atom(2), xy = new Molecule({x, z: ["z"], y: [y]}); xy.lens(L.props("x", "y")).set({x: 3, y: [4]}); return Kefir.combine([x, y, xy])}', [3, 4, {x: 3, z: ["z"], y: [4]}])
})

describe("variable", () => {
  testEq('{const x = Atom(); return x.get()}', undefined)
  testEq('{const x = Atom(); return x.orAsync(1)}', 1)
  testEq('{const x = Atom(), y = x.lens("lol"); return y.get()}', undefined)
  testEq('{const x = Atom(), y = x.lens("lol"); return y.orAsync(1)}', 1)
  testEq('{const x = Atom(), y = new Molecule({x}); return y.get()}', {x: undefined})
  testEq('{const x = Atom(), y = new Molecule({x}); return x.orAsync(1)}', 1)
  testEq('{const x = Atom(), y = x.lens("y"); let r = "initial"; y.onValue(y => r = y); return r}', "initial")
  testEq('{const x = Atom(), y = x.lens("y"); let r = "initial"; y.onValue(y => r = y); x.set({y: 1}); return r}', 1)
  testEq('{const x = Atom(), y = x.lens("y"); let r = "initial"; y.onValue(y => r = y); holding(() => x.set({y: 1})); return r}', 1)
})
