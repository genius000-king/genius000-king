import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _h import *
import trees
import flowers      # noqa
import bushes       # noqa
import ground       # noqa
import hanging      # noqa
import logs         # noqa

if __name__ == "__main__":
    only = os.environ.get("ONLY")
    run_all(only)
    if not only:
        MANIFEST.write()
