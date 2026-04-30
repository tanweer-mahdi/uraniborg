## 1. Managed Refinement Failure Classification

- [x] 1.1 Preserve provider/runtime error details from Pi-managed refinement responses, including provider-authored error messages when available.
- [x] 1.2 Reclassify managed `stopReason: "error"` responses with no usable text payload as refinement execution failures instead of `refine_output_invalid`.
- [x] 1.3 Keep malformed-output parsing and `refine.response.txt` artifact preservation only for non-empty refinement text that actually failed the contract parser.

## 2. Failed-Run Diagnostics

- [x] 2.1 Update refine failure logging and surfaced copy so managed runtime failures point to the provider/runtime error context instead of the malformed-output artifact path.
- [x] 2.2 Preserve local failed-run evidence for both failure classes without requiring provider-side replay.

## 3. Verification

- [x] 3.1 Add tests for empty managed runtime error responses being surfaced as execution failures.
- [x] 3.2 Add regression tests ensuring malformed non-empty text still persists `refine.response.txt`.
- [x] 3.3 Run `npm run typecheck`, `npm test`, and `openspec validate separate-managed-refinement-runtime-failures`.
