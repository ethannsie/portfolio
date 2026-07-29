Drop your exported assembly here as `model.step` (or `.stp`) and it
will show up as an interactive exploded view on this project's page —
no conversion needed, no code changes beyond what's already wired up
in `js/data.js`. The browser parses and tessellates the STEP file
directly via OpenCascade compiled to WASM.

Export tips:
- Export the assembly, not a single fused/merged body — each
  part/solid should land as its own node so the explode animation has
  something to pull apart. Fusion 360, Onshape, and SolidWorks can all
  export STEP (AP214 or AP242) directly from a "Save As" / "Export"
  dialog.
- Large or very high-detail assemblies take longer to tessellate in
  the browser on first load — simplify/defeature parts that don't need
  fine detail (fillets, threads, etc.) if load time matters.
