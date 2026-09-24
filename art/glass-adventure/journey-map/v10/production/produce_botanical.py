"""One receipt-first Meshy 7.1 botanical donor; resumable reads, never blind POST retries."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "production" / "camellia-receipt.json"
GUIDE = ROOT / "guides" / "camellia-crescent-planter.png"
ENDPOINT = "https://api.meshy.ai/openapi/v1/image-to-3d"
KEY = os.environ["MESHY_API_KEY"]


def save(value):
    temporary = RECEIPT.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(RECEIPT)


def api(url, payload=None):
    request = urllib.request.Request(url, data=None if payload is None else json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main():
    global RECEIPT
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["submit", "poll"])
    parser.add_argument("--seconds", type=int, default=600)
    parser.add_argument("--variant", choices=["dense", "quad60k"], default="dense")
    args = parser.parse_args()
    endpoint = ENDPOINT
    if args.variant == "quad60k":
        endpoint = "https://api.meshy.ai/openapi/v1/remesh"
        RECEIPT = ROOT / "production" / "camellia-quad60k-receipt.json"
    if args.action == "submit":
        if RECEIPT.exists():
            raise SystemExit("Receipt exists; inspect and poll its known task. Do not submit again.")
        guide = GUIDE.read_bytes()
        request = dict(model_type="standard", ai_model="meshy-7.1", geometry_resolution="4k",
            should_remesh=False, should_texture=True, texture_resolution="4k", enable_pbr=True,
            image_enhancement=True, target_formats=["glb"], alpha_thumbnail=True,
            texture_prompt="Ivory camellia flowers with distinct rounded layered petals and warm pale gold centers, clean deep jade broad leaves, small soft celadon leaves, low crescent shaped polished ivory marble planter with a restrained aged gold rim. Botanical sculptural museum ornament. Preserve the isolated complete solid planter, distinct petals and leaves, without scene, ground, shadows baked into color, writing or extra structures.")
        if args.variant == "quad60k":
            original = json.loads((ROOT / "production" / "camellia-receipt.json").read_text())
            if original["status"] != "downloaded":
                raise SystemExit("Preserve the dense donor before a topology candidate")
            request = dict(input_task_id=original["taskId"], topology="quad", target_polycount=60000,
                target_formats=["glb"], alpha_thumbnail=True)
        receipt = dict(schema=1, provider="Meshy image-to-3d", status="submission-unconfirmed",
            source={"file": str(GUIDE.relative_to(ROOT)), "bytes": len(guide), "sha256": hashlib.sha256(guide).hexdigest()},
            request=request, authorization="Owner authorized prepared guide uploads and Meshy production for current museum polish.",
            endpoint=endpoint, variant=args.variant,
            beforeBalance=api("https://api.meshy.ai/openapi/v1/balance"), submittedAt=time.time())
        save(receipt)
        payload = request if args.variant == "quad60k" else {**request, "image_url": "data:image/png;base64," + base64.b64encode(guide).decode()}
        result = api(endpoint, payload)
        receipt.update(taskId=result["result"], status="submitted")
        save(receipt)
        print(json.dumps({"taskId": receipt["taskId"], "status": receipt["status"]}), flush=True)
        return
    receipt = json.loads(RECEIPT.read_text())
    if "taskId" not in receipt:
        raise SystemExit("Unconfirmed submission: reconcile provider task list before any new POST.")
    deadline = time.monotonic() + min(args.seconds, 1800)
    while time.monotonic() < deadline:
        result = api(endpoint + "/" + receipt["taskId"])
        receipt["providerStatus"] = {k: result[k] for k in ("id", "status", "progress", "created_at", "finished_at", "consumed_credits") if k in result}
        receipt["status"] = result["status"]
        save(receipt)
        print(json.dumps(receipt["providerStatus"]), flush=True)
        if result["status"] in ("FAILED", "CANCELED"):
            raise SystemExit("Provider task failed. Inspect this receipt; no automatic resubmission.")
        if result["status"] == "SUCCEEDED":
            target = ROOT / "sources" / f"camellia-crescent-{args.variant}.glb"
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                url = result["model_urls"]["glb"]
                parsed = urllib.parse.urlparse(url)
                if parsed.scheme != "https" or parsed.hostname != "assets.meshy.ai":
                    raise SystemExit("Unexpected download host")
                # Signed URL is kept only in memory; failed downloads retain the known task.
                temporary = target.with_suffix(".download")
                with urllib.request.urlopen(url, timeout=120) as response, temporary.open("wb") as out:
                    size = 0
                    while block := response.read(1024 * 1024):
                        size += len(block)
                        if size > 256 * 1024 * 1024:
                            raise ValueError("Unexpected donor size")
                        out.write(block)
                if temporary.read_bytes()[:4] != b"glTF":
                    raise ValueError("Invalid GLB header")
                temporary.replace(target)
            raw = target.read_bytes()
            receipt["donor"] = dict(file=str(target.relative_to(ROOT)), bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
            receipt["afterBalance"] = api("https://api.meshy.ai/openapi/v1/balance")
            receipt["status"] = "downloaded"
            save(receipt)
            print(json.dumps(receipt["donor"]), flush=True)
            return
        time.sleep(min(20, max(0, deadline - time.monotonic())))
    print("Polling deadline reached. Resume this task with poll.", flush=True)


if __name__ == "__main__":
    main()
