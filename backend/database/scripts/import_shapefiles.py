#!/usr/bin/env python3
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse
from backend.database.connection import get_database_url

SHAPE_DIR = Path(__file__).resolve().parents[1] / "data" / "shapefiles"


def pg_conn_params_from_url(url: str) -> str:
    p = urlparse(url)
    # p.username lowercases and may mangle dots - extract raw userinfo instead
    userinfo = p.netloc.split('@')[0]
    user, password = userinfo.split(':', 1) if ':' in userinfo else (userinfo, '')
    host = p.hostname or ''
    port = p.port or 6543
    dbname = p.path.lstrip('/')
    # Strip query string from dbname if present
    dbname = dbname.split('?')[0]
    # If the URL references the Supabase pooler host and a managed 'postgres.<id>' user,
    # use the direct DB host and the plain 'postgres' user for ogr2ogr compatibility.
    # Replace exact known pooler host with the direct host requested.
    if host.endswith('pooler.supabase.com'):
        host = 'db.nakmfjprqutyxehfdlaw.supabase.co'
    if user and '.' in user:
        # change 'postgres.<id>' style user to 'postgres'
        user = 'postgres'

    return f"host={host} port={port} dbname={dbname} user={user} password={password}"


def import_shapefile(shp_path: Path, target_table: str):
    ogr = shutil.which('ogr2ogr')
    if not ogr:
        raise RuntimeError('ogr2ogr not found on PATH. Install GDAL to use this script.')
    db_url = get_database_url()
    pg_conn = pg_conn_params_from_url(db_url)
    cmd = [
        ogr,
        '-f', 'PostgreSQL',
        f"PG:{pg_conn}",
        str(shp_path),
        '-nln', target_table,
        '-overwrite',
        '-lco', 'GEOMETRY_NAME=geom',
        '-lco', 'FID=gid',
        '-nlt', 'MULTIPOLYGON',
        '-t_srs', 'EPSG:4326',
    ]
    subprocess.check_call(cmd)
    print(f"Imported {shp_path.name} into {target_table}")


def main():
    sd = SHAPE_DIR
    if not sd.exists():
        print(f"Shapefiles directory not found: {sd}")
        return

    # Recursively find shapefiles in nested folders (ADM0/ADM1/ADM2/ADM3 etc.)
    shp_files = sorted(sd.rglob('*.shp'))
    if not shp_files:
        print(f"No shapefiles found under: {sd}")
        return

    for shp in shp_files:
        name = shp.stem.lower()
        parent = shp.parent.name.lower()

        # Map known folders/names to target tables
        if 'adm0' in parent or name in ('mw_boundary', 'mw-boundary', 'malawi_boundary'):
            target = 'mw_boundary'
            mode = 'overwrite'
        elif any(k in parent for k in ('adm1', 'adm2', 'adm3')) or 'admin' in name or 'district' in name:
            target = 'admin_boundaries'
            mode = 'append'
        elif 'location' in parent or 'location' in name:
            target = 'locations'
            mode = 'overwrite'
        else:
            target = name
            mode = 'overwrite'

        try:
            import_shapefile(shp, target)
        except Exception as e:
            print(f"Failed to import {shp.relative_to(sd)}: {e}")


if __name__ == '__main__':
    main()
