/-
Extract typed dependency edges from a Mathlib environment, for the Leanage store.

Run from a Mathlib checkout with prebuilt oleans (same commit as the store):

    lake env lean --run /path/to/extract_edges.lean out.tsv            # all constants
    lake env lean --run /path/to/extract_edges.lean out.tsv Nat.add_comm   # only the given names (test mode)

Output: one line per constant, `<name>\t<type deps>\t<value deps>\t<kind>`, name = Name.toString (same escaping as the
store's names.txt), each dependency list = names joined by U+001F (empty when none).
  type deps   Expr.getUsedConstants of ConstantInfo.type  (the statement / signature)
  value deps  Expr.getUsedConstants of the value for theorems, definitions and opaques; empty for axioms,
              inductives, constructors, recursors and quotients (their references are all in the type).
  kind        one letter: t theorem, d definition, o opaque, a axiom, i inductive, c constructor, r recursor, q quot.
The first line is `# lean <version> <githash>`.
-/
import Lean
open Lean

def joinNames (ns : Array Name) : String :=
  "\x1f".intercalate (ns.toList.map toString)

def valueOf? : ConstantInfo → Option Expr
  | .thmInfo v => some v.value
  | .defnInfo v => some v.value
  | .opaqueInfo v => some v.value
  | _ => none

def kindOf : ConstantInfo → String
  | .thmInfo _ => "t"
  | .defnInfo _ => "d"
  | .opaqueInfo _ => "o"
  | .axiomInfo _ => "a"
  | .inductInfo _ => "i"
  | .ctorInfo _ => "c"
  | .recInfo _ => "r"
  | .quotInfo _ => "q"

def line (n : Name) (ci : ConstantInfo) : String :=
  let t := ci.type.getUsedConstants
  let v := match valueOf? ci with
    | some e => e.getUsedConstants
    | none => #[]
  s!"{n}\t{joinNames t}\t{joinNames v}\t{kindOf ci}"

unsafe def main (args : List String) : IO UInt32 := do
  let out :: only := args | IO.eprintln "usage: extract_edges out.tsv [names...]"; return 2
  initSearchPath (← findSysroot)
  enableInitializersExecution
  let env ← importModules #[{ module := `Mathlib }] {} (loadExts := true)
  let h ← IO.FS.Handle.mk out .write
  h.putStrLn s!"# lean {Lean.versionString} {Lean.githash}"
  let mut count := 0
  if only.isEmpty then
    for (n, ci) in env.constants.map₁.toList do
      h.putStrLn (line n ci)
      count := count + 1
  else
    for s in only do
      let n := s.toName
      match env.find? n with
      | some ci => h.putStrLn (line n ci)
      | none => h.putStrLn s!"{n}\t?missing\t?missing\t?"
  h.flush
  IO.eprintln s!"wrote {count} constants"
  return 0
