Reactive variables with [Kefir](http://rpominov.github.io/kefir/).

Note: This implementation is **optimized for space** at a fairly low level.  The
good news is that you can **use atoms and lenses with impunity**.  The bad news
is that the implementation is tightly bound to the internals of Kefir.  Should
the internals change, this library will need to be updated as well.

[![npm version](https://badge.fury.io/js/kefir.atom.svg)](http://badge.fury.io/js/kefir.atom) [![Build Status](https://travis-ci.org/calmm-js/kefir.atom.svg?branch=master)](https://travis-ci.org/calmm-js/kefir.atom) [![](https://david-dm.org/calmm-js/kefir.atom.svg)](https://david-dm.org/calmm-js/kefir.atom) [![](https://david-dm.org/calmm-js/kefir.atom/dev-status.svg)](https://david-dm.org/calmm-js/kefir.atom#info=devDependencies) [![Gitter](https://img.shields.io/gitter/room/calmm-js/chat.js.svg?style=flat-square)](https://gitter.im/calmm-js/chat)

## Concepts

<p align="center"><img width="40%" height="40%" src="http://calmm-js.github.io/kefir.atom/images/Observables.svg"></p>

The above diagram illustrates the subtype relationships between the basic
concepts

* **Observable**,
* **Stream**, and
* **Property**

of [Kefir](http://rpominov.github.io/kefir/#about-observables) and the concepts
added by this library

* **AbstractMutable**,
* **Atom**, and
* **LensedAtom**.

## Reference

Typically one only uses the default import

```js
import Atom from "kefir.atom"
```

of this library.  It provides a convenience function that constructs a `new`
instance of the [`Atom`](#class-Atom) class.

The classes [`AbstractMutable`](#class-AbstractMutable), [`Atom`](#class-Atom),
and [`LensedAtom`](class-LensedAtom) are also provided as named exports:

```js
import {AbstractMutable, Atom, LensedAtom} from "kefir.atom"
```

There are use cases where you would want to create new subtypes of
[`AbstractMutable`](#class-AbstractMutable), but it seems unlikely that you
should inherit from [`Atom`](#class-Atom) or [`LensedAtom`](class-LensedAtom).

### <a name="class-AbstractMutable"></a>[`AbstractMutable a :> Property a`](#class-AbstractMutable)

`AbstractMutable` is the base interface against which most code using atoms is
actually written.  An `AbstractMutable` is a property that also provides for
ability to request to `modify` the value of the property.

Note that we often abuse terminology and speak of [`Atom`](#class-Atom)s when we
should speak of `AbstractMutable`s, because [`Atom`](#class-Atom) is easier to
pronounce and is more concrete.

`AbstractMutable` does not implement the `get` and `modify` methods&mdash;they
are to be defined by subtypes.  Otherwise all of the classes provide the same
methods with the same semantics.

### <a name="class-Atom"></a>[`Atom a :> AbstractMutable a`](#class-Atom)

An `Atom` is a simple implementation of an
[`AbstractMutable`](#class-AbstractMutable) that actually stores the value.  One
can create an `Atom` directly by giving an initial value.

Note that `Atom` is not the only possible root implementation of
[`AbstractMutable`](#class-AbstractMutable).  For example, it would be possible
to implement an [`AbstractMutable`](#class-AbstractMutable) whose state is
actually stored in an external database that can be observed and mutated by
multiple clients.

### <a name="class-LensedAtom"></a>[`LensedAtom a :> AbstractMutable a`](#class-LensedAtom)

A `LensedAtom` is an implementation of an
[`AbstractMutable`](#class-AbstractMutable) that doesn't actually store
anything, but instead refers to a part, specified using a
[lens](https://github.com/calmm-js/partial.lenses/), of another
[`AbstractMutable`](#class-AbstractMutable).  One creates `LensedAtom`s by
calling the `lens` method of an [`AbstractMutable`](#class-AbstractMutable).

### <a name="Atom"></a>[`Atom(initialValue)`](#Atom "Atom :: a -> Atom a")

Creates a new atom with the given initial value.  An atom is a modifiable Kefir
[property](http://rpominov.github.io/kefir/#about-observables).  Atoms (and
lensed atoms) implicitly skip duplicates using Ramda's
[`equals`](http://ramdajs.com/0.21.0/docs/#equals) function.

### <a name="get"></a>[`atom.get()`](#get "get :: AbstractMutable a -> a")

A slow operation to synchronously get the current value of the atom.  Use of
`get` is discouraged: prefer to depend on an atom as you would with ordinary
Kefir properties.

### <a name="lens"></a>[`atom.lens(...ls)`](#lens "lens :: AbstractMutable a -> (...PLens a b) -> LensedAtom b")

Creates a new lensed atom with the given path from the original atom.
Modifications to the lensed atom are reflected in the original atom and vice
verse.

The lenses are treated as a path of
[partial lenses](https://github.com/calmm-js/partial.lenses/).  In fact, one of
key ideas that makes lensed atoms possible is the compositionality of partial
lenses.  See the equations here:
[`L.compose`](https://github.com/calmm-js/partial.lenses#compose).  Those
equations make it possible not just to create lenses via composition (left hand
sides of equations), but also to create paths of lensed atoms (right hand sides
of equations).  More concretely, both the `c` in

```js
const b = a.lens(a_to_b_PLens)
const c = b.lens(b_to_c_PLens)
```

and in

```js
const c = a.lens(a_to_b_PLens, b_to_c_PLens)
```

can be considered equivalent thanks to the compositionality equations of lenses.

Note that, for most intents and purposes, `lens` is a referentially transparent
function: it does not create *new* mutable state&mdash;it merely creates a
reference to existing mutable state.

### <a name="modify"></a>[`atom.modify(currentValue => newValue)`](#modify "modify :: AbstractMutable a -> (a -> a) -> ()")

Conceptually applies the given function to the current value of the atom and
replaces the value of the atom with the new value returned by the function.
This is what happens with the basic [`Atom`](#class-Atom) implementation.  What
actually happens is decided by the implementation of [`AbstractMutable`](#class-AbstractMutable) whose
`modify` method is ultimately called.

### <a name="set"></a>[`atom.set(value)`](#set "set :: AbstractMutable a -> a -> ()")

`atom.set(value)` is equivalent to [`atom.modify(() => value)`](#modify) and is
provided for convenience.

### <a name="view"></a>[`atom.view(...ls)`](#view "view :: AbstractMutable a -> (...PLens a b) -> Property b")

Creates a new view with the given path from the original atom.  Changes to the
original atom are reflected in the view.
