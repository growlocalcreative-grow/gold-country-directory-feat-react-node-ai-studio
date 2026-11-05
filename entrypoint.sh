#!/bin/sh
set -eu
# Startup migrations/seeding are handled once by index.ts only when explicitly enabled.
# For multi-instance Cloud Run use a separate release job and leave both disabled.
exec "$@"
