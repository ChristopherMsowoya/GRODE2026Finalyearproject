from pathlib import Path
import importlib.util


def _load_real_runner():
    project_root = Path(__file__).resolve().parents[2]
    real_path = project_root / "backend" / "algorithms" / "src" / "pipeline" / "run_pipeline.py"
    if not real_path.exists():
        raise FileNotFoundError(f"Pipeline runner not found at {real_path}")

    spec = importlib.util.spec_from_file_location("alg_pipeline_run", str(real_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def run(*args, **kwargs):
    """Proxy to the real pipeline.run function located under backend/algorithms/src.

    This shim exists so imports like `from pipeline.run_pipeline import run`
    resolve inside the backend environment used by the API server.
    """
    mod = _load_real_runner()
    return mod.run(*args, **kwargs)


__all__ = ["run"]
