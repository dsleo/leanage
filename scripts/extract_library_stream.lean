/-
Like extract_library.lean, for libraries too big to import in one go (TauCeti: 34,759 modules, which exhaust the system's file
handles when imported together). Reads one module's .olean at a time instead of building an environment, so it needs no
handles beyond the current file, but it cannot compute flags (those need the environment). Source lines come from the modules' own
declaration-range entries: next to out.tsv it writes out.tsv.ranges, `<name>\t<module>\t<first line>-<last line>`.

    lake env lean --run extract_library_stream.lean out.tsv @modules.txt

Output (first line `# lean <version> <githash>`), one line per constant the module defines:
    <name>\t<type deps>\t<value deps>\t<kind>\t<module>
Dependencies are the same as in extract_library.lean: constants used by the type and by the value (theorems, definitions, opaques),
and the constructors of an inductive type. Read at the private level, as `import all` would: private declarations and their proofs are part of the library.
-/
import Lean
import Std.Data.HashMap
open Lean

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

unsafe def main (args : List String) : IO UInt32 := do
  let [out, spec] := args | IO.eprintln "usage: extract_library_stream out.tsv @modules.txt"; return 2
  unless spec.startsWith "@" do IO.eprintln "the module list must be given as @file"; return 2
  let lines := (← IO.FS.readFile (spec.drop 1).toString).splitOn "\n" |>.filter (· ≠ "")
  -- not String.toName: a component like `03Forall` would parse as a numeric name component
  let mods := lines.map fun s => (s.splitOn ".").foldl Name.mkStr Name.anonymous
  initSearchPath (← findSysroot)
  let h ← IO.FS.Handle.mk out .write
  let hr ← IO.FS.Handle.mk (out ++ ".ranges") .write
  h.putStrLn s!"# lean {Lean.versionString} {Lean.githash}"
  let mut count := 0
  for m in mods do
    let f ← findOLean m
    let main ← CompactedRegion.read (α := ModuleData) f #[]
    -- a `module` file keeps its private declarations and some proof terms in .olean.private (parts are loaded in this order)
    let mut regions := #[main.2]
    let mut data := main.1
    let mut parts := #[main.1]
    if main.1.isModule then
      let server ← CompactedRegion.read (α := ModuleData) (OLeanLevel.server.adjustFileName f) #[main.2]
      let priv ← CompactedRegion.read (α := ModuleData) (OLeanLevel.private.adjustFileName f) #[main.2, server.2]
      regions := regions ++ #[server.2, priv.2]
      data := priv.1
      parts := parts ++ #[server.1, priv.1]
    -- declaration ranges: the entries of `declRangeExt`, wherever the module system put them
    let mut ranges : Std.HashMap Name (Nat × Nat) := {}
    for part in parts do
      for (en, es) in part.entries do
        if en == declRangeExt.name then
          for e in es do
            let p : Name × DeclarationRanges := unsafe unsafeCast e
            ranges := ranges.insert p.1 (p.2.range.pos.line, p.2.range.endPos.line)
    for ci in data.constants do
      h.putStrLn s!"{ci.name}\t{joinNames ci.type.getUsedConstants}\t{joinNames (valueDeps ci)}\t{kindOf ci}\t{m}"
      if let some (a, b) := ranges[ci.name]? then hr.putStrLn s!"{ci.name}\t{m}\t{a}-{b}"
      count := count + 1
    for r in regions.reverse do r.free
  h.flush
  hr.flush
  IO.eprintln s!"wrote {count} constants from {mods.length} modules"
  return 0
