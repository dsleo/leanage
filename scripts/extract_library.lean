/-
Extract the dependency edges of a user's library, for `leanage index`.

Run inside the user's Lake project (the library must be built, so its .olean files exist):

    lake env lean --run extract_library.lean out.tsv My.Module.A My.Module.B ...
    lake env lean --run extract_library.lean out.tsv @modules.txt      # one module per line (big libraries)

Same output as extract_edges.lean plus a fifth column, the module that defines the constant, and only for constants
defined in the modules listed on the command line (their imports, Mathlib included, are the lower layer):

    <name>\t<type deps>\t<value deps>\t<kind>\t<module>

See extract_edges.lean for the column meanings. The first line is `# lean <version> <githash>`.
-/
import Lean
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
  let out :: mods := args | IO.eprintln "usage: extract_library out.tsv Module..."; return 2
  let mods ← match mods with
    | [f] => if f.startsWith "@" then pure ((← IO.FS.readFile (f.drop 1).toString).splitOn "\n" |>.filter (· ≠ "")) else pure mods
    | _ => pure mods
  if mods.isEmpty then IO.eprintln "no modules given"; return 2
  -- not String.toName: a component like `03Forall` would parse as a numeric name component
  let mods := mods.toArray.map fun s => (s.splitOn ".").foldl Name.mkStr Name.anonymous
  initSearchPath (← findSysroot)
  enableInitializersExecution
  let env ← importModules (mods.map fun m => { module := m }) {} (loadExts := true)
  let h ← IO.FS.Handle.mk out .write
  h.putStrLn s!"# lean {Lean.versionString} {Lean.githash}"
  let mut count := 0
  for i in [0:env.header.moduleNames.size] do
    let m := env.header.moduleNames[i]!
    unless mods.contains m do continue
    for ci in env.header.moduleData[i]!.constants do
      let t := ci.type.getUsedConstants
      let v := valueDeps ci
      h.putStrLn s!"{ci.name}\t{joinNames t}\t{joinNames v}\t{kindOf ci}\t{m}"
      count := count + 1
  h.flush
  IO.eprintln s!"wrote {count} constants"
  return 0
