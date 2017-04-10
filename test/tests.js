import * as Kefir from "kefir"
import * as L     from "partial.lenses"
import * as R     from "ramda"
import K          from "kefir.combines"

import Atom, {
  Join,
  Molecule,
  MutableWithSource,
  holding
} from "../dist/kefir.atom.cjs"

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

const objectConstant = {x: 1}

const run = expr =>
  eval(`(Atom, Kefir, K, L, R, Join, Molecule, MutableWithSource, holding, objectConstant) => ${expr}`)(
         Atom, Kefir, K, L, R, Join, Molecule, MutableWithSource, holding, objectConstant)

const testEq = (exprIn, expect) => {
  const expr = exprIn.replace(/[ \n]+/g, " ")
  return it(`${expr} => ${show(expect)}`, done => {
    const actual = run(expr)
    function check(actual) {
      if (!R.equals(actual, expect))
        throw new Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)
      done()
    }
    if (actual instanceof Kefir.Observable)
      actual.take(1).onValue(check)
    else
      check(actual)
  })
}

const testThrows = expr => it(`${expr} => throws`, () => {
  let raised
  let result
  try {
    result = run(expr)
    raised = false
  } catch (e) {
    result = e
    raised = true
  }
  if (!raised)
    throw new Error(`Expected ${expr} to throw, returned ${show(result)}`)
})

describe("Atom", () => {
  testEq(`{const x = Atom({x: 2}); x.view("x").modify(R.inc) ; return x.get()}`,
         {x:3})
  testEq(`{const xy = Atom({x: {y: 1}}); return xy.orAsync("test bug")}`,
         {x: {y: 1}})
  testEq(`{const xy = Atom({x: {y: 1}});
           xy.set({x: {y: 2}});
           return xy.get()}`,
         {x: {y: 2}})
})

describe("view", () => {
  testEq(`{const xy = Atom({x: 1, y: 2}); xy.view("x").remove(); return xy}`,
         {y: 2})
  testEq(`{const xy = Atom({x: {y: 1}}), y = xy.view("x"); return y.get()}`,
         {y: 1})
  testEq(`{const xy = Atom({x: {y: 1}}), y = xy.view("x");
           y.set({y: 3});
           return y}`,
         {y: 3})
  testEq(`{const xy = Atom({x: {y: 2}}), y = xy.view("x"), z = y.view("y");
           return z}`,
         2)
  testEq(`{const xy = Atom({x: {y: 3}}), z = xy.view(["x", "y"]);
           z.set(2);
           return z}`,
         2)
  testEq(`{const xy = Atom({x: {y: 3}}), z = xy.view(["x", "y"]);
           return z.get()}`,
         3)
})

describe("holding", () => {
  testEq(`{const a = Atom({x: 1}), b = a.view("x");
           let n = 0;
           const inc = () => ++n;
           a.onValue(inc);
           b.onValue(inc);
           holding(() => {a.set({x: 2}); b.set(1)});
           return n}`,
         3)
  testEq(`{const a = Atom({x: 1}), b = a.view("x");
           let n = 0;
           const inc = () => ++n;
           a.onValue(inc);
           b.onValue(inc);
           holding(() => {a.set({x: 2}); b.set(3)});
           return n}`,
         4)
  testEq(`{const a = Atom({x: 1}), b = a.view("x");
           return holding(() => {
             a.set({x: 2});
             return b.get()
           })}`,
         2)
  testEq(`{const a = Atom("a1"), b = Atom("b1");
           let r = ""; a.merge(b).onValue(x => r = r + x);
           holding(() => {a.set("a2"); b.set("b2")});
           return r}`,
         "a1b1a2b2")
})

describe("Molecule", () => {
  testEq(`new Molecule(42)`, 42)
  testEq(`new Molecule([101])`, [101])
  testEq(`{const x = new Molecule([{x: Atom(1)}, {y: 2}, Atom(3)]);
           return x}`,
         [{x: 1}, {y: 2}, 3])
  testEq(`{const x = Atom(1),
                 y = Atom(2),
                 xy = new Molecule({x, z: ["z"], y: [y]});
           xy.view(L.props("x", "y")).set({x: 3, y: [4]});
           return Kefir.combine([x, y, xy])}`,
         [3, 4, {x: 3, z: ["z"], y: [4]}])
  testEq(`{const x = Atom("x1"),
                 m = new Molecule([x, objectConstant]);
           x.set("x2");
           return m.get()[1] === objectConstant}`,
         true)
})

describe("variable", () => {
  testEq(`{const x = Atom(); return x.get()}`, undefined)
  testEq(`{const x = Atom(); return x.orAsync(1)}`, 1)
  testEq(`{const x = Atom(), y = x.view("lol"); return y.get()}`, undefined)
  testEq(`{const x = Atom(), y = x.view("lol"); return y.orAsync(1)}`, 1)
  testEq(`{const x = Atom(), y = new Molecule({x}); return y.get()}`,
         {x: undefined})
  testEq(`{const x = Atom(), y = new Molecule({x}); return x.orAsync(1)}`,
         1)
  testEq(`{const x = Atom(), y = x.view("y");
           let r = "initial";
           y.onValue(y => r = y);
           return r}`,
         "initial")
  testEq(`{const x = Atom(), y = x.view("y");
           let r = "initial";
           y.onValue(y => r = y);
           x.set({y: 1});
           return r}`,
         1)
  testEq(`{const x = Atom(), y = x.view("y");
           let r = "initial";
           y.onValue(y => r = y);
           holding(() => x.set({y: 1}));
           return r}`,
         1)
})

describe("Join", () => {
  testEq(`{const x = Atom(0),
                 m = new Join(Kefir.constant(x));
           m.onValue(() => {});
           m.set(-1);
           return m}`,
         -1)

  testEq(`new Join(Kefir.constant(Atom(101)))`, 101)

  testEq(`{const x = Atom(0),
                 y = Atom(1),
                 m = new Join(Kefir.combine([x, y], (a, b) => a < b ? y : x));
           m.onValue(() => {});
           return m}`,
         1)

  testEq(`{const x = Atom(0),
                 y = Atom(1),
                 m = new Join(Kefir.combine([x, y], (a, b) => a < b ? y : x));
           m.onValue(() => {});
           m.set(-1);
           return m}`,
         0)

  // Either of the two below will give a warning
  testEq(`{const x = new Join(Kefir.constant(Atom(101)));
           return x.get()}`,
         undefined)
  testEq(`{const x = new Join(Kefir.constant(Atom(101)));
           x.modify(x => -x);
           return x.get()}`,
         undefined)
})

if (process.env.NODE_ENV !== "production") describe("errors", () => {
  testThrows(`Atom(0).view(1, 2)`)
  testThrows(`new Molecule([]).set({})`)
  testThrows(`new MutableWithSource(1)`)
  testThrows(`new Join("non observable")`)
})
