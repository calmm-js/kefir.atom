# Changelog

## 3.1.0

Previously `AbstractMutable`s had two methods using lenses: `lens` and `view`.
The idea was that `lens` would create a read-write view and `view` would create
a read-only view.  The distinction has now been dropped and `lens` has been
deprecated.  Simply replace calls to `lens` with calls to `view`:

```diff
-a.lens(...)
+a.view(...)
```

Note that the above change is compatible with previous versions of this library.

There are a number of reasons for this change:

* First of all the distinction isn't very useful in a language such as
  JavaScript where the read-only/read-write distinction cannot be enforced by a
  type system.

* As a name, `view` describes the functionality much better.  It helps to avoid
  confusion about what is a [lens](https://github.com/calmm-js/partial.lenses)
  and what is a [view](https://github.com/calmm-js/kefir.atom#class-LensedAtom)
  created with a lens.

* It is not uncommon to want to use lenses to view state from both atoms and
  properties.  In such circumstances it is useful to extend properties with a
  `view` method.  This way program components can be polymorphic with respect to
  whether they are given a read-only or a read-write view of state.

## 3.0.0

In previous versions of this library, `AbstractMutable`s, including `Atom`,
`LensedAtom` and `Molecule`, were always considered to hold a value.  The
initial value of an `Atom()` constructed without an argument was implicitly
`undefined`.  Also, when subscribing to an `AbstractMutable`, there would always
immediately be an event.

Now an `Atom` may be initially *empty*.  When subscribing to an
`AbstractMutable` whose root `Atom` is empty, there will be no immediate event.
The first event occurs only after the root `Atom` is written to with an initial
value.

This changes program behavior only when an `Atom` is constructed without an
explicit initial value.  To port from previous versions of this library, it is
therefore sufficient to change code as follows:

```diff
-Atom()
+Atom(undefined)
```

This change was made to make the use of `Atom`s as reactive variables for wiring
better behaved.
