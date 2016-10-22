# Changelog

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
