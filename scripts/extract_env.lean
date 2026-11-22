/-
Extract everything the Leanage store needs from one Lean environment, in a single pass. Used to rebuild the Mathlib
store at a commit for which mathlib-initiative/mathlib-const-dep has no shards (for example the Mathlib pinned by TauCeti).

Run inside a Lake project that depends on Mathlib, with its .olean files built:

    lake env lean --run /path/to/extract_env.lean out.tsv [Root]      # Root defaults to Mathlib

Output: one line per imported constant,
    <name>\t<type deps>\t<value deps>\t<kind>\t<module>\t<flags>
and, next to it, out.tsv.ranges: `<name>\t<module>\t<first line>-<last line>` for every constant that has a declaration range
(used by scripts/ingest_tactics_ranges.py to find the source lines of each declaration).
name = Name.toString (same escaping as the store's names.txt); dependency lists = names joined by U+001F;
kind and flags as in extract_edges.lean and extract_flags.lean. The only difference from extract_edges.lean: the value deps of
an inductive type are its constructors, as in Lean's `#print axioms` (CollectAxioms), so closures agree with Lean.
The first line is `# lean <version> <githash>`.
-/
import Lean
open Lean Meta

def joinNames (ns : Array Name) : String :=
  "\x1f".intercalate (ns.toList.map toString)

def valueDeps : ConstantInfo → Array Name
  | .thmInfo v => v.value.getUsedConstants
  | .defnInfo v => v.value.getUsedConstants
  | .opaqueInfo v => v.value.getUsedConstants
  | .inductInfo v => v.ctors.toArray
  | _ => #[]

def kindOf : ConstantInfo → String
  | .thmInfo _ => "t"
  | .defnInfo _ => "d"
  | .opaqueInfo _ => "o"
  | .axiomInfo _ => "a"
  | .inductInfo _ => "i"
  | .ctorInfo _ => "c"
  | .recInfo _ => "r"
  | .quotInfo _ => "q"

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
  let out :: rest := args | IO.eprintln "usage: extract_env out.tsv [Root]"; return 2
  let root := (rest.head?.getD "Mathlib").toName
  initSearchPath (← findSysroot)
  enableInitializersExecution
  let env ← importModules #[{ module := root }] {} (loadExts := true)
  let coe := coeExt.getState env
  let scopedInsts := scopedInstances env
  let h ← IO.FS.Handle.mk out .write
  let hr ← IO.FS.Handle.mk (out ++ ".ranges") .write
  h.putStrLn s!"# lean {Lean.versionString} {Lean.githash}"
  let count ← IO.mkRef 0
  env.constants.map₁.forM fun n ci => do
    let m := match env.getModuleIdxFor? n with
      | some i => env.header.moduleNames[i.toNat]!.toString
      | none => "?"
    h.putStrLn s!"{n}\t{joinNames ci.type.getUsedConstants}\t{joinNames (valueDeps ci)}\t{kindOf ci}\t{m}\t{flagsOf env coe scopedInsts n ci}"
    match declRangeExt.find? env n with
    | some r => hr.putStrLn s!"{n}\t{m}\t{r.range.pos.line}-{r.range.endPos.line}"
    | none => pure ()
    count.modify (· + 1)
  h.flush
  hr.flush
  IO.eprintln s!"wrote {← count.get} constants"
  return 0
