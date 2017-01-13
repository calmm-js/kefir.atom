[ [Contents](#contents) | [Motivation](#motivation) | [Tutorial](#tutorial) | [Reference](#reference) | [About](#about) ]

This library provides a family of [concepts](#concepts) and tools for
managing
[state](https://en.wikipedia.org/wiki/State_(computer_science)#Program_state)
with [lenses](https://github.com/calmm-js/partial.lenses)
and [Kefir](http://rpominov.github.io/kefir/).

[![npm version](https://badge.fury.io/js/kefir.atom.svg)](http://badge.fury.io/js/kefir.atom) [![Bower version](https://badge.fury.io/bo/kefir.atom.svg)](https://badge.fury.io/bo/kefir.atom) [![Build Status](https://travis-ci.org/calmm-js/kefir.atom.svg?branch=master)](https://travis-ci.org/calmm-js/kefir.atom) [![Code Coverage](https://img.shields.io/codecov/c/github/calmm-js/kefir.atom/master.svg)](https://codecov.io/github/calmm-js/kefir.atom?branch=master) [![](https://david-dm.org/calmm-js/kefir.atom.svg)](https://david-dm.org/calmm-js/kefir.atom) [![](https://david-dm.org/calmm-js/kefir.atom/dev-status.svg)](https://david-dm.org/calmm-js/kefir.atom?type=dev)

## Contents

* [Motivation](#motivation)
* [Tutorial](#tutorial)
  * [Counters are not toys!](#counters-are-not-toys)
  * [Component, remove thyself!](#component-remove-thyself)
  * [Lists are simple data structures](#lists-are-simple-data-structures)
  * [Items in a cart](#items-in-a-cart)
  * [Items to put into the cart](#items-to-put-into-the-cart)
  * [Putting it all together](#putting-it-all-together)
  * [Summary](#summary)
* [Reference](#reference)
  * [`Atom(value)`](#Atom "Atom :: a -> Atom a")
  * [`Atom()`](#Atom-empty "Atom :: () -> Atom a")
  * [`atom.get()`](#get "get :: AbstractMutable a -> a")
  * [`atom.modify(currentValue => newValue)`](#modify "modify :: AbstractMutable a -> (a -> a) -> ()")
  * [`atom.set(value)`](#set "set :: AbstractMutable a -> a -> ()")
  * [`atom.remove()`](#remove "remove :: AbstractMutable a -> ()")
  * [`atom.view(...ls)`](#view "view :: AbstractMutable a -> (...PLens a b) -> LensedAtom b")
  * [`holding(() => ...)`](#holding "holding :: (() -> a) -> a")
  * [Concepts](#concepts)
    * [`AbstractMutable a :> Property a`](#class-AbstractMutable)
    * [`Atom a :> AbstractMutable a`](#class-Atom)
    * [`LensedAtom a :> AbstractMutable a`](#class-LensedAtom)
    * [`Molecule t :> AbstractMutable (t where AbstractMutable x := x)`](#class-Molecule)
* [About](#about)
  * [Implementation trade-offs](#implementation-trade-offs)
  * [Related work](#related-work)

## Motivation

Use of state and mutation is often considered error-prone and rightly so.
Stateful concepts are *inherently difficult*, because, unlike stateless
concepts, they include the concept of time: *state changes over time*.  When
state changes, computations based on state, including copies of state, may
become invalid or inconsistent.

Using this library:

* You can **_store_** state in *first-class* objects
  called [Atom](#class-Atom)s.
  * *This means that program components can __declare__ the state they are
    interested in __as parameters__ and share state by passing references to
    state as arguments __without copying__ state.*

* You can declare **_decompose_**d *first-class* [view](#view)s of state
  using [lenses](https://github.com/calmm-js/partial.lenses) and **_compose_**d
  *first-class* views of state as [Molecule](#class-Molecule)s.
  * *This means that program components can __declare precisely__ the state they
    are interested in as parameters __independently of the storage__ of state.*

* You get **_consistent_** read-write access to state using [get](#get)
  and [modify](#modify) operations *at any point and through all views*.
  * *This means that by using views, both decomposed and composed, of state you
    can __avoid__ copying state and the __inconsistency problems__ associated
    with such copying.*

* You can declare arbitrary **_dependent computations_** using observable
  combinators from [Kefir](http://rpominov.github.io/kefir/)
  as [AbstractMutable](#class-AbstractMutable)s are also
  [Kefir](http://rpominov.github.io/kefir/) [properties](http://rpominov.github.io/kefir/#about-observables).
  * *This means that you can __declare computations__ dependent __upon state__
    __independently of time__ as such computation are kept consistent as state
    changes over time.*

* You can mutate state through multiple views and multiple
  atomic [modify](#modify) operations in a **_transaction_**al manner
  by [holding](#holding) event propagation from state changes.
  * *This means that you can __avoid__
    some
    [glitches and unnecessary computations](https://en.wikipedia.org/wiki/Reactive_programming#Glitches) of
    __intermediate states__.*

* You can **_avoid unnecessary recomputations_**, because program components can
  declare precisely the state they are interested in and views of state only
  propagate actual changes of state.
  * *This means that __algorithmic efficiency is a feature__ of this library
    rather than an afterthought requiring further innovation.*

The rest of this README contains a [tutorial](#tutorial) to managing state using
atoms and provides a [reference](#reference) manual for this library.

## Tutorial

Let's write the very beginnings of a Shopping Cart UI using atoms with
the [`karet`](https://github.com/calmm-js/karet) and via
the [`karet.util`](https://github.com/calmm-js/karet.util) libraries.

Karet is simple library that allows one to embed Kefir observables
into [React](https://facebook.github.io/react/) VDOM.  If this tutorial advances
at a too fast a pace, then you might want to read a
longer
[introduction](https://github.com/calmm-js/documentation/blob/master/introduction-to-calmm.md) to
the approach.

This example is actually a stripped down version of
the
[Karet Shopping Cart example](https://github.com/calmm-js/karet-shopping-cart).

See a live version [here](https://calmm-js.github.io/karet-shopping-cart/).

### Counters are not toys!

So, how does one create a Shopping Cart UI?

Well, *of course*, the first thing is to write the classic counter component:

```jsx
const Counter = ({count}) =>
  <span>
    <button onClick={() => count.modify(R.add(-1))}>-</button>
    {count}
    <button onClick={() => count.modify(R.add(+1))}>+</button>
  </span>
```

The `Counter` component displays a `count`, which is supposed to refer to state
that contains an integer, and buttons labeled `-` and `+` that decrement and
increment the `count` using [`modify`](#modify).

As you probably know, a counter component such as the above is a typical first
example that the documentation of any respectable front-end framework will give
you.  Until now you may have *mistakenly* thought that those are just toys.

### Component, remove thyself!

The next thing is to write a component that can remove itself:

```jsx
const Remove = ({removable}) =>
  <button onClick={() => removable.remove()}>x</button>
```

The `Remove` component gives you a button labeled `x` that
calls [`remove`](#remove) on the `removable` state given to it.

### Lists are simple data structures

Then we write a higher-order component that can display a list of items:

```jsx
const Items = ({items, Item}) =>
  <ul>
    {U.seq(items, U.indices, U.mapCached(i =>
           <Item key={i} item={U.view(i, items)}/>))}
  </ul>
```

The `Items` component is given state named `items` that is supposed to refer to
an array of objects.  From that array it then produces an unordered list of
`Item` components, passing them an `item` that corresponds to an element of the
`items` state array.

### Items in a cart

We haven't actually written anything shopping cart specific yet.  Let's change
that by writing a component for cart items:

```jsx
const cartName = U.view("name")

const cartCount =
  U.view([L.choose((props = {}) => L.defaults({...props, count: 0})),
          "count"])

const CartItem = ({item}) =>
  <li>
    <Remove removable={item}/>
    <Counter count={cartCount(item)}/>
    {cartName(item)}
  </li>
```

The `CartItem` component is designed to work as `Item` for the previous `Items`
component.  It is a simple component that is given state named `item` that is
supposed to refer to an object containing `name` and `count` fields.  `CartItem`
uses the previously defined `Remove` and `Counter` components.  The `Remove`
component is simply passed the `item` as the `removable`.  The `Counter`
component is given
a [lensed](https://github.com/calmm-js/partial.lenses) [view](#view) of the
`count`.  The `cartCount` lens makes it so that when the `count` property
reaches `0` the whole item is removed.

**_This is important:_** By using a simple lens as an adapter, we
could
[plug](https://github.com/calmm-js/documentation/blob/master/introduction-to-calmm.md#imagine) the
previously defined `Counter` component into the shopping cart state.

If this is the first time you
encounter [partial lenses](https://github.com/calmm-js/partial.lenses), then the
definition of `cartCount` may be difficult to understand, but it is not very
complex at all.  It works like this.  It looks at the incoming object and grabs
all the properties as `props`.  It then uses those to return a lens that, when
written through, will replace an object of the form `{...props, count: 0}` with
`undefined`.  This way, when the `count` reaches `0`, the whole item gets
removed.  After working with partial lenses for some time you will be able to
write far more interesting lenses.

### Items to put into the cart

We are nearly done!  We just need one more component for products:

```jsx
const productName = U.view("name")

const productCount = U.staged(item =>
  U.view([L.find(R.whereEq({id: item.id})),
          L.defaults(item),
          "count",
          L.defaults(0),
          L.normalize(R.max(0))]))

const ProductItem = cart => ({item}) =>
  <li>
    {K(item, item => <Counter count={productCount(item, cart)}/>)}
    {productName(item)}
  </li>
```

The `ProductItem` component is also designed to work as an `Item` for the
previous `Items` component.  Note that `ProductItem` actually takes two curried
arguments.  The first argument `cart` is supposed to refer to cart state.
`ProductItem` also reuses the `Counter` component.  This time we give it another
non-trivial lens.  The `productCount` lens is a parameterized lens that is given
an `item` to put into the `cart`.

### Putting it all together

We now have all the components to put together our shopping cart application.
Here is a list of some Finnish delicacies:

```jsx
const products = [
  {id: 1, name: "Sinertävä lenkki 500g"},
  {id: 2, name: "Maksainen laatikko 400g"},
  {id: 3, name: "Maitoa etäisesti muistuttava juoma 0.9l"},
  {id: 4, name: "Festi moka kaffe 500g"},
  {id: 5, name: "Niin hyvä voffeli ettei saa 55g"},
  {id: 6, name: "Suklainen Japanilainen viihdyttäjä 37g"}
]
```

And, finally, here is our `App`:

```jsx
const App = ({state, cart = U.view(["cart", L.define([])], state)}) =>
  <div>
    <h1>Karet (toy) Shopping Cart example</h1>
    <a href="https://github.com/calmm-js/karet-shopping-cart">GitHub</a>
    <div className="panels">
      <div className="panel">
        <h2>Products</h2>
        <Items Item={ProductItem(cart)} items={products}/>
      </div>
      <div className="panel">
        <h2>Shopping Cart</h2>
        <Items Item={CartItem} items={cart}/>
      </div>
    </div>
  </div>
```

The `App` above lenses the `cart` state out of the whole app `state` and then
instantiates the components.  Note that we use the higher-order `Items`
component twice with different `Item` components and different lists of `items`.

### Summary

For the purposes of this example we are done.  Here is a summary:

* We wrote several components such as `Counter`, `Removable` and `Items` that
  are not specific to the application in any way.

* Each component is just one function that takes (possibly reactive variables
  as) parameters and returns VDOM.

* We composed components together as VDOM expressions.

* We used `Counter` and `Items` twice in different contexts.

* When using `Counter` we used lenses to decompose application specific state to
  match the interface of the component.

## Reference

Typically one only uses the default export

```js
import Atom from "kefir.atom"
```

of this library.  It provides a convenience function that constructs a `new`
instance of the [`Atom`](#class-Atom) class.

### <a name="Atom"></a>[`Atom(value)`](#Atom "Atom :: a -> Atom a")

Creates a new atom with the given initial value.  For example:

```js
const notEmpty = Atom("initial")
notEmpty.get()
// 'initial'
notEmpty.log()
// [property] <value:current> initial
```

### <a name="Atom-empty"></a>[`Atom()`](#Atom-empty "Atom :: () -> Atom a")

Creates a new atom without an initial value.  For example:

```js
const empty = Atom()
empty.get()
// undefined
empty.log()
empty.set("first")
// [property] <value> first
```

### <a name="get"></a>[`atom.get()`](#get "get :: AbstractMutable a -> a")

Synchronously computes the current value of the atom.  For example:

```js
const root = Atom({x: 1})
const x = root.view("x")
x.get()
// 1
```

Use of `get` is discouraged: prefer to depend on an atom as you would with
ordinary Kefir properties.

When `get` is called on an [`AbstractMutable`](#class-AbstractMutable) that has
a root [`Atom`](#class-Atom) that does not have a value, `get` returns the
values of those [`Atom`](#class-Atom)s as `undefined`.  For example:

```js
const empty = Atom()
const notEmpty = Atom("initial")
const both = new Molecule({empty, notEmpty})
both.get()
// { empty: undefined, notEmpty: 'initial' }
```

### <a name="lens"></a>[`atom.lens(...ls)`](#lens "lens :: AbstractMutable a -> (...PLens a b) -> LensedAtom b")

**The `lens` method has been deprecated. Use the [`view`](#view) method instead.
The [`view`](#view) method has always been a duplicate of
`lens`. See [CHANGELOG](CHANGELOG.md#310) for futher details.**

### <a name="modify"></a>[`atom.modify(currentValue => newValue)`](#modify "modify :: AbstractMutable a -> (a -> a) -> ()")

Conceptually applies the given function to the current value of the atom and
replaces the value of the atom with the new value returned by the function.  For
example:

```js
const root = Atom({x: 1})
root.modify(({x}) => ({x: x-1}))
root.get()
// { x: 0 }
```

This is what happens with the basic [`Atom`](#class-Atom) implementation.  What
actually happens is decided by the implementation
of [`AbstractMutable`](#class-AbstractMutable) whose `modify` method is
ultimately called.  For example, the `modify` operation
of [`LensedAtom`](#class-LensedAtom) combines the function with its lens and
uses the resulting function to `modify` its source.  From the point of view of
the caller the end result is the same as with an [`Atom`](#class-Atom).  For
example:

```js
const root = Atom({x: 1})
const x = root.view("x")
x.modify(x => x-1)
x.get()
// 0
root.get()
// { x: 0 }
```

### <a name="set"></a>[`atom.set(value)`](#set "set :: AbstractMutable a -> a -> ()")

`atom.set(value)` is equivalent to [`atom.modify(() => value)`](#modify) and is
provided for convenience.

### <a name="remove"></a>[`atom.remove()`](#remove "remove :: AbstractMutable a -> ()")

`atom.remove()` is equivalent to [`atom.set()`](#set), which is also equivalent
to [`atom.set(undefined)`](#set), and is provided for convenience.  For example:

```js
const items = Atom(["To be", "Not to be"])
const second = items.view(1)
second.get()
// 'Not to be'
second.remove()
second.get()
// undefined
items.get()
// [ 'To be' ]
```

Calling `remove` on a plain [`Atom`](#class-Atom) doesn't usually make sense,
but `remove` can be useful with [`LensedAtom`](#class-LensedAtom)s, where the
"removal" will then follow from the semantics
of [remove](https://github.com/calmm-js/partial.lenses#remove) on partial
lenses.

### <a name="view"></a>[`atom.view(...ls)`](#view "view :: AbstractMutable a -> (...PLens a b) -> LensedAtom b")

Creates a new [`LensedAtom`](#class-LensedAtom) that provides a read-write view
with the given path from the original atom.  Modifications to the lensed atom
are reflected in the original atom and vice verse.  For example:

```js
const root = Atom({x: 1})
const x = root.view("x")
x.set(2)
root.get()
// { x: 2 }
root.set({x: 3})
x.get()
// 3
```

The lenses are treated as a path
of [partial lenses](https://github.com/calmm-js/partial.lenses/).  In fact, one
of the key ideas that makes lensed atoms possible is the compositionality of
partial lenses.  See the equations
here: [`L.compose`](https://github.com/calmm-js/partial.lenses#compose).  Those
equations make it possible not just to create lenses via composition (left hand
sides of equations), but also to create paths of lensed atoms (right hand sides
of equations).  More concretely, both the `c` in

```js
const b = a.view(a_to_b_PLens)
const c = b.view(b_to_c_PLens)
```

and in

```js
const c = a.view(a_to_b_PLens, b_to_c_PLens)
```

can be considered equivalent thanks to the compositionality equations of lenses.

Note that, for most intents and purposes, `view` is a referentially transparent
function: it does not create *new* mutable state&mdash;it merely creates a
reference to existing mutable state.

### <a name="holding"></a>[`holding(() => ...)`](#holding "holding :: (() -> a) -> a")

There is also a named import `holding`

```js
import {holding} from "kefir.atom"
```

which is function that is given a thunk to call while holding the propagation of
events from changes to atoms.  The thunk
can [`get`](#get), [`set`](#set), [`remove`](#remove) and [`modify`](#modify)
any number of atoms.  After the thunk returns, persisting changes to atoms are
propagated.  For example:

```js
const xy = Atom({x: 1, y: 2})
const x = xy.view("x")
const y = xy.view("y")
x.log("x")
// x <value:current> 1
y.log("y")
// y <value:current> 2
holding(() => {
  xy.set({x: 2, y: 1})
  x.set(x.get() - 1)
})
// y <value> 1
```

### Concepts

<p align="center"><img width="40%" height="40%" src="http://calmm-js.github.io/kefir.atom/images/Observables.svg"></p>

The above diagram illustrates the subtype relationships between the basic
concepts

* **Observable**,
* **Stream**, and
* **Property**

of [Kefir](http://rpominov.github.io/kefir/#about-observables) and the concepts
added by this library

* **[AbstractMutable](#class-AbstractMutable)**,
* **[Atom](#class-Atom)**,
* **[LensedAtom](#class-LensedAtom)**, and
* **[Molecule](#class-Molecule)**.

The classes [`AbstractMutable`](#class-AbstractMutable), [`Atom`](#class-Atom),
[`LensedAtom`](#class-LensedAtom) and [`Molecule`](#class-Molecule) are
provided as named exports:

```js
import {AbstractMutable, Atom, LensedAtom, Molecule} from "kefir.atom"
```

Note that the [default export](#Atom) is not the same as the named
export [`Atom`](#class-Atom).

There are use cases where you would want to create new subtypes of
[`AbstractMutable`](#class-AbstractMutable), but it seems unlikely that you
should inherit from the other classes.

#### <a name="class-AbstractMutable"></a>[`AbstractMutable a :> Property a`](#class-AbstractMutable)

`AbstractMutable` is the abstract base class or interface against which most
code using atoms is actually written.  An `AbstractMutable` is a
Kefir [property](http://rpominov.github.io/kefir/#about-observables) that also
provides for ability to request to [`modify`](#modify) the value of the
property.  `AbstractMutable`s implicitly skip duplicates using
Ramda's [`identical`](http://ramdajs.com/0.21.0/docs/#identical) function.

Note that we often abuse terminology and speak of [`Atom`](#class-Atom)s when we
should speak of `AbstractMutable`s, because [`Atom`](#class-Atom) is easier to
pronounce and is more concrete.

#### <a name="class-Atom"></a>[`Atom a :> AbstractMutable a`](#class-Atom)

An `Atom` is a simple implementation of
an [`AbstractMutable`](#class-AbstractMutable) that actually stores state.  One
can create an `Atom` directly by explicitly giving an initial value or one can
create an `Atom` without an initial value.

The *value* stored by an `Atom` *must* be treated as an *immutable* object.
Instead of mutating the value stored by an `Atom`, one mutates the `Atom` by
calling [`modify`](#modify), which makes the `Atom` to refer to the new value.

Note that `Atom` is not the only possible root implementation
of [`AbstractMutable`](#class-AbstractMutable).  For example, it would be
possible to implement an [`AbstractMutable`](#class-AbstractMutable) whose state
is actually stored in an external database that can be observed and mutated by
multiple clients.

#### <a name="class-LensedAtom"></a>[`LensedAtom a :> AbstractMutable a`](#class-LensedAtom)

A `LensedAtom` is an implementation of
an [`AbstractMutable`](#class-AbstractMutable) that doesn't actually store
state, but instead refers to a part, specified using
a [lens](https://github.com/calmm-js/partial.lenses/), of
another [`AbstractMutable`](#class-AbstractMutable).  One creates `LensedAtom`s
by calling the [`view`](#view) method of
an [`AbstractMutable`](#class-AbstractMutable).

#### <a name="class-Molecule"></a>[`Molecule t :> AbstractMutable (t where AbstractMutable x := x)`](#class-Molecule)

A `Molecule` is a special *partial* implementation of
an [`AbstractMutable`](#class-AbstractMutable) that is constructed from a
template of abstract mutables:

```js
const xyA = Atom({x: 1, y: 2})
const xL = xyA.view("x")
const yL = xyA.view("y")
const xyM = new Molecule({x: xL, y: yL})
```

When read, either as a property or via [`get`](#get), the abstract mutables in
the template are replaced by their values:

```js
R.equals( xyM.get(), xyA.get() )
// true
```

When written to, the abstract mutables in the template are written to with
matching elements from the written value:

```js
xyM.view("x").set(3)
xL.get()
// 3
yL.get()
// 2
```

The writes are performed [`holding`](#holding) event propagation.

It is considered an error, and the effect is unpredictable, if the written value
does not match the template, aside from the positions of abstract mutables, of
course, which means that write operations, [`set`](#set), [`remove`](#remove)
and [`modify`](#modify), on `Molecule`s and lensed atoms created from molecules
are only *partial*.

Also, if the template contains multiple abstract mutables that correspond to the
same underlying state, then writing through the template will give unpredictable
results.

## About

See [CHANGELOG](CHANGELOG.md).

### Implementation trade-offs

The implementations of the concepts provided by this library have been
**optimized for space** at a fairly low level.  The good news is that you can
**use atoms and lensed atoms with impunity**.  The bad news is that the
implementation is tightly bound to the internals of Kefir.  Should the internals
change, this library will need to be updated as well.

### Related work

The term "atom" is borrowed from [Clojure](http://clojure.org/reference/atoms)
and comes from the idea that one only
performs ["atomic"](https://en.wikipedia.org/wiki/Read-modify-write),
or [race-condition](https://en.wikipedia.org/wiki/Race_condition) free,
operations on individual atoms.

The idea of combining atoms and lenses came
from [Bacon.Model](https://github.com/baconjs/bacon.model), which we used
initially.

Our use of atoms was initially shaped by a search of way to make it possible to
program in ways similar to what could be done
using [Reagent](https://reagent-project.github.io/) and (early versions
of) [WebSharper UI.Next](http://websharper.com/docs/ui.next).
