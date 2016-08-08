import * as Kefir from "kefir"
import * as R     from "ramda"
import Atom       from "../src/kefir.atom"

function show(x) {
  switch (typeof x) {
    case "string":
    case "object":
      return JSON.stringify(x)
    default:
      return `${x}`
  }
}

const testEq = (expr, expect) => it(`${expr} => ${show(expect)}`, done => {
  const actual = eval(`(Atom, Kefir, R) => ${expr}`)(Atom, Kefir, R)
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
  testEq('{const xy = Atom({x: {y: 1}}); return xy}', {x: {y: 1}})
  testEq('{const xy = Atom({x: {y: 1}}); xy.set({x: {y: 2}}) ; return xy.get()}', {x: {y: 2}})
  testEq('{const xy = Atom({x: {y: 1}}); const y = xy.lens("x"); return y.get()}', {y: 1})
  testEq('{const xy = Atom({x: {y: 1}}); const y = xy.lens("x"); y.set({y: 3}); return y}', {y: 3})
  testEq('{const xy = Atom({x: {y: 2}}); const y = xy.lens("x"); const z = y.lens("y"); return z}', 2)
  testEq('{const xy = Atom({x: {y: 3}}); const z = xy.lens("x", "y"); z.set(2); return z}', 2)
  testEq('{const xy = Atom({x: {y: 3}}); const z = xy.view("x", "y"); return z.get()}', 3)
})
