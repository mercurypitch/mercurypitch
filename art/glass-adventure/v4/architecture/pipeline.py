"""Run the proven donor-preserving architecture tools in V4-owned directories."""
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[1] / "v3" / "architecture"
TOOLS = {"intake": "inspect_donor", "finalize": "finalize_column",
         "validate": "validate_artifact", "proof": "render_proof"}


def run(stage, arguments):
    if stage not in TOOLS:
        raise ValueError("Unknown architecture stage")
    for folder in ["raw", "sources", "exports", "reports", "proofs"]:
        (HERE / folder).mkdir(parents=True, exist_ok=True)
    name = TOOLS[stage]
    spec = importlib.util.spec_from_file_location("v4_" + name, SOURCE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.HERE = HERE
    previous = sys.argv
    try:
        sys.argv = [str(__file__), "--", *arguments]
        module.main()
    finally:
        sys.argv = previous
    # The imported tools have a historical V3 schema label; this wrapper records
    # their identity while keeping the V4 artifact receipts correctly versioned.
    for report in (HERE / "reports").glob("*.json"):
        data = json.loads(report.read_text())
        if data.get("version") == 3:
            data["version"] = 4
            data["pipeline"] = "V3 donor-preserving helper with V4 path isolation"
            incoming = data.get("source", {}).get("incomingPath")
            if incoming:
                path = Path(incoming)
                try:
                    data["source"]["incomingPath"] = str(path.relative_to(HERE.parents[3]))
                except ValueError:
                    data["source"]["incomingPath"] = path.name
            report.write_text(json.dumps(data, indent=2) + "\n")
    return {"stage": stage, "outputDirectory": str(HERE)}


if __name__ == "__main__":
    arguments = sys.argv[sys.argv.index("--") + 1:]
    result = run(arguments[0], arguments[1:])
