/-
Extract per-constant boilerplate flags from a Mathlib environment, for the Leanage store.

Run from a Mathlib checkout with prebuilt oleans (same commit as the store):

    lake env lean --run /path/to/extract_flags.lean out.tsv            # all constants
    lake env lean --run /path/to/extract_flags.lean out.tsv Nat.cast   # only the given names (test mode)

Output: one line `<name>\t<flags>` per constant, name = Name.toString (same escaping as the store's names.txt),
flags = letters, or `-` for none:
  i  instance            Lean.Meta.isInstanceCore (global instances; global and scoped instances; scoped ones are read from the modules entries)
  p  projection function Lean.Environment.isProjectionFn
  c  coercion            registered with @[coe] (Lean.Meta.coeExt)
  d  coe_decl            Lean.Meta.isCoeDecl (Coe.coe, CoeT.coe, ...)
  C  class               Lean.isClass (the inductive type itself)
  S  structure           Lean.isStructure (the inductive type itself, classes included)
  k  structure constructor
The first line is `# lean <version> <githash>`.
-/
import Lean
open Lean Meta

/-- Scoped instances are only active inside their namespace, so `isInstanceCore` misses them after an import; read them from the modules' entries. -/
def scopedInstances (env : Environment) : NameSet := Id.run do
  let mut s : NameSet := {}
  for i in [0:env.header.moduleNames.size] do
    for e in Lean.Meta.instanceExtension.ext.getModuleEntries env i do
      match e with
      | .scoped _ ie => if let some n := ie.globalName? then s := s.insert n
      | .global _ => pure ()
  return s

def flagsOf (env : Environment) (coe : NameMap CoeFnInfo) (scopedInsts : NameSet) (n : Name) (ci : ConstantInfo) : String := Id.run do
  let mut s := ""
  if isInstanceCore env n || scopedInsts.contains n then s := s ++ "i"
  if env.isProjectionFn n then s := s ++ "p"
  if coe.contains n then s := s ++ "c"
  if isCoeDecl env n then s := s ++ "d"
  if isClass env n then s := s ++ "C"
  if isStructure env n then s := s ++ "S"
  match ci with
  | .ctorInfo c => if isStructure env c.induct then s := s ++ "k"
  | _ => pure ()
  return if s.isEmpty then "-" else s

unsafe def main (args : List String) : IO UInt32 := do
  let out :: only := args | IO.eprintln "usage: extract_flags out.tsv [names...]"; return 2
  initSearchPath (← findSysroot)
  enableInitializersExecution
  let env ← importModules #[{ module := `Mathlib }] {} (loadExts := true)
  let coe := coeExt.getState env
  let scopedInsts := scopedInstances env
  let h ← IO.FS.Handle.mk out .write
  h.putStrLn s!"# lean {Lean.versionString} {Lean.githash}"
  let mut count := 0
  if only.isEmpty then
    for (n, ci) in env.constants.map₁.toList do
      h.putStrLn s!"{n}\t{flagsOf env coe scopedInsts n ci}"
      count := count + 1
  else
    for s in only do
      let n := s.toName
      match env.find? n with
      | some ci => h.putStrLn s!"{n}\t{flagsOf env coe scopedInsts n ci}"
      | none => h.putStrLn s!"{n}\t?missing"
  h.flush
  IO.eprintln s!"wrote {count} constants"
  return 0
