import os
from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError('Supabase credentials are not set in environment variables')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_all(table: str):
    res = supabase.table(table).select('*').execute()
    if res.error:
        raise RuntimeError(res.error)
    return res.data
