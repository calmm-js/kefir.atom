import babel       from "rollup-plugin-babel"
import nodeResolve from "rollup-plugin-node-resolve"
import replace     from "rollup-plugin-replace"
import uglify      from "rollup-plugin-uglify"

export default {
  external: ["infestines", "partial.lenses", "kefir"],
  globals: {
    "infestines": "I",
    "kefir": "Kefir",
    "partial.lenses": "L"
  },
  plugins: [
    process.env.NODE_ENV &&
      replace({"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)}),
    nodeResolve(),
    babel(),
    process.env.NODE_ENV === "production" &&
      uglify()
  ].filter(x => x)
}
